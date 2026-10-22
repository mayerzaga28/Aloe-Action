import {transaction} from './db.js';
import {owner} from './security.js';
import {text,integer,uuid,randomUUID,safeImage,fail} from './validation.js';
import {adjustStock,enqueue} from './commerce.js';
export async function dashboard(db,a,input){
 const filter=typeof input.search==='string'?input.search.slice(0,100):'';
 const orders=(await db.query(`SELECT * FROM shop.orders WHERE ($1='' OR id::text ILIKE '%'||$1||'%' OR customer->>'email' ILIKE '%'||$1||'%') AND ($2='' OR payment=$2) ORDER BY created_at DESC LIMIT 100`,[filter,input.payment||''])).rows;
 const variants=(await db.query('SELECT v.*,p.name,p.description,p.active AS product_active FROM shop.variants v JOIN shop.products p ON p.id=v.product_id ORDER BY v.ml')).rows;
 const movements=(await db.query('SELECT * FROM shop.movements ORDER BY created_at DESC LIMIT 100')).rows;
 const outbox=(await db.query('SELECT id,state,delivery_status,attempts,last_error,provider_id,created_at FROM shop.outbox ORDER BY created_at DESC LIMIT 100')).rows;
 const contacts=(await db.query('SELECT * FROM shop.contacts ORDER BY created_at DESC LIMIT 100')).rows;
 return {role:a.role,orders,variants,movements,outbox,contacts};
}
export async function mutate(db,a,b){
 if(b.operation==='inventory'){owner(a);await adjustStock(db,uuid(b.id),integer(b.delta,-100000,100000),text(b.reason,5,500),a.user_id,b.orderId?uuid(b.orderId):null);return;}
 if(b.operation==='variant'){owner(a);const id=b.id?uuid(b.id):randomUUID();await transaction(db,async c=>{
  const productId=uuid(b.product_id);await c.query('INSERT INTO shop.products(id,name,description,active) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET name=$2,description=$3,active=$4',[productId,text(b.name,2,120),text(b.description,5,3000),b.product_active===true]);
  await c.query(`INSERT INTO shop.variants(id,product_id,sku,ml,image,price,active,low_stock,weight_g,length_mm,width_mm,height_mm) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT(id) DO UPDATE SET product_id=$2,sku=$3,ml=$4,image=$5,price=$6,active=$7,low_stock=$8,weight_g=$9,length_mm=$10,width_mm=$11,height_mm=$12`,[id,productId,text(b.sku,2,50),integer(b.ml,1,10000),safeImage(b.image),integer(b.price,1,10000000),b.active===true,integer(b.low_stock,0,100000),...['weight_g','length_mm','width_mm','height_mm'].map(k=>b[k]==null||b[k]===''?null:integer(Number(b[k]),1,100000))]);await audit(c,a,'variant',id);
 });return;}
 if(b.operation==='fulfillment'){
  const id=uuid(b.id);if(!['unprepared','preparing','shipped','delivered','cancelled'].includes(b.state))fail('Estado inválido.');
  await transaction(db,async c=>{const o=(await c.query('SELECT * FROM shop.orders WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!o)fail('Pedido inexistente.',404);if(['preparing','shipped','delivered'].includes(b.state)&&o.payment!=='paid')fail('Primero debe confirmarse el pago.',409);const carrier=b.carrier?text(b.carrier,2,100):null,tracking=b.tracking?text(b.tracking,3,100):null;if(['shipped','delivered'].includes(b.state)&&(!carrier||!tracking))fail('Faltan paquetería y guía.');await c.query('UPDATE shop.orders SET fulfillment=$2,carrier=$3,tracking=$4,notes=$5,updated_at=now() WHERE id=$1',[id,b.state,carrier,tracking,typeof b.notes==='string'?text(b.notes,0,3000):o.notes]);await audit(c,a,'fulfillment:'+b.state,id);if(b.state==='shipped')await enqueue(c,id+':shipped:'+tracking,o.customer.email,'ALOE ACTION · Tu pedido fue enviado',`Pedido ${id}. Paquetería: ${carrier}. Guía: ${tracking}.`);});return;
 }
 if(b.operation==='retry-mail'){owner(a);await db.query("UPDATE shop.outbox SET lease_until=NULL WHERE id=$1 AND state IN ('queued','sending') AND (first_attempt IS NULL OR first_attempt>now()-interval '20 hours')",[uuid(b.id)]);return;}
 fail('Operación no permitida.');
}
async function audit(c,a,action,target){await c.query('INSERT INTO shop.audit(id,actor,action,target) VALUES($1,$2,$3,$4)',[randomUUID(),a.user_id,action,target]);}
