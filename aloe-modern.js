(()=>{
 const motion=matchMedia('(prefers-reduced-motion: reduce)');
 const finePointer=matchMedia('(hover: hover) and (pointer: fine)');
 const progress=document.createElement('div');progress.className='reading-progress';progress.setAttribute('aria-hidden','true');document.body.append(progress);
 let scrollFrame=0;
 const updateProgress=()=>{scrollFrame=0;const total=document.documentElement.scrollHeight-innerHeight;progress.style.transform='scaleX('+(total>0?Math.min(1,Math.max(0,scrollY/total)):0)+')';};
 addEventListener('scroll',()=>{if(!scrollFrame)scrollFrame=requestAnimationFrame(updateProgress);},{passive:true});addEventListener('resize',updateProgress);updateProgress();
 document.querySelectorAll('.choice-card,.life-grid article').forEach(card=>{
  card.classList.add('interactive-surface');
  card.addEventListener('pointermove',event=>{
   if(motion.matches||!finePointer.matches)return;
   const r=card.getBoundingClientRect(),x=(event.clientX-r.left)/r.width,y=(event.clientY-r.top)/r.height;
   card.style.setProperty('--tilt-x',((.5-y)*5)+'deg');card.style.setProperty('--tilt-y',((x-.5)*5)+'deg');card.style.setProperty('--spot-x',(x*100)+'%');card.style.setProperty('--spot-y',(y*100)+'%');
  });
  card.addEventListener('pointerleave',()=>{card.style.setProperty('--tilt-x','0deg');card.style.setProperty('--tilt-y','0deg');});
 });
 document.addEventListener('click',event=>{
  const button=event.target.closest('.btn,.formula-options button,.locator-toolbar button');
  if(!button||motion.matches)return;
  const ripple=document.createElement('span'),r=button.getBoundingClientRect();ripple.className='tap-wave';ripple.setAttribute('aria-hidden','true');ripple.style.left=(event.detail?event.clientX-r.left:r.width/2)+'px';ripple.style.top=(event.detail?event.clientY-r.top:r.height/2)+'px';button.append(ripple);ripple.addEventListener('animationend',()=>ripple.remove(),{once:true});
 });
 document.querySelectorAll('details').forEach(details=>details.addEventListener('toggle',()=>{
  if(details.open&&!motion.matches)Array.from(details.children).filter(el=>el.tagName!=='SUMMARY').forEach(el=>el.animate([{opacity:0,transform:'translateY(-6px)'},{opacity:1,transform:'translateY(0)'}],{duration:260,easing:'ease-out'}));
 }));
 document.querySelectorAll('[data-ingredient]').forEach(button=>button.addEventListener('click',()=>{
  if(!motion.matches)document.querySelector('.ingredient-focus')?.animate([{opacity:.2,transform:'translateY(12px)'},{opacity:1,transform:'translateY(0)'}],{duration:360,easing:'ease-out'});
 }));
 const nodes=[...document.querySelectorAll('.section-head,.choice-card,.sensory-pair figure,.life-grid article,.story-split>div,.home-faq>div')];
 if('IntersectionObserver' in window&&!motion.matches){
  const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target);}}),{threshold:.08});
  nodes.forEach(node=>{if(node.getBoundingClientRect().top>innerHeight){node.classList.add('reveal-ready');observer.observe(node);}});
  motion.addEventListener('change',()=>{if(motion.matches){observer.disconnect();nodes.forEach(n=>n.classList.add('is-visible'));}});
 }
 const ribbon=document.querySelector('.motion-ribbon'),pause=document.querySelector('#ribbon-pause');
 pause?.addEventListener('click',()=>{const paused=ribbon.classList.toggle('is-paused');pause.setAttribute('aria-pressed',String(paused));pause.setAttribute('aria-label',paused?'Reanudar texto en movimiento':'Pausar texto en movimiento');pause.textContent=paused?'▷':'Ⅱ';});
 const ingredients=[['Aloe','aloe','A','El ingrediente que da nombre a Aloe Action. Es uno de los cinco destacados en nuestro envase.'],['Centella asiática','centella','C','Una presencia botánica entre los ingredientes destacados de Aloe Action. Conoce cómo la describe nuestro glosario.'],['Vitamina E','vitamina','E','También forma parte de la selección destacada en el envase. Consulta la etiqueta para conocer la composición completa.'],['Lavanda','lavanda','L','Un nombre ligado al universo aromático de Aloe Action. Descubre más en nuestro glosario de ingredientes.'],['Mentol','mentol','M','Completa los cinco ingredientes destacados de Aloe Action. Revisa siempre las indicaciones de tu presentación.']];
 document.querySelectorAll('[data-ingredient]').forEach(button=>button.addEventListener('click',()=>{
  const [name,id,symbol,copy]=ingredients[Number(button.dataset.ingredient)];
  document.querySelectorAll('[data-ingredient]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
  document.querySelector('#ingredient-name').textContent=name;document.querySelector('#ingredient-copy').textContent=copy;
  document.querySelector('.ingredient-symbol').textContent=symbol;document.querySelector('#ingredient-more').href='/ingredientes#'+id;
 }));
})();
