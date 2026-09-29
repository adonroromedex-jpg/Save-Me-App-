import * as FileSystem from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { gcm } from '@noble/ciphers/aes';
import { fromByteArray, toByteArray } from 'base64-js';

const ROOT = `${FileSystem.documentDirectory}private-vault/`;
const MAX_BYTES = 20 * 1024 * 1024;
const hex = bytes => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
const bytes = value => new Uint8Array(value.match(/../g).map(x => parseInt(x, 16)));
const indexKey = userId => `vault-index-${userId}`;
const keyName = userId => `vault-key-${userId}`;

async function vaultKey(userId) {
  let key = await SecureStore.getItemAsync(keyName(userId));
  if (!key) {
    key = hex(await Crypto.getRandomBytesAsync(32));
    await SecureStore.setItemAsync(keyName(userId), key, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  }
  return bytes(key);
}

export async function listVaultFiles(userId) {
  return JSON.parse((await AsyncStorage.getItem(indexKey(userId))) || '[]');
}

export async function importVaultFile(userId, asset) {
  if (!asset.uri || !['image', 'video'].includes(asset.type)) throw new Error('Chwazi yon foto oswa videyo.');
  const info = await FileSystem.getInfoAsync(asset.uri, { size: true });
  if (info.size > MAX_BYTES) throw new Error('Fichye a depase limit 20 MB la.');
  const id = Crypto.randomUUID();
  const nonce = await Crypto.getRandomBytesAsync(12);
  const source = toByteArray(await FileSystem.readAsStringAsync(asset.uri, { encoding: 'base64' }));
  if (source.byteLength > MAX_BYTES) throw new Error('Fichye a depase limit 20 MB la.');
  const ciphertext = gcm(await vaultKey(userId), nonce).encrypt(source);
  await FileSystem.makeDirectoryAsync(ROOT, { intermediates: true });
  const uri = `${ROOT}${userId}-${id}.bin`;
  try {
    await FileSystem.writeAsStringAsync(uri, fromByteArray(ciphertext), { encoding: 'base64' });
    const item = {
      id, type: asset.type, mimeType: asset.mimeType || (asset.type === 'video' ? 'video/mp4' : 'image/jpeg'),
      size: source.byteLength, createdAt: new Date().toISOString(), nonce: hex(nonce),
    };
    const next = [item, ...(await listVaultFiles(userId))];
    await AsyncStorage.setItem(indexKey(userId), JSON.stringify(next));
    return next;
  } catch (error) {
    await FileSystem.deleteAsync(uri, { idempotent: true });
    throw error;
  }
}

export async function openVaultFile(userId, item) {
  const uri = `${ROOT}${userId}-${item.id}.bin`;
  const ciphertext = toByteArray(await FileSystem.readAsStringAsync(uri, { encoding: 'base64' }));
  const plain = gcm(await vaultKey(userId), bytes(item.nonce)).decrypt(ciphertext);
  const extension = item.type === 'video' ? '.mp4' : '.jpg';
  const temporary = `${FileSystem.cacheDirectory}vault-preview-${item.id}${extension}`;
  await FileSystem.writeAsStringAsync(temporary, fromByteArray(plain), { encoding: 'base64' });
  return temporary;
}

export async function removeVaultPreview(uri) {
  if (uri?.startsWith(`${FileSystem.cacheDirectory}vault-preview-`)) {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  }
}

export async function clearVaultPreviews() {
  const names = await FileSystem.readDirectoryAsync(FileSystem.cacheDirectory);
  await Promise.all(names.filter(name => name.startsWith('vault-preview-')).map(name =>
    FileSystem.deleteAsync(`${FileSystem.cacheDirectory}${name}`, { idempotent: true })));
}

export async function deleteVaultFile(userId, item) {
  const next = (await listVaultFiles(userId)).filter(x => x.id !== item.id);
  await FileSystem.deleteAsync(`${ROOT}${userId}-${item.id}.bin`, { idempotent: true });
  await AsyncStorage.setItem(indexKey(userId), JSON.stringify(next));
  return next;
}

export async function removePickerCopy(asset) {
  if (asset.uri?.startsWith(FileSystem.cacheDirectory)) {
    await FileSystem.deleteAsync(asset.uri, { idempotent: true });
  }
}
