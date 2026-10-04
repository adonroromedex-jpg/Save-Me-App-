// This version's profile picture stays on this device, encrypted at rest.
import * as FileSystem from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { gcm } from '@noble/ciphers/aes';
import { encode, decode } from './cryptoCore';
import { useStore } from '../store/useStore';
const filename = id => `${FileSystem.documentDirectory}profile-photo-${id}.json`;
const keyName = id => `profile-photo-key-${id}`;
const check = id => { const state=useStore.getState(); if(state.isLocked || state.user?.id!==id) throw new Error('Ouvri app la ankò.'); };
export async function saveProfilePhoto(id, asset) {
  check(id);
  const info = await FileSystem.getInfoAsync(asset.uri, {size:true});
  if(!info.exists || info.size > 2*1024*1024) throw new Error('Chwazi yon foto pwofil ki pi piti (2 MB maksimòm).');
  let stored = await SecureStore.getItemAsync(keyName(id));
  if(!stored) { stored=encode(await Crypto.getRandomBytesAsync(32)); await SecureStore.setItemAsync(keyName(id),stored,{keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY}); }
  const key=decode(stored), nonce=await Crypto.getRandomBytesAsync(12);
  const plain=decode(await FileSystem.readAsStringAsync(asset.uri,{encoding:'base64'}));
  try {
    const record={nonce:encode(nonce),cipher:encode(gcm(key,nonce).encrypt(plain)),mime:asset.mimeType==='image/png'?'image/png':'image/jpeg'};
    check(id);
    await FileSystem.writeAsStringAsync(filename(id),JSON.stringify(record));
  } finally { key.fill(0); plain.fill(0); }
}
export async function loadProfilePhoto(id) {
  check(id);
  if(!(await FileSystem.getInfoAsync(filename(id))).exists) return null;
  const stored=await SecureStore.getItemAsync(keyName(id));
  if(!stored) return null;
  const record=JSON.parse(await FileSystem.readAsStringAsync(filename(id)));
  const key=decode(stored); let plain;
  try { plain=gcm(key,decode(record.nonce)).decrypt(decode(record.cipher)); check(id); return `data:${record.mime};base64,${encode(plain)}`; }
  finally { key.fill(0); plain?.fill(0); }
}
