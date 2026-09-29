import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system';
import { getSupabaseClient } from './supabase';
import { encryptForPair, decryptForSelf } from './identity';
import { prepareManifest, encryptedPart, assemblePrivateFile, privateCache, removePrivateFile } from './privateFiles';
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
    first_name: metadata.firstName || existing?.first_name || '',
    last_name: metadata.name || existing?.last_name || '',
    phone_e164: phone || existing?.phone_e164 || null,
  };
  requireData(await client().from('profiles').upsert(profile, { onConflict: 'id' }));
  return profile;
}

export async function updateProfile({ firstName, name, phoneNumber }) {
  const phone = normalizePhone(phoneNumber);
  if (!phone || !firstName.trim() || !name.trim()) throw new Error('Non, prenon ak nimewo konplè (+indicatif) obligatwa.');
  const { data: { user }, error } = await client().auth.updateUser({ data: {
    firstName: firstName.trim(), name: name.trim(), phoneNumber: phone,
  } });
  if (error) throw error;
  requireData(await client().from('profiles').upsert({
    id: user.id, first_name: firstName.trim(), last_name: name.trim(), phone_e164: phone,
  }, { onConflict: 'id' }));
  return user;
}

export async function lookupContact(phone) {
  const formatted = normalizePhone(phone);
  if (!formatted) throw new Error('Mete indicatif la devan nimewo a, egzanp +509...');
  const data = requireData(await client().rpc('find_contact', { p_phone: formatted }));
  return data?.[0] || null;
}

