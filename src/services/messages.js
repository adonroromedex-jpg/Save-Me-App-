import {chunkUrlReader} from './chunkUrls';
import { transferTimer } from './transferMetrics';
import { transferQueue } from './transferQueue';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system';
import { getSupabaseClient } from './supabase';
import { encryptForPair, decryptForSelf } from './identity';
import { prepareManifest, encryptedPart, assemblePrivateFile, nativeFileCrypto, privateCache, removePrivateFile } from './privateFiles';
import { decode } from './cryptoCore';
import { useStore } from '../store/useStore';
import { AppState } from 'react-native';

const client = () => getSupabaseClient();
const requireData = ({ data, error }) => { if (error) throw error; return data; };

export function normalizePhone(number, fallbackCode = '') {
  const cleaned = String(number || '').replace(/[\s().-]/g, '').replace(/^00/, '+');
  const phone = cleaned.startsWith('+') ? cleaned : `${fallbackCode}${cleaned.replace(/^0+/, '')}`;
  return /^\+[1-9]\d{6,14}$/.test(phone) ? phone : null;
}

export async function syncProfile(user) {
  const existing = requireData(await client().from('profiles').select('id,first_name,last_name,phone_e164').eq('id', user.id).maybeSingle());
  const metadata = user.user_metadata || {};
  const phone = normalizePhone(metadata.phoneNumber || metadata.phone || '', metadata.countryCode || '');
  // Repair incomplete legacy profiles; do not erase a saved field when old metadata is missing.
  const profile = {
    id: user.id,
    first_name: existing?.first_name || metadata.firstName || metadata.first_name || '',
    last_name: existing?.last_name || metadata.name || metadata.last_name || '',
    phone_e164: existing?.phone_e164 || phone || null,
  };
  if (!existing || ['first_name','last_name','phone_e164'].some(key => existing[key] !== profile[key])) {
    const result = await client().from('profiles').upsert(profile, { onConflict: 'id' });
    // A legacy duplicate phone must never prevent this account from saving its own name.
    // Do not transfer the number from another account.
    if (result.error?.code === '23505' && !existing?.phone_e164) {
      profile.phone_e164 = null;
      requireData(await client().from('profiles').upsert(profile, { onConflict: 'id' }));
    } else requireData(result);
  }
  return profile;
}

// Registration supplies the phone once; profile editing changes names only.
export async function updateProfile({ firstName, name, phoneNumber }) {
  if (!firstName.trim() || !name.trim()) throw new Error('Non ak prenon obligatwa.');
  const session = requireData(await client().auth.getUser());
  if (!session.user) throw new Error('Konekte ankò.');
  const existing = requireData(await client().from('profiles').select('phone_e164').eq('id', session.user.id).maybeSingle());
  const phone = existing?.phone_e164 || normalizePhone(session.user.user_metadata?.phoneNumber || phoneNumber);
  const registering = phoneNumber !== undefined;
  if (registering && !phone) throw new Error('Mete nimewo konplè a pandan enskripsyon an.');
  const fields={firstName:firstName.trim(),name:name.trim()};
  if (registering) fields.phoneNumber=phone;
  const row={id:session.user.id,first_name:fields.firstName,last_name:fields.name};
  if (registering) row.phone_e164=phone;
  const saved=await client().from('profiles').upsert(row,{onConflict:'id'});
  if(saved.error?.code==='23505')throw new Error('Nimewo sa a deja asosye ak yon lòt kont. Konekte ak kont ki deja genyen li a.');
  requireData(saved);
  const current=useStore.getState().user;
  if(current && current.id!==session.user.id)throw new Error('Sesyon an chanje.');
  if(current){useStore.getState().patchUser(fields);useStore.getState().profileChanged();}
  const {error}=await client().auth.updateUser({data:fields});
  if(error)useStore.getState().setSyncIssue('profile',{code:error.code||'',message:error.message});
  const user={...session.user,user_metadata:{...session.user.user_metadata,...fields}};
  return user;
}

export async function lookupContact(phone) {
  const formatted = normalizePhone(phone);
  if (!formatted) throw new Error('Mete indicatif la devan nimewo a, egzanp +509...');
  const data = requireData(await client().rpc('find_contact', { p_phone: formatted }));
  return data?.[0] || null;
}

const fields = 'id,sender_id,recipient_id,body,encrypted_body,media_path,media_kind,media_parts,status,created_at,expires_at,delivered_at,read_at';
export async function listConversations(userId) {
  const threads=requireData(await client().rpc('chat_threads_list'));
  return threads.map(row=>({peer:{id:row.id,first_name:row.first_name,last_name:row.last_name},last:row.last||{created_at:row.last_activity},unread:Number(row.unread)}));
}
export async function markMessages(ids,read=false) {
 if(!ids.length)return;
 requireData(await client().rpc('mark_messages',{p_ids:ids.slice(0,150),p_read:read}));
}
export async function deleteTextMessage(id) { requireData(await client().rpc('delete_text_message',{p_id:id})); }

