import {transaction} from './db.js';
export async function deliverMail(db){
 if(!process.env.RESEND_API_KEY||!process.env.MAIL_FROM)return {configured:false};
 let sent=0;
 for(let i=0;i<10;i++){
  const mail=await transaction(db,async c=>{
   const m=(await c.query("SELECT * FROM shop.outbox WHERE state IN ('queued','sending') AND (lease_until IS NULL OR lease_until<now()) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1")).rows[0];if(!m)return;
   // Resend deduplicates for 24h. Never automatically resend an uncertain old delivery.
   if(m.first_attempt&&new Date(m.first_attempt).getTime()<Date.now()-20*3600000){await c.query("UPDATE shop.outbox SET state='review',last_error='Revisar entrega en Resend antes de reenviar' WHERE id=$1",[m.id]);return;}
   await c.query("UPDATE shop.outbox SET state='sending',first_attempt=COALESCE(first_attempt,now()),lease_until=now()+interval '5 minutes',attempts=attempts+1 WHERE id=$1",[m.id]);return m;
  });if(!mail)break;
  try{const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':mail.id},body:JSON.stringify({from:process.env.MAIL_FROM,to:[mail.recipient],subject:mail.subject,text:mail.body}),signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Error('provider_http_'+response.status);const result=await response.json();await db.query("UPDATE shop.outbox SET state='sent',provider_id=$2,last_error=NULL WHERE id=$1",[mail.id,result.id]);sent++;}catch(e){await db.query("UPDATE shop.outbox SET last_error=$2 WHERE id=$1",[mail.id,e.message.startsWith('provider_http_')?e.message:'delivery_unconfirmed']);}
 }
 return {configured:true,accepted:sent};
}
export async function inspectDelivery(db){
 if(!process.env.RESEND_API_KEY)return;
 const mails=(await db.query("SELECT id,provider_id FROM shop.outbox WHERE state='sent' AND provider_id IS NOT NULL AND created_at>now()-interval '7 days' AND (delivery_status IS NULL OR delivery_status IN ('sent','delivery_delayed')) AND (delivery_checked_at IS NULL OR delivery_checked_at<now()-interval '30 minutes') ORDER BY delivery_checked_at NULLS FIRST LIMIT 5")).rows;
 for(const m of mails){try{const r=await fetch('https://api.resend.com/emails/'+encodeURIComponent(m.provider_id),{headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY},signal:AbortSignal.timeout(8000)});if(!r.ok)continue;const email=await r.json();if(email.id!==m.provider_id)continue;await db.query('UPDATE shop.outbox SET delivery_status=$2,delivery_checked_at=now() WHERE id=$1',[m.id,String(email.last_event||'unknown').slice(0,40)]);}catch{/* Leave pending for the next scheduled inspection. */}}
}
