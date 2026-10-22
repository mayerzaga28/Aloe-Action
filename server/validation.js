import {createHash,createHmac,randomUUID} from 'node:crypto';
export {randomUUID};
export const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
export function text(v,min=1,max=200){if(typeof v!=='string'||v.trim().length<min||v.trim().length>max||/[\u0000-\u0008]/.test(v))fail('Revisa los campos del formulario.');return v.trim();}
export function integer(v,min,max){if(!Number.isSafeInteger(v)||v<min||v>max)fail('Cantidad o importe inválido.');return v;}
export function uuid(v){if(typeof v!=='string'||! /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v))fail('Identificador inválido.');return v;}
export function email(v){v=text(v,3,200).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))fail('Revisa el correo.');return v;}
export function postcode(v){if(typeof v!=='string'||!/^\d{5}$/.test(v))fail('El código postal debe tener cinco dígitos.');return v;}
export function customer(v){if(!v||typeof v!=='object')fail('Faltan tus datos.');const phone=text(v.phone,10,20);if(!/^\+?[\d ()-]{10,20}$/.test(phone))fail('Revisa el teléfono.');return {name:text(v.name,3,120),email:email(v.email),phone,address:text(v.address,5,250),district:text(v.district,2,100),city:text(v.city,2,100),state:text(v.state,2,80),postcode:postcode(v.postcode),country:'MX'};}
export function items(v){if(!Array.isArray(v)||v.length<1||v.length>20)fail('Revisa el carrito.');const seen=new Set();return v.map(x=>{uuid(x.id);if(seen.has(x.id))fail('Presentación duplicada.');seen.add(x.id);return {id:x.id,quantity:integer(x.quantity,1,99)};}).sort((a,b)=>a.id.localeCompare(b.id));}
export const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export function token(id){const secret=process.env.ORDER_TOKEN_SECRET;if(!secret||secret.length<32)fail('Configuración incompleta.',503);return createHmac('sha256',secret).update(id).digest('hex');}
export function safeImage(v){v=text(v,1,500);if(v.startsWith('//')||!/^\/[a-zA-Z0-9/_-]+\.(png|jpe?g|webp)$/.test(v))fail('Usa una imagen revisada del sitio (PNG, JPG o WebP).');return v;}
