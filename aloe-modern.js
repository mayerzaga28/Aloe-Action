(()=>{
 const motion=matchMedia('(prefers-reduced-motion: reduce)');
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
