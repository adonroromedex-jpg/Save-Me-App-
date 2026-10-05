import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';
// Run with a service-role bearer from a scheduled server job. Never ship it in the app.
Deno.serve(async request => {
 const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),url=Deno.env.get('SUPABASE_URL');
 if(!key||!url)return new Response('Server configuration missing',{status:500});
 if(request.headers.get('Authorization')!==`Bearer ${key}`)return new Response('Unauthorized',{status:401});
 const db=createClient(url,key,{auth:{persistSession:false}});
 let sent=0;
 try {
  const {data:jobs,error}=await db.from('push_outbox').select('message_id,attempts').is('sent_at',null).lt('attempts',5).order('created_at').limit(100);
  if(error)throw error;
  for(const job of jobs||[]){
   // Optimistic claim avoids two overlapping invocations sending the same attempt.
   const claim=await db.from('push_outbox').update({attempts:job.attempts+1,processing_until:new Date(Date.now()+60000).toISOString()}).eq('message_id',job.message_id).eq('attempts',job.attempts).is('sent_at',null).or(`processing_until.is.null,processing_until.lt.${new Date().toISOString()}`).select('message_id');
   if(claim.error)throw claim.error;if(!claim.data?.length)continue;
   const {data:m,error:me}=await db.from('messages').select('sender_id,recipient_id,expires_at,read_at,delivered_at,status').eq('id',job.message_id).maybeSingle();if(me)throw me;
   const finish=async()=>{const r=await db.from('push_outbox').update({sent_at:new Date().toISOString()}).eq('message_id',job.message_id);if(r.error)throw r.error;};
   if(!m || m.status!=='ready' || m.delivered_at || m.read_at || (m.expires_at && new Date(m.expires_at).getTime()<=Date.now())){await finish();continue;}
   const blocks=await db.from('blocked_contacts').select('owner_id').or(`and(owner_id.eq.${m.sender_id},peer_id.eq.${m.recipient_id}),and(owner_id.eq.${m.recipient_id},peer_id.eq.${m.sender_id})`).limit(1);
   if(blocks.error)throw blocks.error;if(blocks.data?.length){await finish();continue;}
   const {data:device,error:de}=await db.from('push_devices').select('token').eq('user_id',m.recipient_id).maybeSingle();if(de)throw de;if(!device){await finish();continue;}
   const response=await fetch('https://exp.host/--/api/v2/push/send',{method:'POST',headers:{'Content-Type':'application/json',...(Deno.env.get('EXPO_ACCESS_TOKEN')?{Authorization:`Bearer ${Deno.env.get('EXPO_ACCESS_TOKEN')}`}:{})},body:JSON.stringify({to:device.token,title:'Save Me',body:'New private message',sound:'default',channelId:'messages',data:{sender:m.sender_id,recipient:m.recipient_id,messageId:job.message_id},ttl:3600})});
   if(!response.ok)continue;
   const ticket=(await response.json()).data;
   if(ticket?.status==='ok'){const saved=await db.from('push_outbox').update({expo_ticket:ticket.id,last_error:null}).eq('message_id',job.message_id);if(saved.error)throw saved.error;await finish();sent++;}
   else if(ticket?.details?.error==='DeviceNotRegistered'){
    const removal=await db.from('push_devices').delete().eq('user_id',m.recipient_id).eq('token',device.token);if(removal.error)throw removal.error;await finish();
   } else {await db.from('push_outbox').update({last_error:ticket?.details?.error||'ExpoRejected'}).eq('message_id',job.message_id);}
  }
  return Response.json({sent});
 }catch{return new Response('Notification processing failed',{status:500});}
});
