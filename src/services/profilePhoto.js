import { privateCache, removePrivateFile } from './privateFiles';
import * as ImageManipulator from 'expo-image-manipulator';
// Local encrypted thumbnail; explicit profile sharing uses pair-encrypted cards.
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
  const thumbnail=await ImageManipulator.manipulateAsync(asset.uri,[{resize:{width:96,height:96}}],{compress:0.65,format:ImageManipulator.SaveFormat.JPEG,base64:true});
  const plain=decode(thumbnail.base64);
  try {
    const record={nonce:encode(nonce),cipher:encode(gcm(key,nonce).encrypt(plain)),mime:'image/jpeg'};
    check(id);
    await FileSystem.writeAsStringAsync(filename(id),JSON.stringify(record));
    useStore.getState().profileChanged();
  } finally { key.fill(0); plain.fill(0); await FileSystem.deleteAsync(thumbnail.uri,{idempotent:true}); }
}
export async function loadProfilePhoto(id) {
  check(id);
  if(!(await FileSystem.getInfoAsync(filename(id))).exists) return null;
  const stored=await SecureStore.getItemAsync(keyName(id));
  if(!stored) return null;
  const record=JSON.parse(await FileSystem.readAsStringAsync(filename(id)));
  const key=decode(stored); let plain;
  try {
    plain=gcm(key,decode(record.nonce)).decrypt(decode(record.cipher));check(id);
    if(plain.length>9000 || record.mime!=='image/jpeg') {
      await FileSystem.makeDirectoryAsync(privateCache,{intermediates:true});
      const uri=`${privateCache}avatar-${Crypto.randomUUID()}.jpg`;
      try {await FileSystem.writeAsStringAsync(uri,encode(plain),{encoding:'base64'});await saveProfilePhoto(id,{uri,mimeType:record.mime});}
      finally {await removePrivateFile(uri);}
      // Read the new record without another migration loop.
      const small=JSON.parse(await FileSystem.readAsStringAsync(filename(id)));
      const bytes=gcm(key,decode(small.nonce)).decrypt(decode(small.cipher));
      try {check(id);return `data:image/jpeg;base64,${encode(bytes)}`;} finally {bytes.fill(0);}
    }
    return `data:${record.mime};base64,${encode(plain)}`;
  }
  finally { key.fill(0); plain?.fill(0); }
}