export async function listMessages(userId, peerId, before = null, decoded = new Map()) {
  let query = client().from('messages').select(fields)
    .or(`and(sender_id.eq.${userId},recipient_id.eq.${peerId}),and(sender_id.eq.${peerId},recipient_id.eq.${userId})`)
    .eq('status','ready').order('created_at', { ascending: false }).order('id', { ascending: false }).limit(50);
  if (before) query = query.lt('created_at', before);
  const rows = requireData(await query);
  if(useStore.getState().user?.id===userId)rows.filter(m=>m.sender_id===userId&&m.delivered_at).reverse().forEach(m=>useStore.getState().recordDelivery({id:m.id,kind:m.media_kind||'text',ms:Math.max(0,new Date(m.delivered_at).getTime()-new Date(m.created_at).getTime())}));
  return Promise.all(rows.map(async m => {
    if (!m.encrypted_body) return { ...m, legacy: !m.media_parts };
    try {
      const signature = JSON.stringify([userId,m.sender_id,m.recipient_id,m.encrypted_body]);
      const cached = decoded.get(m.id);
      if (cached?.signature === signature) return {...m,body:cached.text, decryptError:cached.error};
      const payload = await decryptForSelf(userId, m, m.encrypted_body);
      if (typeof payload.text !== 'string' || !payload.text.length || payload.text.length > 4000) throw new Error('Mesaj modifye.');
      decoded.set(m.id,{signature,text:payload.text});
      while(decoded.size>150) decoded.delete(decoded.keys().next().value);
      return { ...m, body: payload.text };
    } catch (e) {
      if(e.code==='OLD_KEY_GENERATION')decoded.set(m.id,{signature:JSON.stringify([userId,m.sender_id,m.recipient_id,m.encrypted_body]),text:null,error:e.message});
      while(decoded.size>150)decoded.delete(decoded.keys().next().value);
      return { ...m, body: null, decryptError: e.message };
    }
  }));
}
export async function sendText(userId, peerId, body) {
  const text = body.trim();
  if (!text) return;
  if (text.length > 4000) throw new Error('Mesaj la twò long.');
  const timer=transferTimer(userId,'text','send');
  const id = Crypto.randomUUID();
  const envelopes = await encryptForPair(userId, peerId, { id, sender: userId, recipient: peerId, text });
  timer.mark('prepare');
  const result = requireData(await client().rpc('send_encrypted_text', { p_id: id, p_peer: peerId, p_envelopes: envelopes }));
  timer.mark('transfer'); timer.finish(new TextEncoder().encode(text).length);
  return result;
}
const requireActive = (userId) => {
  if (AppState.currentState !== 'active' || useStore.getState().isLocked || !useStore.getState().isAuthenticated || (userId && useStore.getState().user?.id!==userId)) throw new Error('Operasyon an kanpe. Ouvri app la ankò.');
};
export async function sendMedia(userId, peerId, asset, pin, onProgress = () => {}) {
  requireActive(userId);
  const timer=transferTimer(userId,asset.type,'send'); onProgress(0,'prepare');
  if (!['image','video','audio'].includes(asset.type)) throw new Error('Fòma sa a pa sipòte.');
  if (asset.type !== 'audio' && !/^\d{6}$/.test(pin || '')) throw new Error('Mete yon kòd 6 chif.');
  const id = Crypto.randomUUID();
  const manifest = await prepareManifest(asset, id);
  const envelopes = await encryptForPair(userId, peerId, { ...manifest, sender: userId, recipient: peerId });
  const path = requireData(await client().rpc('stage_encrypted_media', {
    p_id: id, p_peer: peerId, p_kind: asset.type, p_parts: manifest.chunks, p_envelopes: envelopes, p_pin: pin || null,
  }));
  await FileSystem.makeDirectoryAsync(privateCache, { intermediates: true });
  timer.mark('prepare'); onProgress(0,'transfer');
  const uploaded = [];
  let completed = 0;
  try {
    const { data: { session }, error } = await client().auth.getSession();
    if (error) throw error;
    if (!session) throw new Error('Konekte ankò.');
    await transferQueue(manifest.chunks, async index => {
      const temporary = `${privateCache}upload-${id}-${index}.bin`;
      try {
      requireActive(userId);
      await encryptedPart(asset.uri, manifest, index, temporary);
      requireActive(userId);
      const object = `${path}/${index}.bin`;
      // Include uncertain uploads in cleanup too: the server may have accepted bytes before a network error.
      uploaded.push(object);
      const result = await FileSystem.uploadAsync(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/chat-media/${object}`, temporary, {
        httpMethod: 'POST', uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: { Authorization: `Bearer ${session.access_token}`, apikey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
          'Content-Type': 'application/octet-stream', 'x-upsert': 'false' },
      });
      if (result.status < 200 || result.status >= 300) throw new Error(`Upload echwe (${result.status}).`);
      onProgress(Math.round(++completed / manifest.chunks * 100),'transfer');
      } finally { await removePrivateFile(temporary); }
    });
    requireActive(userId);
    timer.mark('transfer'); onProgress(100,'validate');
    requireData(await client().rpc('finish_encrypted_media', { p_id: id }));
    timer.finish(manifest.size);
  } catch (error) {
    try {
      if (uploaded.length) requireData(await client().storage.from('chat-media').remove(uploaded));
      await client().rpc('cancel_encrypted_media', { p_id: id });
    } catch {} // Pending rows are also swept by the scheduled server cleanup.
    throw error;
  }
  return id;
}
function checkAuthorization(data) {
  if (data?.error) throw new Error(({ wrong_code: 'Kòd la pa kòrèk.', locked: 'Twòp tantativ. Tann 5 minit.', expired: 'Medya sa a ekspire oswa li pa disponib.', blocked: 'Kontak sa a bloke.' })[data.error] || 'Medya pa disponib.');
  return data;
}
export async function authorizeMedia(messageId) {
  const started = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  let data;
  try { data = checkAuthorization(requireData(await client().rpc('authorize_media', { p_id: messageId }).abortSignal(controller.signal))); }
  finally { clearTimeout(timeout); }
  const lifetime = data.expires_at ? new Date(data.expires_at).getTime() - new Date(data.server_now).getTime() : Infinity;
  return { ...data, deadline: performance.now() + lifetime - (performance.now() - started) };
}
export async function openMedia(userId, message, pin, onProgress = () => {}) {
  requireActive(userId);
  const timer=transferTimer(userId,message.media_kind,'receive'); onProgress(0,'prepare');
  if (!message.media_parts) throw new Error('Ansyen medya sa a pa itilize nouvo pwoteksyon an. Voye li ankò.');
  const unlockStarted=performance.now();
  const grant = checkAuthorization(requireData(await client().rpc('unlock_media', { p_id: message.id, p_pin: pin || null })));
  const manifest = await decryptForSelf(userId, message, grant.envelopes);
  if (manifest.chunks !== grant.parts || manifest.kind !== message.media_kind) throw new Error('Medya modifye.');
  // unlock_media already includes a fresh server authorization and server clock.
  const lifetime=grant.expires_at ? new Date(grant.expires_at).getTime()-new Date(grant.server_now).getTime() : Infinity;
  let authorization = {...grant,deadline:unlockStarted+lifetime};
  let checked = unlockStarted;
  const assertAllowed = async () => {
    requireActive(userId);
    if (performance.now() >= authorization.deadline) throw new Error('Medya ekspire.');
    if (performance.now() - checked > 5000) { authorization = await authorizeMedia(message.id); checked = performance.now(); }
  };
  timer.mark('prepare'); onProgress(0,'transfer');
  const getChunkUrl=chunkUrlReader(client().storage.from('chat-media'),grant.path,manifest.chunks);
  let completed=0;
  const uri = await assemblePrivateFile(manifest, async index => {
    const signedUrl=await getChunkUrl(index);
    const temporary = `${privateCache}download-${Crypto.randomUUID()}.bin`;
    let handedOff = false;
    try {
      const result = await FileSystem.downloadAsync(signedUrl, temporary);
      if (result.status !== 200) throw new Error('Telechajman echwe.');
      onProgress(Math.round(++completed / manifest.chunks * 100),'transfer');
      if(nativeFileCrypto()) { handedOff = true; return {uri:temporary}; }
      return decode(await FileSystem.readAsStringAsync(temporary, { encoding: 'base64' }));
    } finally { if(!handedOff) await removePrivateFile(temporary); }
  }, assertAllowed, 3);
  timer.mark('transfer'); onProgress(100,'validate');
  try {
    authorization = await authorizeMedia(message.id);
    requireActive(userId);
    timer.finish(manifest.size);
    return { uri, message, deadline: authorization.deadline };
  } catch (e) { await removePrivateFile(uri); throw e; }
}
export async function setContactBlocked(userId, peerId, blocked) {
  const result = blocked ? await client().from('blocked_contacts').upsert({ owner_id: userId, peer_id: peerId })
    : await client().from('blocked_contacts').delete().eq('owner_id', userId).eq('peer_id', peerId);
  requireData(result);
}
