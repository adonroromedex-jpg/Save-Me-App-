import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useStore } from '../store/useStore';
import { getSupabaseClient } from '../services/supabase';
import { markMessages } from '../services/messages';
import { Notifications } from '../services/notifications';
export default function useIncomingMessages() {
 const id=useStore(s=>s.user?.id),{t}=useTranslation();
 useEffect(()=>{
  if(!id)return;let alive=true,busy=false;const startedAt=Date.now();const seen=new Set();const db=getSupabaseClient();
  const open=notification=>{const data=notification?.request?.content?.data;if(data?.recipient===id && data?.sender)useStore.getState().openPeer(data.sender);};
  const response=Notifications.addNotificationResponseReceivedListener(event=>open(event.notification));
  Notifications.getLastNotificationResponseAsync().then(event=>{if(alive && event)open(event.notification);}).catch(()=>{});
  const poll=async()=>{
   if(!alive || busy || AppState.currentState!=='active')return;busy=true;
   try {
    const {data,error}=await db.from('messages').select('id,sender_id,created_at,read_at').eq('recipient_id',id).eq('status','ready').is('delivered_at',null).limit(100);
    if(error)throw error;if(!alive)return;
    if(data.length){
     await markMessages(data.map(m=>m.id));
     const fresh=data.filter(m=>!m.read_at && Date.parse(m.created_at)>=startedAt && !seen.has(m.id));data.forEach(m=>seen.add(m.id));while(seen.size>500)seen.delete(seen.values().next().value);
     const other=fresh.filter(m=>useStore.getState().activeChat!==m.sender_id || useStore.getState().isLocked);
     const permission=await Notifications.getPermissionsAsync();
     if(other.length && permission.granted && alive)await Notifications.scheduleNotificationAsync({identifier:`message-${other[0].id}`,content:{title:'Save Me',body:t('newPrivateMessage'),sound:'default',data:{sender:other[0].sender_id,recipient:id,messageId:other[0].id}},trigger:null});
    }
    // Dismiss OS notifications after their message is read, deleted or expired.
    // Older builds supplied only a sender: retain those only while that thread is unread.
    const presented=await Notifications.getPresentedNotificationsAsync();
    for(const notification of presented){
      if(!alive)return;
      const info=notification.request.content.data || {};
      if(info.recipient!==id)continue;
      if(!info.messageId && !info.sender)continue;
      const unread=await db.rpc('count_unread_messages',{p_sender:info.sender||null,p_message:info.messageId||null});if(unread.error)throw unread.error;
      if(!unread.data && alive)await Notifications.dismissNotificationAsync(notification.request.identifier);
    }
    const result=await db.rpc('count_unread_messages');
    if(result.error)throw result.error;
    if(alive){useStore.getState().setSyncIssue('chat',null);useStore.getState().setUnread(result.data||0);Notifications.setBadgeCountAsync(result.data||0).catch(()=>{});}
   }catch(error){if(alive)useStore.getState().setSyncIssue('chat',{code:error.code||'',message:error.message});}
   finally{busy=false;}
  };
  const channel=db.channel(`inbox-${id}`).on('postgres_changes',{event:'*',schema:'public',table:'messages',filter:`recipient_id=eq.${id}`},poll).subscribe();
  const timer=setInterval(poll,3000),state=AppState.addEventListener('change',s=>{if(s==='active')poll();});poll();
  return()=>{alive=false;clearInterval(timer);state.remove();response.remove();db.removeChannel(channel);};
 },[id,t]);
}
