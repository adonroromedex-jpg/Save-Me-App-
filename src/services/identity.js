import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { getSupabaseClient } from './supabase';
import { keyPair, encode, decode, fingerprint, seal, unseal } from './cryptoCore';

const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
const pending = new Map();
export function ensureIdentity(userId) {
  if (pending.has(userId)) return pending.get(userId);
  const work = (async () => {
    const db=getSupabaseClient();
    const checkSession=async()=>{
      const {data,error}=await db.auth.getSession();
      if(error)throw error;
      if(data.session?.user?.id!==userId)throw new Error('Sesyon kont lan chanje. Konekte ak kont ou ankò.');
    };
    await checkSession();
    const name = `chat-identity-v1-${userId}`;
    let secret = await SecureStore.getItemAsync(name);
    if (!secret) {
      const registered=await db.rpc('get_chat_key',{p_peer:userId});
      if(registered.error)throw registered.error;
      await checkSession();
      if(registered.data){
        const error=new Error('Kle prive kont sa a pa sou telefòn sa a. Ouvri kont lan sou aparèy orijinal li. Pa efase done app la.');
        error.code='IDENTITY_KEY_MISSING';throw error;
      }
      secret = encode(await Crypto.getRandomBytesAsync(32));
      await SecureStore.setItemAsync(name, secret, options);
    }
    const pair = keyPair(decode(secret));
    const publicKey = encode(pair.publicKey);
    await checkSession();
    const { data, error } = await db.rpc('register_chat_key', { p_key: publicKey });
    if (error) throw error;
    await checkSession();
    if (data !== publicKey) {
      const error=new Error('Kle lokal kont sa a pa koresponn ak kle ki anrejistre a. Verifye kont ou sou chak telefòn. Pa dezenstale app la ni efase done li yo.');
      error.code='IDENTITY_KEY_MISMATCH';throw error;
    }
    return { secretKey: pair.secretKey, publicKey };
  })().finally(() => pending.delete(userId));
  pending.set(userId, work);
  return work;
}
const peerPending = new Map();
export function peerIdentity(userId, peerId) {
  const cacheId = `${userId}-${peerId}`;
  if (peerPending.has(cacheId)) return peerPending.get(cacheId);
  const work = readPeerIdentity(userId, peerId).finally(() => peerPending.delete(cacheId));
  peerPending.set(cacheId, work);
  return work;
}
async function readPeerIdentity(userId, peerId) {
  const { data, error } = await getSupabaseClient().rpc('get_chat_key', { p_peer: peerId });
  if (error) throw error;
  if (!data) throw new Error('Kontak sa a dwe ouvri nouvo vèsyon Save Me a anvan echanj chifre.');
  const name = `peer-key-${userId}-${peerId}`;
  const pinned = await SecureStore.getItemAsync(name);
  if (pinned && pinned !== data) throw new Error('Kle sekirite kontak la chanje. Echanj la bloke pou pwoteje ou.');
  if (!pinned) await SecureStore.setItemAsync(name, data, options);
  return data;
}
export async function encryptForPair(userId, peerId, value) {
  const [own, peer] = await Promise.all([ensureIdentity(userId), peerIdentity(userId, peerId)]);
  return {
    sender_key: own.publicKey, recipient_key: peer,
    sender: seal(value, own.publicKey, own.secretKey, await Crypto.getRandomBytesAsync(24)),
    recipient: seal(value, peer, own.secretKey, await Crypto.getRandomBytesAsync(24)),
  };
}
export async function decryptForSelf(userId, row, envelopes) {
  const isSender = row.sender_id === userId;
  const peerId = isSender ? row.recipient_id : row.sender_id;
  const [own, peer] = await Promise.all([ensureIdentity(userId), peerIdentity(userId, peerId)]);
  if (envelopes.sender_key !== (isSender ? own.publicKey : peer) || envelopes.recipient_key !== (isSender ? peer : own.publicKey)) {
    throw new Error('Kle mesaj la pa koresponn ak kontak verifye a.');
  }
  const value = unseal(isSender ? envelopes.sender : envelopes.recipient, envelopes.sender_key, own.secretKey);
  if (!value || typeof value !== 'object' || value.id !== row.id || value.sender !== row.sender_id || value.recipient !== row.recipient_id) throw new Error('Mesaj modifye.');
  return value;
}
export async function securityNumbers(userId, peerId) {
  return [fingerprint((await ensureIdentity(userId)).publicKey), fingerprint(await peerIdentity(userId, peerId))].sort().join('\n\n');
}
