import * as FileSystem from 'expo-file-system';
import { FileSystem as NativeFS } from 'react-native-file-access';
import * as Crypto from 'expo-crypto';
import { CHUNK_BYTES, encode, decode, encryptChunk, decryptChunk } from './cryptoCore';
import { MAX_MEDIA_BYTES, MEDIA_LIMIT_LABEL } from './mediaLimits';

export const pathOnly = uri => uri.replace(/^file:\/\//, '');
export const privateCache = `${FileSystem.cacheDirectory}save-me-private/`;
export async function prepareManifest(asset, id = Crypto.randomUUID()) {
  const info = await FileSystem.getInfoAsync(asset.uri, { size: true });
  if (!info.exists || !Number.isFinite(info.size) || info.size <= 0) throw new Error('Fichye pa disponib.');
  if (info.size > MAX_MEDIA_BYTES) throw new Error(`Fichye a depase ${MEDIA_LIMIT_LABEL}. Chwazi yon kalite videyo ki pi ba.`);
  return { v: 2, id, size: info.size, chunks: Math.ceil(info.size / CHUNK_BYTES), kind: asset.type,
    mime: asset.mimeType || ({ image: 'image/jpeg', video: 'video/mp4', audio: 'audio/mp4' })[asset.type],
    key: encode(await Crypto.getRandomBytesAsync(32)), prefix: encode(await Crypto.getRandomBytesAsync(8)) };
}
export function validateManifest(m) {
  if (m?.v !== 2 || !Number.isInteger(m.size) || m.size < 1 || m.size > MAX_MEDIA_BYTES || m.chunks !== Math.ceil(m.size / CHUNK_BYTES) ||
      decode(m.key).length !== 32 || decode(m.prefix).length !== 8 || !['image','video','audio'].includes(m.kind)) throw new Error('Invalid encrypted file');
}
export async function encryptedPart(uri, manifest, index, target) {
  const plain = decode(await FileSystem.readAsStringAsync(uri, { encoding: 'base64', position: index * CHUNK_BYTES, length: Math.min(CHUNK_BYTES, manifest.size - index * CHUNK_BYTES) }));
  const ciphertext = encryptChunk(plain, manifest, index);
  plain.fill(0);
  await FileSystem.writeAsStringAsync(target, encode(ciphertext), { encoding: 'base64' });
}
export async function assemblePrivateFile(manifest, fetchPart, checkActive = async () => {}) {
  validateManifest(manifest);
  await FileSystem.makeDirectoryAsync(privateCache, { intermediates: true });
  const extension = ({ 'image/png': 'png', 'image/webp': 'webp', 'video/quicktime': 'mov', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3' })[manifest.mime] || (manifest.kind === 'video' ? 'mp4' : 'jpg');
  const output = `${privateCache}${Crypto.randomUUID()}.${extension}`;
  await NativeFS.writeFile(pathOnly(output), '', 'base64');
  try {
    for (let index = 0; index < manifest.chunks; index++) {
      await checkActive();
      const cipher = await fetchPart(index);
      const plain = decryptChunk(cipher, manifest, index);
      if (plain.length !== Math.min(CHUNK_BYTES, manifest.size - index * CHUNK_BYTES)) throw new Error('Incomplete encrypted file');
      await NativeFS.appendFile(pathOnly(output), encode(plain), 'base64');
      plain.fill(0);
    }
    await checkActive();
    return output;
  } catch (e) { await removePrivateFile(output); throw e; }
}
export async function removePrivateFile(uri) {
  if (uri?.startsWith(privateCache)) await FileSystem.deleteAsync(uri, { idempotent: true });
}
export async function clearPrivateCache() { await FileSystem.deleteAsync(privateCache, { idempotent: true }); }
