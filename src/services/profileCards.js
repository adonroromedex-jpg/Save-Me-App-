import { getSupabaseClient } from './supabase';
import { encryptForPair, decryptForSelf } from './identity';
import { loadProfilePhoto } from './profilePhoto';
import { useStore } from '../store/useStore';
const sent = new Map();
export async function shareProfile(peerId) {
 const state=useStore.getState(),user=state.user;if(!user || state.isLocked)return;
 const signature=`${user.id}:${peerId}:${user.firstName}:${user.name}:${state.profileRevision}`;
 if(sent.has(signature))return;
 const image=await loadProfilePhoto(user.id);
 // Small thumbnails only; no full gallery images are put in a profile envelope.
 const avatar=image && image.length<=14000 ? image : null;
 const value={id:user.id,sender:user.id,recipient:peerId,avatar};
 const envelopes=await encryptForPair(user.id,peerId,value);
 const {error}=await getSupabaseClient().rpc('set_chat_profile',{p_peer:peerId,p_envelopes:envelopes});
 if(error)throw error;
 sent.set(signature,true);while(sent.size>300)sent.delete(sent.keys().next().value);
}
export async function peerProfilePhoto(userId,peerId) {
 const {data,error}=await getSupabaseClient().from('chat_profile_cards').select('envelopes').eq('owner_id',peerId).eq('peer_id',userId).maybeSingle();
 if(error)throw error;if(!data)return null;
 const value=await decryptForSelf(userId,{id:peerId,sender_id:peerId,recipient_id:userId},data.envelopes);
 return typeof value.avatar==='string' && value.avatar.length<=14000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(value.avatar)?value.avatar:null;
}
export async function shareProfileWithContacts() {
 const {data,error}=await getSupabaseClient().rpc('chat_threads_list');if(error)throw error;
 for(const peer of data||[])await shareProfile(peer.id);
}
