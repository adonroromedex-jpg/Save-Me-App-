import 'fast-text-encoding';
// Pure cryptographic operations; randomness is supplied by Expo's native CSPRNG.
import nacl from 'tweetnacl';
import { gcm } from '@noble/ciphers/aes';
import { fromByteArray, toByteArray } from 'base64-js';
import { utf8ToBytes, bytesToUtf8 } from '@noble/hashes/utils';
import { sha256 } from '@noble/hashes/sha256';

export const encode = fromByteArray;
export const decode = toByteArray;
export const fingerprint = key => Array.from(sha256(decode(key)), b => b.toString(16).padStart(2, '0')).join('').match(/.{1,4}/g).join(' ');
export const keyPair = secret => nacl.box.keyPair.fromSecretKey(secret);
export function seal(value, publicKey, secretKey, nonce) {
  return { v: 1, nonce: encode(nonce), box: encode(nacl.box(utf8ToBytes(JSON.stringify(value)), nonce, decode(publicKey), secretKey)) };
}
export function unseal(envelope, publicKey, secretKey) {
  if (envelope?.v !== 1) throw new Error('Unsupported encrypted message');
  const plain = nacl.box.open(decode(envelope.box), decode(envelope.nonce), decode(publicKey), secretKey);
  if (!plain) throw new Error('Encrypted message authentication failed');
  return JSON.parse(bytesToUtf8(plain));
}
export const CHUNK_BYTES = 1024 * 1024;
export function chunkNonce(prefix, index) {
  if (!Number.isInteger(index) || index < 0 || index >= 0xffffffff) throw new Error('Invalid chunk');
  const nonce = new Uint8Array(12);
  nonce.set(decode(prefix));
  new DataView(nonce.buffer).setUint32(8, index, false);
  return nonce;
}
export const context = (manifest, index) => utf8ToBytes(JSON.stringify([manifest.id, manifest.size, manifest.mime, manifest.kind, index]));
export const encryptChunk = (plain, manifest, index) => gcm(decode(manifest.key), chunkNonce(manifest.prefix, index), context(manifest, index)).encrypt(plain);
export const decryptChunk = (cipher, manifest, index) => gcm(decode(manifest.key), chunkNonce(manifest.prefix, index), context(manifest, index)).decrypt(cipher);
