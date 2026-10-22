import fs from 'node:fs/promises';
await fs.mkdir('public',{recursive:true});
for(const file of await fs.readdir('.')){
 if(!/\.(html|css|js|png|jpeg|jpg|webp|mp4)$/.test(file))continue;
 let data=await fs.readFile(file);
 if(file.endsWith('.html')){
  let html=data.toString().replace(/<dialog id="demo-checkout"[\s\S]*?<\/dialog>/g,'');
  html=html.replace('Este carrito es una demostración: no reserva productos, genera pedidos ni realiza cobros.','Las existencias y el total se verifican antes de pagar. Agregar al carrito no reserva unidades.').replace('Continuar al pago de prueba','Revisar compra').replace('Envío y condiciones finales por confirmar. La selección se conserva durante esta sesión del navegador para que puedas recorrer el sitio. No se envía a un servidor.','El costo de entrega se confirma antes del pago. Nunca capturamos datos de tarjetas en este sitio.');
  html=html.replace(/Nombre de prueba/g,'Nombre').replace(/Correo de prueba/g,'Correo').replace(/Mensaje de prueba/g,'Mensaje').replace('Previsualizar mensaje ↗','Enviar mensaje ↗').replace(/Vista de demostración: nada se envía ni se guarda\. Usa datos ficticios para probar el formulario\./g,'Formulario pendiente de conectar. No ingreses datos reales durante la preparación.').replaceAll('Privacidad de la demostración','Privacidad').replaceAll('Compra en línea aún no habilitada. Puedes explorar el carrito y probar una simulación sin cobros ni pedidos.','Estamos preparando la compra segura. La disponibilidad se verificará antes del pago.').replaceAll('No todavía. El carrito y la pantalla de pago son una demostración. No se realizan cobros ni se generan pedidos.','Las compras están cerradas hasta completar la conexión y verificación de la tienda. No se realizan cobros en esta vista previa.');
  // Price labels are supplied by the database, not the old static mockup.
  html=html.split(/(<[^>]+>)/g).map(s=>s.startsWith('<')?s:s.replace(/\$300(?: MXN)?/g,'<span data-db-price="80">Precio por confirmar</span>').replace(/\$850(?: MXN)?/g,'<span data-db-price="250">Precio por confirmar</span>')).join('');
  if(file==='privacidad.html')html=html.replace(/<main id="main">[\s\S]*?<\/main>/,'<main id="main" class="commerce-shell"><h1>Privacidad</h1><p class="commerce-notice">Aviso pendiente de aprobación. No se habilitarán ventas ni contacto real hasta validarlo.</p><p>Falta identificar al responsable y su domicilio, el canal para ejercer derechos sobre los datos, finalidades, conservación, transferencias y proveedores. La integración está preparada para tratar datos de contacto, entrega y pedidos; las tarjetas se capturan únicamente en la pasarela.</p><p>Esta información describe el desarrollo previsto y no sustituye el aviso de privacidad definitivo.</p></main>');
  html=html.replace('</head>','<link rel="stylesheet" href="/commerce.css"></head>').replace('</body>','<script src="/commerce-client.js" defer></script></body>');
  if(html.includes('id="add-cart"'))html=html.replace('id="add-cart"','id="add-cart" disabled');
  data=Buffer.from(html);
 }
 if(file==='aloe-site.js'){
  const s=data.toString();let rest=s.slice(s.indexOf("on('menu','click'"),s.lastIndexOf('updateSelection();renderCart();'));
  rest=rest.replace(/on\('contact-form','submit',[^\n]+\n/,'');
  data=Buffer.from(`(()=>{'use strict';const $=id=>document.getElementById(id),on=(id,event,fn)=>$(id)?.addEventListener(event,fn),normal=s=>s.normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase();function info(title,html){$('info-title').textContent=title;$('info-copy').innerHTML=html;$('info-dialog').showModal();}document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));\n${rest}\n})();`);
 }
 if(file==='aloe-stage.js')data=Buffer.from(data.toString().replace("document.querySelector('#stage-price').innerHTML='$'+p.price+' <small>MXN + envío</small>';","document.querySelector('#stage-price').textContent=window.aloePrice?.(size)||'Precio por confirmar';"));
 await fs.writeFile('public/'+file,data);
}
console.log('Public build ready: visual assets retained; demo payment removed.');
