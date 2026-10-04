import { NativeModules } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { FileSystem as NativeFS } from 'react-native-file-access';
import * as Crypto from 'expo-crypto';
import { CHUNK_BYTES, encode, decode, encryptChunk, decryptChunk, chunkNonce, context } from './cryptoCore';
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
  if (NativeModules.SaveMeCrypto) return NativeModules.SaveMeCrypto.encryptPart(uri, target, index * CHUNK_BYTES,
    Math.min(CHUNK_BYTES, manifest.size - index * CHUNK_BYTES), manifest.key, encode(chunkNonce(manifest.prefix, index)), encode(context(manifest,index)));
  const plain = decode(await FileSystem.readAsStringAsync(uri, { encoding: 'base64', position: index * CHUNK_BYTES, length: Math.min(CHUNK_BYTES, manifest.size - index * CHUNK_BYTES) }));
  const ciphertext = encryptChunk(plain, manifest, index);
  plain.fill(0);
  await FileSystem.writeAsStringAsync(target, encode(ciphertext), { encoding: 'base64' });
}
export async function assemblePrivateFile(manifest, fetchPart, checkActive = async () => {}, prefetch = 1) {
  validateManifest(manifest);
  if (![1,2,3].includes(prefetch)) throw new Error('Invalid prefetch bound');
  await FileSystem.makeDirectoryAsync(privateCache, { intermediates: true });
  const extension = ({ 'image/png': 'png', 'image/webp': 'webp', 'video/quicktime': 'mov', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3' })[manifest.mime] || (manifest.kind === 'video' ? 'mp4' : 'jpg');
  const output = `${privateCache}${Crypto.randomUUID()}.${extension}`;
  await NativeFS.writeFile(pathOnly(output), '', 'base64');
  try {
    for (let start = 0; start < manifest.chunks; start += prefetch) {
      await checkActive();
      // Drain every request before cleanup and retain at most three encrypted chunks.
      const results = await Promise.allSettled(Array.from({length: Math.min(prefetch, manifest.chunks-start)}, (_,n) => fetchPart(start+n)));
      const failed = results.find(result => result.status === 'rejected');
      if (failed) throw failed.reason;
      for (let n = 0; n < results.length; n++) {
        const index = start+n, cipher = results[n].value;
        await checkActive();
        if (NativeModules.SaveMeCrypto) {
          await NativeModules.SaveMeCrypto.decryptAppend(encode(cipher), output,
            Math.min(CHUNK_BYTES, manifest.size - index * CHUNK_BYTES), manifest.key,
            encode(chunkNonce(manifest.prefix,index)), encode(context(manifest,index)));
        } else {
          const plain = decryptChunk(cipher, manifest, index);
          try {
            if (plain.length !== Math.min(CHUNK_BYTES, manifest.size - index * CHUNK_BYTES)) throw new Error('Incomplete encrypted file');
            await NativeFS.appendFile(pathOnly(output), encode(plain), 'base64');
          } finally { plain.fill(0); }
        }
        results[n].value = null;
      }
    }
    await checkActive();
    return output;
  } catch (e) { await removePrivateFile(output); throw e; }
}
export async function removePrivateFile(uri) {
  if (uri?.startsWith(privateCache)) await FileSystem.deleteAsync(uri, { idempotent: true });
}
export async function clearPrivateCache() { await FileSystem.deleteAsync(privateCache, { idempotent: true }); }
