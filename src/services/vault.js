import * as FileSystem from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { gcm } from '@noble/ciphers/aes';
import { utf8ToBytes, bytesToUtf8 } from '@noble/hashes/utils';
import { encode, decode } from './cryptoCore';
import { unlockVaultKey } from './vaultCode';
import { prepareManifest, encryptedPart, assemblePrivateFile, removePrivateFile, clearPrivateCache, privateCache } from './privateFiles';
import { useStore } from '../store/useStore';
import { AppState } from 'react-native';
const ROOT = `${FileSystem.documentDirectory}private-vault/`;
const indexKey = id => `vault-index-${id}`;
const requireActive = userId => { if (AppState.currentState !== 'active' || useStore.getState().isLocked || useStore.getState().user?.id!==userId) throw new Error('Ouvri app la ankò.'); };
export async function listVaultFiles(id) { return JSON.parse((await AsyncStorage.getItem(indexKey(id))) || '[]'); }
export async function importVaultFile(userId, asset, pin, onProgress = () => {}) {
  requireActive(userId);
  if (!['image','video'].includes(asset.type)) throw new Error('Chwazi yon foto oswa videyo.');
  const master = await unlockVaultKey(userId,pin);
  const manifest = await prepareManifest(asset);
  const directory = `${ROOT}${userId}-${manifest.id}/`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates:true });
  try {
    for (let i=0;i<manifest.chunks;i++) { requireActive(userId); await encryptedPart(asset.uri,manifest,i,`${directory}${i}.bin`); onProgress(Math.round((i+1)/manifest.chunks*100)); }
    const nonce = await Crypto.getRandomBytesAsync(12);
    const item = { id:manifest.id,type:asset.type,size:manifest.size,createdAt:new Date().toISOString(),
      nonce:encode(nonce),sealed:encode(gcm(master,nonce).encrypt(utf8ToBytes(JSON.stringify(manifest)))) };
    requireActive(userId);
    const next = [item,...await listVaultFiles(userId)];
    await AsyncStorage.setItem(indexKey(userId),JSON.stringify(next));
    return next;
  } catch(e) { await FileSystem.deleteAsync(directory,{idempotent:true}); throw e; }
  finally { master.fill(0); }
}
export async function openVaultFile(userId,item,pin,onProgress = () => {}) {
  requireActive(userId);
  const master = await unlockVaultKey(userId,pin);
  try {
    if (item.sealed) {
      const manifest = JSON.parse(bytesToUtf8(gcm(master,decode(item.nonce)).decrypt(decode(item.sealed))));
      if (manifest.id !== item.id) throw new Error('Invalid vault manifest');
      return await assemblePrivateFile(manifest, async i => { const part = decode(await FileSystem.readAsStringAsync(`${ROOT}${userId}-${item.id}/${i}.bin`,{encoding:'base64'})); onProgress(Math.round((i+1)/manifest.chunks*100)); return part; }, ()=>requireActive(userId));
    }
    // Read pre-v2 vault entries with the migrated master key, without discarding user files.
    const ciphertext=decode(await FileSystem.readAsStringAsync(`${ROOT}${userId}-${item.id}.bin`,{encoding:'base64'}));
    const nonce=new Uint8Array(item.nonce.match(/../g).map(x=>parseInt(x,16)));
    const plain=gcm(master,nonce).decrypt(ciphertext);
    requireActive(userId);
    await FileSystem.makeDirectoryAsync(privateCache,{intermediates:true});
    const uri=`${privateCache}legacy-${Crypto.randomUUID()}.${item.type==='video'?'mp4':'jpg'}`;
    await FileSystem.writeAsStringAsync(uri,encode(plain),{encoding:'base64'}); plain.fill(0);
    try { requireActive(userId); return uri; } catch(e) { await removePrivateFile(uri); throw e; }
  } finally { master.fill(0); }
}
export const removeVaultPreview=removePrivateFile;
export async function clearVaultPreviews() {
  await clearPrivateCache();
  // Remove only app-owned capture/import scratch directories after an interrupted session.
  await Promise.all(['Camera','ImagePicker','Audio'].map(name => FileSystem.deleteAsync(`${FileSystem.cacheDirectory}${name}`, { idempotent: true })));
  const names=await FileSystem.readDirectoryAsync(FileSystem.cacheDirectory);
  await Promise.all(names.filter(n=>n.startsWith('vault-preview-')).map(n=>FileSystem.deleteAsync(`${FileSystem.cacheDirectory}${n}`,{idempotent:true})));
}
export async function deleteVaultFile(userId,item) {
  await FileSystem.deleteAsync(`${ROOT}${userId}-${item.id}${item.sealed?'/':'.bin'}`,{idempotent:true});
  const next=(await listVaultFiles(userId)).filter(x=>x.id!==item.id);
  await AsyncStorage.setItem(indexKey(userId),JSON.stringify(next)); return next;
}
export async function removePickerCopy(asset) {
  if(asset?.uri?.startsWith(FileSystem.cacheDirectory)) await FileSystem.deleteAsync(asset.uri,{idempotent:true});
}
