import {database,transaction} from '../server/db.js';
import {catalog,quote,reserve,enqueue,settle} from '../server/commerce.js';
import {checkout,reconcile,stripe} from '../server/payments.js';
import {admin,authRequest,originCheck,rateLimit,secureEqual} from '../server/security.js';
import {dashboard,mutate} from '../server/admin.js';
import {deliverMail,inspectDelivery} from '../server/mail.js';
import {fail,email,text,uuid,hash,token,randomUUID} from '../server/validation.js';
export const config={api:{bodyParser:false}};
async function rawBody(req){const chunks=[];let length=0;for await(const chunk of req){length+=chunk.length;if(length>64000)fail('Solicitud demasiado grande.',413);chunks.push(chunk);}return Buffer.concat(chunks);}
export default async function handler(req,res){
 const requestId=randomUUID();res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
 const send=(data,status=200)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));};
 try{
  const action=new URL(req.url,'https://local.invalid').searchParams.get('action')||'health';
  if(!['health','webhook','jobs','catalog','quote','checkout','order','cancel','contact','login','session','logout','admin','admin-update','admin-jobs'].includes(action))fail('Ruta no encontrada.',404);
  if(action==='health'){return send({salesEnabled:process.env.SALES_ENABLED==='true',configured:!!process.env.DATABASE_URL,mode:process.env.PAYMENT_MODE||'test'});}
  const db=database();
  if(action==='webhook'){
   if(req.method!=='POST')fail('Método no permitido.',405);
   const provider=stripe();let event;try{event=provider.webhooks.constructEvent(await rawBody(req),req.headers['stripe-signature'],process.env.STRIPE_WEBHOOK_SECRET);}catch{fail('Firma de webhook inválida.',400);}
   if(event.livemode!==(process.env.PAYMENT_MODE==='live'))fail('Entorno incorrecto.',400);
   const object=event.data.object;
   if(event.type.startsWith('checkout.session.')){
    const id=object.metadata?.order_id;if(!id)return send({received:true});
    const o=(await db.query('SELECT * FROM shop.orders WHERE id=$1',[uuid(id)])).rows[0];if(!o)fail('Pedido desconocido.',409);await reconcile(db,o,provider,event.id);
   }else if(['charge.refunded','refund.updated','payment_intent.payment_failed','payment_intent.canceled'].includes(event.type)){
    const pi=event.type.startsWith('payment_intent.')?object.id:typeof object.payment_intent==='string'?object.payment_intent:object.payment_intent?.id;
    const o=(await db.query('SELECT * FROM shop.orders WHERE payment_intent=$1',[pi])).rows[0];
    if(o){await reconcile(db,o,provider);const intent=await provider.paymentIntents.retrieve(pi,{expand:['latest_charge']});const charge=intent.latest_charge;
     if(charge&&typeof charge==='object'&&charge.currency==='mxn'&&charge.amount===o.total&&charge.livemode===(o.mode==='live')&&charge.amount_refunded>0){await transaction(db,async c=>{await c.query('SELECT id FROM shop.orders WHERE id=$1 FOR UPDATE',[o.id]);await c.query("UPDATE shop.orders SET payment=$2,updated_at=now() WHERE id=$1 AND stock_state='sold'",[o.id,charge.amount_refunded===o.total?'refunded':'partially_refunded']);await c.query('INSERT INTO shop.events(id,order_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[event.id,o.id]);});}
     else if(intent.status==='requires_payment_method')await db.query("UPDATE shop.orders SET payment='failed' WHERE id=$1 AND stock_state='reserved'",[o.id]);
    }
   }
   await deliverMail(db);return send({received:true});
  }
  if(action==='jobs'){
   if(!process.env.CRON_SECRET||!secureEqual(req.headers.authorization,'Bearer '+process.env.CRON_SECRET))fail('No autorizado.',401);
   return send(await jobs(db));
  }
  await rateLimit(db,req,action);
  if(action==='catalog'){if(req.method!=='GET')fail('Método no permitido.',405);return send({variants:await catalog(db),salesEnabled:process.env.SALES_ENABLED==='true'});}
  if(req.method!=='POST')fail('Método no permitido.',405);originCheck(req);
  if(!req.headers['content-type']?.startsWith('application/json'))fail('Usa JSON.',415);
  let b;try{b=JSON.parse((await rawBody(req)).toString());}catch{fail('Solicitud inválida.');}
  if(action==='quote'){const q=await quote(db,b);return send({...q,quote:hash(q)});}
  if(action==='checkout'){
   if(process.env.SALES_ENABLED!=='true')fail('Las compras todavía no están habilitadas.',503);
   const provider=stripe();const o=await reserve(db,b,process.env.PAYMENT_MODE||'test');return send(await checkout(db,o,provider));
  }
  if(action==='order'||action==='cancel'){
   const id=uuid(b.id);if(!secureEqual(b.token,token(id)))fail('Enlace de pedido inválido.',404);
   let o=(await db.query('SELECT * FROM shop.orders WHERE id=$1',[id])).rows[0];if(!o)fail('Pedido no encontrado.',404);
   if(action==='cancel'&&o.stock_state==='reserved'&&o.session_id){const provider=stripe(),s=await provider.checkout.sessions.retrieve(o.session_id);if(s.status==='open'){await provider.checkout.sessions.expire(s.id);await db.query("UPDATE shop.orders SET payment='cancelled' WHERE id=$1 AND stock_state='reserved'",[id]);}o=await reconcile(db,o,provider);}
   else if(o.session_id&&['pending','failed'].includes(o.payment)){try{o=await reconcile(db,o);}catch{/* Webhook/worker will reconcile. Do not infer success. */}}
   return send({id:o.id,payment:o.payment,fulfillment:o.fulfillment,total:o.total,items:o.items,carrier:o.carrier,tracking:o.tracking,estimate:o.shipping_estimate,mode:o.mode});
  }
  if(action==='contact'){
   if(process.env.CONTACT_ENABLED!=='true')fail('El formulario todavía no está habilitado. No se guardó el mensaje.',503);
   if(b.website)fail('No se pudo enviar el mensaje.');const name=text(b.name,2,100),mail=email(b.email),message=text(b.message,10,3000);const id=randomUUID();await transaction(db,async c=>{await c.query('INSERT INTO shop.contacts(id,name,email,message) VALUES($1,$2,$3,$4)',[id,name,mail,message]);await enqueue(c,id+':contact',process.env.TEAM_EMAIL,'Nuevo mensaje de contacto · ALOE ACTION',`Mensaje ${id}. Consulta el panel privado.`);});await deliverMail(db);return send({saved:true,id});
  }
  if(action==='login'){
   const mail=email(b.email);const allowed=(await db.query('SELECT user_id FROM shop.admins WHERE email=$1 AND active',[mail])).rows.length;
   if(allowed)await authRequest('otp?redirect_to='+encodeURIComponent(process.env.APP_ORIGIN+'/admin'),{email:mail,create_user:false});
   return send({message:'Si tu correo tiene acceso, recibirás un enlace para entrar. También sirve para recuperar el acceso.'});
  }
  if(action==='session'){const access=text(b.accessToken,20,8000);await admin(db,req,access);res.setHeader('Set-Cookie','aloe_admin='+access+'; HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=3500');return send({ok:true});}
  if(action==='logout'){res.setHeader('Set-Cookie','aloe_admin=; HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=0');return send({ok:true});}
  const a=await admin(db,req);
  if(action==='admin')return send(await dashboard(db,a,b));
  if(action==='admin-update'){await mutate(db,a,b);await deliverMail(db);return send({ok:true});}
  if(action==='admin-jobs')return send(await jobs(db));
  fail('Ruta no encontrada.',404);
 }catch(e){const status=e.status||500;if(status===500)console.error(JSON.stringify({requestId,error:'commerce_failure',code:e.code||e.type||'internal'}));send({error:status===500?'No pudimos completar la operación. No vuelvas a pagar hasta consultar tu pedido.':e.message,requestId},status);}
}
async function jobs(db){const orders=(await db.query("SELECT * FROM shop.orders WHERE stock_state='reserved' AND (session_id IS NOT NULL OR created_at>now()-interval '20 hours') ORDER BY updated_at LIMIT 5")).rows;let checked=0;for(const o of orders){try{await reconcile(db,o);checked++;}catch{console.error(JSON.stringify({error:'reconciliation_pending',order:o.id}));}}await db.query('DELETE FROM shop.rate_limits WHERE expires_at<now()');await inspectDelivery(db);return {checked,mail:await deliverMail(db)};}
