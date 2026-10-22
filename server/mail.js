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
