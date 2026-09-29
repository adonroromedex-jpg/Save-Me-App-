import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system';
import { toByteArray } from 'base64-js';
import { getSupabaseClient } from './supabase';

const client = () => getSupabaseClient();
const MAX_BYTES = 20 * 1024 * 1024;
const requireData = ({ data, error }) => { if (error) throw error; return data; };

export function normalizePhone(number, fallbackCode = '') {
  const cleaned = (number || '').replace(/[\s().-]/g, '');
  const phone = cleaned.startsWith('+') ? cleaned : `${fallbackCode}${cleaned.replace(/^0+/, '')}`;
  return /^\+[1-9]\d{6,14}$/.test(phone) ? phone : null;
}

export async function syncProfile(user) {
  const existing = requireData(await client().from('profiles').select('id').eq('id', user.id).maybeSingle());
  if (existing) return existing;
  const phone = normalizePhone(user.user_metadata?.phoneNumber || '');
  return requireData(await client().from('profiles').upsert({
    id: user.id,
    first_name: user.user_metadata?.firstName || '',
    last_name: user.user_metadata?.name || '',
    phone_e164: phone,
  }, { onConflict: 'id', ignoreDuplicates: true }));
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

export async function listConversations(userId) {
  const [messages, peers] = await Promise.all([
    client().from('messages').select('id,sender_id,recipient_id,body,media_kind,created_at,expires_at')
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`).eq('status', 'ready')
      .order('created_at', { ascending: false }).limit(300),
    client().rpc('message_peers'),
  ]);
  const rows = requireData(messages);
  const names = new Map(requireData(peers).map(p => [p.id, p]));
  const latest = new Map();
  rows.forEach(m => {
    if (new Date(m.expires_at).getTime() <= Date.now()) return;
    const id = m.sender_id === userId ? m.recipient_id : m.sender_id;
    if (!latest.has(id)) latest.set(id, { peer: names.get(id) || { id }, last: m });
  });
  return [...latest.values()];
}

export async function listMessages(userId, peerId) {
  const rows = requireData(await client().from('messages')
    .select('id,sender_id,recipient_id,body,media_path,media_kind,status,created_at,expires_at')
    .or(`and(sender_id.eq.${userId},recipient_id.eq.${peerId}),and(sender_id.eq.${peerId},recipient_id.eq.${userId})`)
    .eq('status', 'ready').order('created_at', { ascending: true }).limit(200));
  return rows.filter(m => new Date(m.expires_at).getTime() > Date.now());
}

export async function sendText(userId, peerId, body) {
  if (!body.trim()) return;
  return requireData(await client().from('messages')
    .insert({ sender_id: userId, recipient_id: peerId, body: body.trim() })
    .select('id').single());
}

export async function sendMedia(userId, peerId, asset) {
  const kind = asset.type;
  const mime = asset.mimeType || (kind === 'video' ? 'video/mp4' : 'image/jpeg');
  const extensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'video/mp4': 'mp4', 'video/quicktime': 'mov' };
  const extension = extensions[mime];
  if (!extension || !['image','video'].includes(kind)) throw new Error('Fòma foto/videyo sa a pa sipòte.');
  const info = await FileSystem.getInfoAsync(asset.uri, { size: true });
  if (info.size > MAX_BYTES) throw new Error('Limit pataj la se 20 MB.');
  const id = Crypto.randomUUID();
  const path = `${userId}/${id}.${extension}`;
  requireData(await client().from('messages').insert({
    id, sender_id: userId, recipient_id: peerId, media_kind: kind, media_path: path, status: 'uploading',
  }));
  try {
    const data = toByteArray(await FileSystem.readAsStringAsync(asset.uri, { encoding: 'base64' }));
    if (data.byteLength > MAX_BYTES) throw new Error('Limit pataj la se 20 MB.');
    requireData(await client().storage.from('chat-media').upload(path, data.buffer, { contentType: mime, upsert: false }));
    requireData(await client().from('messages').update({ status: 'ready' }).eq('id', id));
  } catch (error) {
    const cleanup = await client().storage.from('chat-media').remove([path]).catch(e => ({ error: e }));
    if (!cleanup.error) await client().from('messages').delete().eq('id', id);
    throw error;
  }
}

export async function mediaUrl(message) {
  const seconds = Math.min(60, Math.floor((new Date(message.expires_at).getTime() - Date.now()) / 1000));
  if (seconds < 1) throw new Error('Medya sa a ekspire.');
  const data = requireData(await client().storage.from('chat-media').createSignedUrl(message.media_path, seconds));
  return data.signedUrl;
}
