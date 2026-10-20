(()=>{
 const journey=document.querySelector('.product-journey');if(!journey)return;
 const motion=matchMedia('(prefers-reduced-motion: reduce)'),visual=journey.querySelector('.journey-visual');
 let frame=0,visible=true;
 const clamp=n=>Math.max(0,Math.min(1,n));
 function update(){
  frame=0;if(motion.matches||!visible)return;
  const r=journey.getBoundingClientRect(),top=parseFloat(getComputedStyle(visual).top)||0;
  const p=clamp((top-r.top)/Math.max(1,r.height-visual.offsetHeight));
  const blend=clamp((p-.44)/.14);
  visual.style.setProperty('--journey-progress',p);
  visual.style.setProperty('--journey-large',1-blend);visual.style.setProperty('--journey-small',blend);
  visual.style.setProperty('--journey-r',(-8+Math.sin(p*Math.PI*2)*13)+'deg');
  visual.style.setProperty('--journey-y',Math.sin(p*Math.PI*2)*16+'px');
  visual.style.setProperty('--journey-scale',1+Math.sin(p*Math.PI)*.08);
  visual.style.setProperty('--journey-bg',(p*16-8)+'deg');
 }
 const schedule=()=>{if(!frame)frame=requestAnimationFrame(update);};
 addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule);
 motion.addEventListener('change',schedule);
 if('IntersectionObserver'in window)new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)schedule();}).observe(journey);
 schedule();
})();
