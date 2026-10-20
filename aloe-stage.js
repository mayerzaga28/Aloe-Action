(()=>{
const stage=document.querySelector('.store-stage');if(!stage)return;
const motion=matchMedia('(prefers-reduced-motion: reduce)'),fine=matchMedia('(pointer:fine)'),image=document.querySelector('#stage-image');
const products={80:{src:'/aloe-action-80.png',price:'300',format:'Formato compacto',caption:'Representación digital · 80 ml'},250:{src:'/aloe-action-250-cutout.png',price:'850',format:'Formato grande',caption:'Presentación de 250 ml'}};
const preload=new Image();preload.src=products[250].src;
let entrance;
document.querySelectorAll('[data-stage-size]').forEach(button=>button.addEventListener('click',()=>{
const size=button.dataset.stageSize;if(stage.dataset.size===size)return;const p=products[size];
stage.dataset.size=size;document.querySelectorAll('[data-stage-size]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
image.src=p.src;image.alt=p.caption+' de Aloe Action';document.querySelector('.stage-numeral').textContent=size;
document.querySelector('#stage-format').textContent=p.format;document.querySelector('#stage-price').innerHTML='$'+p.price+' <small>MXN + envío</small>';
const link=document.querySelector('#stage-link');link.href='/producto?tamano='+size;link.innerHTML='Elegir '+size+' ml <span aria-hidden="true">↗</span>';document.querySelector('#stage-caption').textContent=p.caption;
entrance?.cancel();if(!motion.matches)entrance=image.animate([{opacity:0,transform:'translateY(18px) scale(.97)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:480,easing:'cubic-bezier(.16,1,.3,1)'});
}));
let frame=0;stage.addEventListener('pointermove',event=>{if(motion.matches||!fine.matches)return;cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{const r=stage.getBoundingClientRect();stage.style.setProperty('--stage-x',((event.clientX-r.left)/r.width-.5)*28+'px');stage.style.setProperty('--stage-y',((event.clientY-r.top)/r.height-.5)*20+'px');});});
stage.addEventListener('pointerleave',()=>{cancelAnimationFrame(frame);stage.style.setProperty('--stage-x','0px');stage.style.setProperty('--stage-y','0px');});
motion.addEventListener('change',()=>{if(motion.matches)entrance?.cancel();});
})();
