(()=>{
 'use strict';
 const modal=document.getElementById('image-viewer');
 if(!modal)return;
 const image=document.getElementById('viewer-image'),caption=document.getElementById('viewer-caption'),stage=modal.querySelector('.viewer-stage'),zoom=document.getElementById('viewer-zoom');
 const items=[...document.querySelectorAll('[data-view-image]')];
 let current=0,opener=null,productMode=false;
 function show(){
  const source=productMode?document.getElementById('product-image'):items[current];
  image.src=productMode?source.src:source.dataset.viewImage;
  image.alt=productMode?source.alt:source.dataset.viewCaption;
  caption.textContent=image.alt;
  stage.classList.remove('is-zoomed');zoom.setAttribute('aria-pressed','false');zoom.textContent='Ampliar';
  document.getElementById('viewer-prev').hidden=productMode||items.length<2;
  document.getElementById('viewer-next').hidden=productMode||items.length<2;
 }
 items.forEach((button,index)=>button.addEventListener('click',()=>{current=index;productMode=false;opener=button;show();modal.showModal();}));
 document.getElementById('enlarge-product')?.addEventListener('click',e=>{productMode=true;opener=e.currentTarget;show();modal.showModal();});
 function step(n){if(productMode||items.length<2)return;current=(current+n+items.length)%items.length;show();}
 document.getElementById('viewer-prev').addEventListener('click',()=>step(-1));
 document.getElementById('viewer-next').addEventListener('click',()=>step(1));
 document.getElementById('viewer-close').addEventListener('click',()=>modal.close());
 modal.addEventListener('close',()=>opener?.focus());
 modal.addEventListener('keydown',e=>{if(e.key==='ArrowRight'){e.preventDefault();step(1);}if(e.key==='ArrowLeft'){e.preventDefault();step(-1);}});
 zoom.addEventListener('click',()=>{const expanded=stage.classList.toggle('is-zoomed');zoom.setAttribute('aria-pressed',String(expanded));zoom.textContent=expanded?'Reducir':'Ampliar';stage.scrollTop=0;stage.scrollLeft=0;});
 function openIngredient(){const id=location.hash.slice(1);const target=document.getElementById(id);if(target?.tagName==='DETAILS')target.open=true;}
 openIngredient();window.addEventListener('hashchange',openIngredient);
})();