const fields = 'id,sender_id,recipient_id,body,encrypted_body,media_path,media_kind,media_parts,status,created_at,expires_at';
export async function listConversations(userId) {
  const [messages, peers] = await Promise.all([
    client().from('messages').select(fields).or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .eq('status', 'ready').order('created_at', { ascending: false }).limit(500),
    client().rpc('message_peers'),
  ]);
  const names = new Map(requireData(peers).map(p => [p.id, p]));
  const latest = new Map();
  requireData(messages).forEach(m => {
    const id = m.sender_id === userId ? m.recipient_id : m.sender_id;
    if (!latest.has(id)) latest.set(id, { peer: names.get(id) || { id }, last: m });
  });
  return [...latest.values()];
}
export async function listMessages(userId, peerId, before = null) {
  let query = client().from('messages').select(fields)
    .or(`and(sender_id.eq.${userId},recipient_id.eq.${peerId}),and(sender_id.eq.${peerId},recipient_id.eq.${userId})`)
    .eq('status','ready').order('created_at', { ascending: false }).order('id', { ascending: false }).limit(50);
  if (before) query = query.lt('created_at', before);
  const rows = requireData(await query);
  return Promise.all(rows.map(async m => {
    if (!m.encrypted_body) return { ...m, legacy: !m.media_parts };
    try {
      const payload = await decryptForSelf(userId, m, m.encrypted_body);
      if (typeof payload.text !== 'string' || !payload.text.length || payload.text.length > 4000) throw new Error('Mesaj modifye.');
      return { ...m, body: payload.text };
    } catch (e) { return { ...m, body: null, decryptError: e.message }; }
  }));
}
export async function sendText(userId, peerId, body) {
  const text = body.trim();
  if (!text) return;
  if (text.length > 4000) throw new Error('Mesaj la twò long.');
  const id = Crypto.randomUUID();
  const envelopes = await encryptForPair(userId, peerId, { id, sender: userId, recipient: peerId, text });
  return requireData(await client().rpc('send_encrypted_text', { p_id: id, p_peer: peerId, p_envelopes: envelopes }));
}
const requireActive = () => {
  if (AppState.currentState !== 'active' || useStore.getState().isLocked || !useStore.getState().isAuthenticated) throw new Error('Operasyon an kanpe. Ouvri app la ankò.');
};
export async function sendMedia(userId, peerId, asset, pin, onProgress = () => {}) {
  requireActive();
  if (!['image','video','audio'].includes(asset.type)) throw new Error('Fòma sa a pa sipòte.');
  if (asset.type !== 'audio' && !/^\d{6}$/.test(pin || '')) throw new Error('Mete yon kòd 6 chif.');
  const id = Crypto.randomUUID();
  const manifest = await prepareManifest(asset, id);
  const envelopes = await encryptForPair(userId, peerId, { ...manifest, sender: userId, recipient: peerId });
  const path = requireData(await client().rpc('stage_encrypted_media', {
    p_id: id, p_peer: peerId, p_kind: asset.type, p_parts: manifest.chunks, p_envelopes: envelopes, p_pin: pin || null,
  }));
  await FileSystem.makeDirectoryAsync(privateCache, { intermediates: true });
  const temporary = `${privateCache}upload-${id}.bin`;
  const uploaded = [];
  try {
    for (let index = 0; index < manifest.chunks; index++) {
      requireActive();
      await encryptedPart(asset.uri, manifest, index, temporary);
      const { data: { session }, error } = await client().auth.getSession();
      if (error) throw error;
      if (!session) throw new Error('Konekte ankò.');
      const object = `${path}/${index}.bin`;
      // Include uncertain uploads in cleanup too: the server may have accepted bytes before a network error.
      uploaded.push(object);
      const result = await FileSystem.uploadAsync(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/chat-media/${object}`, temporary, {
        httpMethod: 'POST', uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: { Authorization: `Bearer ${session.access_token}`, apikey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
          'Content-Type': 'application/octet-stream', 'x-upsert': 'false' },
      });
      if (result.status < 200 || result.status >= 300) throw new Error(`Upload echwe (${result.status}).`);
      onProgress(Math.round((index + 1) / manifest.chunks * 100));
    }
    requireActive();
    requireData(await client().rpc('finish_encrypted_media', { p_id: id }));
  } catch (error) {
    try {
      if (uploaded.length) requireData(await client().storage.from('chat-media').remove(uploaded));
      await client().rpc('cancel_encrypted_media', { p_id: id });
    } catch {} // Pending rows are also swept by the scheduled server cleanup.
    throw error;
  } finally { await removePrivateFile(temporary); }
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
  requireActive();
  if (!message.media_parts) throw new Error('Ansyen medya sa a pa itilize nouvo pwoteksyon an. Voye li ankò.');
  const grant = checkAuthorization(requireData(await client().rpc('unlock_media', { p_id: message.id, p_pin: pin || null })));
  const manifest = await decryptForSelf(userId, message, grant.envelopes);
  if (manifest.chunks !== grant.parts || manifest.kind !== message.media_kind) throw new Error('Medya modifye.');
  let authorization = await authorizeMedia(message.id);
  let checked = performance.now();
  const assertAllowed = async () => {
    requireActive();
    if (performance.now() >= authorization.deadline) throw new Error('Medya ekspire.');
    if (performance.now() - checked > 5000) { authorization = await authorizeMedia(message.id); checked = performance.now(); }
  };
  const uri = await assemblePrivateFile(manifest, async index => {
    const { signedUrl } = requireData(await client().storage.from('chat-media').createSignedUrl(`${grant.path}/${index}.bin`, 15));
    const temporary = `${privateCache}download-${Crypto.randomUUID()}.bin`;
    try {
      const result = await FileSystem.downloadAsync(signedUrl, temporary);
      if (result.status !== 200) throw new Error('Telechajman echwe.');
      onProgress(Math.round((index + 1) / manifest.chunks * 100));
      return decode(await FileSystem.readAsStringAsync(temporary, { encoding: 'base64' }));
    } finally { await removePrivateFile(temporary); }
  }, assertAllowed);
  try {
    authorization = await authorizeMedia(message.id);
    requireActive();
    return { uri, message, deadline: authorization.deadline };
  } catch (e) { await removePrivateFile(uri); throw e; }
}
export async function setContactBlocked(userId, peerId, blocked) {
  const result = blocked ? await client().from('blocked_contacts').upsert({ owner_id: userId, peer_id: peerId })
    : await client().from('blocked_contacts').delete().eq('owner_id', userId).eq('peer_id', peerId);
  requireData(result);
}
