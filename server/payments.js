import Stripe from 'stripe';
import {fail,token} from './validation.js';
import {settle} from './commerce.js';
export function stripe(){const key=process.env.STRIPE_SECRET_KEY||'',live=process.env.PAYMENT_MODE==='live';if(!key.startsWith(live?'sk_live_':'sk_test_'))fail('La pasarela no está configurada para este entorno.',503);if(live&&(process.env.VERCEL_ENV!=='production'||process.env.LIVE_APPROVED!=='true'))fail('Cobros reales desactivados.',503);return new Stripe(key,{maxNetworkRetries:2,timeout:12000});}
export async function checkout(db,o,provider=stripe()){
 if(o.session_id){const s=await provider.checkout.sessions.retrieve(o.session_id);if(s.status!=='open')fail('Esta sesión terminó. Consulta tu pedido antes de intentar de nuevo.',409);return {url:s.url,id:o.id,token:token(o.id)};}
 if(new Date(o.created_at).getTime()<Date.now()-20*3600000)fail('La sesión requiere revisión antes de reintentar.',409);
 const origin=process.env.APP_ORIGIN;if(!origin?.startsWith('https://'))fail('Falta el dominio seguro de la tienda.',503);
 // Persist exact provider parameters before the first network request. Retries never create a second charge/session.
 const params={mode:'payment',payment_method_types:['card'],client_reference_id:o.id,metadata:{order_id:o.id},payment_intent_data:{metadata:{order_id:o.id}},customer_email:o.customer.email,expires_at:Math.floor(new Date(o.expires_at).getTime()/1000),line_items:[...o.items.map(x=>({quantity:x.quantity,price_data:{currency:'mxn',unit_amount:x.price,product_data:{name:x.name+' · '+x.ml+' ml'}}})),...(o.shipping?[{quantity:1,price_data:{currency:'mxn',unit_amount:o.shipping,product_data:{name:'Envío'}}}]:[])],success_url:origin+'/pedido#'+o.id+'.'+token(o.id),cancel_url:origin+'/pedido#'+o.id+'.'+token(o.id)};
 await db.query('UPDATE shop.orders SET session_params=COALESCE(session_params,$2::jsonb) WHERE id=$1',[o.id,JSON.stringify(params)]);
 const saved=(await db.query('SELECT session_params FROM shop.orders WHERE id=$1',[o.id])).rows[0].session_params;
 const session=await provider.checkout.sessions.create(saved,{idempotencyKey:'checkout:'+o.id});
 await db.query('UPDATE shop.orders SET session_id=$2 WHERE id=$1 AND session_id IS NULL',[o.id,session.id]);
 return {url:session.url,id:o.id,token:token(o.id)};
}
export async function reconcile(db,o,provider=stripe(),eventId){if(!o.session_id){await checkout(db,o,provider);o=(await db.query('SELECT * FROM shop.orders WHERE id=$1',[o.id])).rows[0];}const session=await provider.checkout.sessions.retrieve(o.session_id);return settle(db,o.id,session,eventId);}
