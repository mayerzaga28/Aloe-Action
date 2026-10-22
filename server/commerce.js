import {transaction} from './db.js';
import {fail,items,postcode,customer,uuid,hash,randomUUID,token} from './validation.js';
export async function catalog(db){return (await db.query(`SELECT v.id,v.sku,v.ml,v.image,v.price,v.physical-v.reserved AS available,p.name,p.description FROM shop.variants v JOIN shop.products p ON p.id=v.product_id WHERE v.active AND p.active ORDER BY v.ml`)).rows;}
export async function quote(db,input){
 const cart=items(input.items),zip=postcode(input.postcode);
 const rules=(await db.query('SELECT * FROM shop.shipping WHERE active AND $1=ANY(postcodes)',[zip])).rows;
 if(rules.length!==1)fail('No hay una tarifa de envío confirmada para este código postal.',422);
 const rows=(await db.query('SELECT v.*,p.name,p.active AS product_active FROM shop.variants v JOIN shop.products p ON p.id=v.product_id WHERE v.id=ANY($1::uuid[]) ORDER BY v.id',[cart.map(x=>x.id)])).rows;
 const lines=cart.map(x=>{const v=rows.find(y=>y.id===x.id);if(!v||!v.active||!v.product_active)fail('Una presentación ya no está disponible.',409);if(v.physical-v.reserved<x.quantity)fail('No hay suficientes existencias. Actualiza tu carrito.',409);return {id:v.id,sku:v.sku,name:v.name,ml:v.ml,price:v.price,quantity:x.quantity};});
 const subtotal=lines.reduce((s,x)=>s+x.price*x.quantity,0);if(subtotal>10000000)fail('El pedido supera el límite permitido.');
 return {items:lines,subtotal,shipping:rules[0].price,total:subtotal+rules[0].price,shipping_rule:rules[0].id,estimate:rules[0].estimate};
}
export async function reserve(db,input,mode){
 const cart=items(input.items),buyer=customer(input.customer),key=uuid(input.requestKey);
 if(input.consent!==true)fail('Acepta las condiciones de compra y privacidad.');
 const fingerprint=hash({cart,buyer,quote:input.quote});
 return transaction(db,async c=>{
  // Serialize retries with the same checkout key before inspecting stock.
  await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',[key]);
  const existing=(await c.query('SELECT * FROM shop.orders WHERE request_key=$1',[key])).rows[0];
  if(existing){if(existing.fingerprint!==fingerprint)fail('Los datos cambiaron: revisa el pedido y vuelve a confirmar.',409);return existing;}
  const config=(await c.query('SELECT * FROM shop.settings WHERE id=true')).rows[0];
  if(config?.mode!==mode||!config.policies_approved)fail('La tienda aún no está habilitada para comprar.',503);
  // Stable lock order prevents overselling and cross-cart deadlocks.
  await c.query('SELECT id FROM shop.variants WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[cart.map(x=>x.id)]);
  await c.query('SELECT id FROM shop.shipping WHERE active AND $1=ANY(postcodes) FOR SHARE',[buyer.postcode]);
  const q=await quote(c,{items:cart,postcode:buyer.postcode});
  if(hash(q)!==input.quote)fail('Cambió el precio, envío o disponibilidad. Revisa el total actualizado.',409);
  const id=randomUUID(),expires=new Date(Date.now()+35*60*1000);
  const order=(await c.query(`INSERT INTO shop.orders(id,request_key,fingerprint,mode,customer,items,subtotal,shipping,total,shipping_rule,shipping_estimate,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,[id,key,fingerprint,mode,buyer,JSON.stringify(q.items),q.subtotal,q.shipping,q.total,q.shipping_rule,q.estimate,expires])).rows[0];
  for(const line of q.items){await c.query('UPDATE shop.variants SET reserved=reserved+$2 WHERE id=$1',[line.id,line.quantity]);await movement(c,line.id,id,0,line.quantity,'Reserva de checkout','checkout');}
  return order;
 });
}
async function movement(c,variant,order,physical,reserved,reason,actor){await c.query('INSERT INTO shop.movements(id,variant_id,order_id,physical_delta,reserved_delta,reason,actor) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),variant,order,physical,reserved,reason,actor]);}
export async function enqueue(c,key,recipient,subject,body){if(!recipient)return;await c.query('INSERT INTO shop.outbox(id,dedupe,recipient,subject,body) VALUES($1,$2,$3,$4,$5) ON CONFLICT(dedupe) DO NOTHING',[randomUUID(),key,recipient,subject,body]);}
export async function settle(db,id,session,eventId){
 return transaction(db,async c=>{
  const o=(await c.query('SELECT * FROM shop.orders WHERE id=$1 FOR UPDATE',[id])).rows[0];
  if(!o)fail('Pedido no encontrado.',404);
  if(o.session_id!==session.id||session.metadata?.order_id!==id||session.client_reference_id!==id||session.amount_total!==o.total||session.currency!=='mxn'||session.livemode!==(o.mode==='live'))fail('El pago no coincide con el pedido.',409);
  if(eventId){const saved=await c.query('INSERT INTO shop.events(id,order_id) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING id',[eventId,id]);if(!saved.rows.length)return o;}
  let payment=o.payment;
  if(session.payment_status==='paid')payment='paid';
  else if(session.status==='expired')payment=o.payment==='cancelled'?'cancelled':'expired';
  else if(session.status==='complete')payment='pending';
  if(['refunded','partially_refunded'].includes(o.payment))payment=o.payment;
  if(o.stock_state==='sold'&&payment!=='paid'&&!['refunded','partially_refunded'].includes(payment))return o;
  const paid=payment==='paid',release=session.status==='expired'&&session.payment_status!=='paid';
  if(paid&&o.stock_state==='released'){return (await c.query("UPDATE shop.orders SET payment='review',updated_at=now() WHERE id=$1 RETURNING *",[id])).rows[0];}
  if(o.stock_state==='reserved'&&(paid||release)){
   for(const line of [...o.items].sort((a,b)=>a.id.localeCompare(b.id))){await c.query('UPDATE shop.variants SET reserved=reserved-$2,physical=physical-$3 WHERE id=$1',[line.id,line.quantity,paid?line.quantity:0]);await movement(c,line.id,id,paid?-line.quantity:0,-line.quantity,paid?'Venta confirmada':'Reserva vencida confirmada por Stripe','stripe');}
   await c.query('UPDATE shop.orders SET stock_state=$2 WHERE id=$1',[id,paid?'sold':'released']);
  }
  await c.query('UPDATE shop.orders SET payment=$2,payment_intent=$3,updated_at=now() WHERE id=$1',[id,payment,typeof session.payment_intent==='string'?session.payment_intent:session.payment_intent?.id||null]);
  if(paid){const link=process.env.APP_ORIGIN+'/pedido#'+id+'.'+token(id);await enqueue(c,id+':paid:customer',o.customer.email,'ALOE ACTION · Pago confirmado',`Tu pedido ${id} está pagado. Total: $${(o.total/100).toFixed(2)} MXN. Consulta su estado: ${link}`);await enqueue(c,id+':paid:team',process.env.TEAM_EMAIL,'Nuevo pedido pagado · ALOE ACTION',`Pedido ${id}. Consúltalo en el panel privado.`);}
  return (await c.query('SELECT * FROM shop.orders WHERE id=$1',[id])).rows[0];
 });
}
export async function adjustStock(db,id,delta,reason,actor,orderId=null){return transaction(db,async c=>{const v=(await c.query('SELECT * FROM shop.variants WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!v)fail('Presentación inexistente.',404);if(v.physical+delta<v.reserved)fail('El ajuste dejaría menos unidades que las reservadas.',409);await c.query('UPDATE shop.variants SET physical=physical+$2 WHERE id=$1',[id,delta]);await movement(c,id,orderId,delta,0,reason,actor);});}
