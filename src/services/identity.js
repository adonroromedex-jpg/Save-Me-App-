import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { AppState } from 'react-native';
import { useStore } from '../store/useStore';
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
    const staged=await SecureStore.getItemAsync(`chat-restart-v1-${userId}`);
    if(staged){
      const draft=JSON.parse(staged);
      const remote=await db.rpc('get_chat_key',{p_peer:userId});if(remote.error)throw remote.error;
      await checkSession();
      if(remote.data===encode(keyPair(decode(draft.secret)).publicKey)){
        await installRestart(userId,draft.secret);secret=draft.secret;
      }
    }
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
  })().finally(() => {if(pending.get(userId)===work)pending.delete(userId);});
  pending.set(userId, work);
  return work;
}
const peerPending = new Map();
export function peerIdentity(userId, peerId) {
  const cacheId = `${userId}-${peerId}`;
  if (peerPending.has(cacheId)) return peerPending.get(cacheId);
  const work = readPeerIdentity(userId, peerId).finally(() => {if(peerPending.get(cacheId)===work)peerPending.delete(cacheId);});
  peerPending.set(cacheId, work);
  return work;
}
async function readPeerIdentity(userId, peerId) {
  const identity=await readPublicIdentity(peerId);
  const data=identity?.public_key;
  if (!data) throw new Error('Kontak sa a dwe ouvri nouvo vèsyon Save Me a anvan echanj chifre.');
  const name = `peer-key-${userId}-${peerId}`;
  const pinned = await SecureStore.getItemAsync(name);
  if ((pinned && pinned !== data) || (!pinned && identity.version>1)) {
    const error=new Error('Kle kontak la chanje. Nan meni chat la, ouvri Nimewo sekirite pou verifye epi aksepte nouvo kle a.');
    error.code='PEER_KEY_CHANGED';throw error;
  }
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


async function readPublicIdentity(peerId) {
  const {data,error}=await getSupabaseClient().rpc('get_chat_identity',{p_peer:peerId});
  if(error){
    if(['PGRST202','42883'].includes(error.code))throw new Error('Aplike SQL 20261005_identity_restart.sql nan Supabase anvan ou itilize vèsyon sa a.');
    throw error;
  }
  return data;
}
function requireRestartSession(userId){
  const state=useStore.getState();
  if(state.user?.id!==userId || state.isLocked || AppState.currentState!=='active')throw new Error('Ouvri kont ou ankò anvan rekòmansman an.');
}
async function installRestart(userId,secret){
  const name=`chat-identity-v1-${userId}`;
  const old=await SecureStore.getItemAsync(name);
  if(old && old!==secret){
    const tag=fingerprint(encode(keyPair(decode(old)).publicKey)).replace(/ /g,'');
    await SecureStore.setItemAsync(`chat-identity-archive-${userId}-${tag}`,old,options);
  }
  await SecureStore.setItemAsync(name,secret,options);
  await SecureStore.deleteItemAsync(`chat-restart-v1-${userId}`);
}
// Called only after the explicit warning and a fresh email OTP verification.
export function restartIdentity(userId){
  if(restarts.has(userId))return restarts.get(userId);
  const before=pending.get(userId);
  const work=(async()=>{
    if(before)await before.catch(()=>{});
    requireRestartSession(userId);
    const db=getSupabaseClient();
    const {data:session,error}=await db.auth.getSession();if(error)throw error;
    if(session.session?.user?.id!==userId)throw new Error('Sesyon an chanje.');
    const remote=await readPublicIdentity(userId);
    if(!remote?.public_key)throw new Error('Kle kont lan poko anrejistre.');
    const old=await SecureStore.getItemAsync(`chat-identity-v1-${userId}`);
    if(old && encode(keyPair(decode(old)).publicKey)===remote.public_key)return {secretKey:keyPair(decode(old)).secretKey,publicKey:remote.public_key};
    const name=`chat-restart-v1-${userId}`;
    const saved=await SecureStore.getItemAsync(name);
    let draft=saved?JSON.parse(saved):null;
    if(draft && encode(keyPair(decode(draft.secret)).publicKey)===remote.public_key){
      await installRestart(userId,draft.secret);
      return {secretKey:keyPair(decode(draft.secret)).secretKey,publicKey:remote.public_key};
    }
    if(draft && draft.expected!==remote.public_key)throw new Error('Kle a chanje sou sèvè a. Kontakte sipò anvan ou re-eseye.');
    if(!draft){draft={expected:remote.public_key,secret:encode(await Crypto.getRandomBytesAsync(32))};await SecureStore.setItemAsync(name,JSON.stringify(draft),options);}
    requireRestartSession(userId);
    const pair=keyPair(decode(draft.secret)),publicKey=encode(pair.publicKey);
    const result=await db.rpc('restart_chat_identity',{p_expected:draft.expected,p_key:publicKey});
    if(result.error)throw result.error;
    if(result.data!==publicKey)throw new Error('Rekòmansman an pa konfime.');
    // Finish durable local storage even if the app locks after the server commits.
    await installRestart(userId,draft.secret);
    return {secretKey:pair.secretKey,publicKey};
  })().finally(()=>{restarts.delete(userId);if(pending.get(userId)===work)pending.delete(userId);});
  restarts.set(userId,work);pending.set(userId,work);return work;
}
const restarts=new Map();
export async function peerKeyReview(userId,peerId){
  const own=await ensureIdentity(userId),remote=await readPublicIdentity(peerId);
  if(!remote?.public_key)throw new Error('Kontak la poko gen kle sekirite.');
  const pinned=await SecureStore.getItemAsync(`peer-key-${userId}-${peerId}`);
  return {key:remote.public_key,changed:pinned?pinned!==remote.public_key:remote.version>1,
    numbers:[fingerprint(own.publicKey),fingerprint(remote.public_key)].sort().join('\n\n')};
}
export function acceptPeerIdentity(userId,peerId,expected){
  const cacheId=`${userId}-${peerId}`,before=peerPending.get(cacheId);
  const work=(async()=>{
    if(before)await before.catch(()=>{});
    requireRestartSession(userId);
    const remote=await readPublicIdentity(peerId);
    if(remote?.public_key!==expected)throw new Error('Kle a chanje ankò. Verifye nouvo nimewo sekirite yo.');
    requireRestartSession(userId);
    await SecureStore.setItemAsync(`peer-key-${userId}-${peerId}`,expected,options);
    return expected;
  })().finally(()=>{if(peerPending.get(cacheId)===work)peerPending.delete(cacheId);});
  peerPending.set(cacheId,work);return work;
}
