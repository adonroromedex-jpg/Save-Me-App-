import { NativeModules, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { pbkdf2Async } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha256';
import { gcm } from '@noble/ciphers/aes';
import { encode, decode } from './cryptoCore';

const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
const entry = id => `vault-code-v2-${id}`;
const budgetName = id => `vault-code-budget-${id}`;
const derive = async (pin, salt) => NativeModules.SaveMeCrypto && Number(Platform.Version) >= 26
  ? decode(await NativeModules.SaveMeCrypto.deriveVaultKey(pin, encode(salt)))
  : pbkdf2Async(sha256, pin, salt, { c: 210000, dkLen: 32 });
export const hasVaultCode = async id => !!(await SecureStore.getItemAsync(entry(id)));
export async function unlockVaultKey(id, pin) {
  if (!/^\d{6}$/.test(pin || '')) throw new Error('Mete yon kòd 6 chif.');
  const budget = JSON.parse((await SecureStore.getItemAsync(budgetName(id))) || '{}');
  if (budget.until > Date.now()) throw new Error('Twòp tantativ. Tann 5 minit.');
  const stored = await SecureStore.getItemAsync(entry(id));
  if (!stored) {
    const legacy = await SecureStore.getItemAsync(`vault-key-${id}`);
    const master = legacy ? new Uint8Array(legacy.match(/../g).map(x => parseInt(x,16))) : await Crypto.getRandomBytesAsync(32);
    const salt = await Crypto.getRandomBytesAsync(16), nonce = await Crypto.getRandomBytesAsync(12);
    const derived = await derive(pin, salt);
    await SecureStore.setItemAsync(entry(id), JSON.stringify({ salt: encode(salt), nonce: encode(nonce), wrapped: encode(gcm(derived, nonce).encrypt(master)) }), options);
    derived.fill(0);
    await SecureStore.deleteItemAsync(`vault-key-${id}`);
    return master;
  }
  const envelope = JSON.parse(stored);
  const derived = await derive(pin, decode(envelope.salt));
  let master;
  try { master = gcm(derived, decode(envelope.nonce)).decrypt(decode(envelope.wrapped)); }
  catch {
    const attempts = (budget.attempts || 0) + 1;
    await SecureStore.setItemAsync(budgetName(id), JSON.stringify({ attempts: attempts >= 5 ? 0 : attempts, until: attempts >= 5 ? Date.now()+300000 : 0 }), options);
    throw new Error('Kòd vault la pa kòrèk.');
  } finally { derived.fill(0); }
  await SecureStore.deleteItemAsync(budgetName(id));
  return master;
}
