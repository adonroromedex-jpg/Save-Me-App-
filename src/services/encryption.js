// src/services/encryption.js
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const KEY_NAME = 'saveme_master_key';

// Generate a random 256-bit key and store it securely
export async function generateAndStoreKey() {
  const keyBytes = await Crypto.getRandomBytesAsync(32);
  const keyHex = Array.from(keyBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  await SecureStore.setItemAsync(KEY_NAME, keyHex);
  return keyHex;
}

// Retrieve the stored key
export async function getMasterKey() {
  let key = await SecureStore.getItemAsync(KEY_NAME);
  if (!key) {
    key = await generateAndStoreKey();
  }
  return key;
}

// Simple XOR-based obfuscation for demo (replace with react-native-aes-crypto in production)
function xorEncrypt(data, key) {
  const dataBytes = Array.from(Buffer.from(data, 'utf8'));
  const keyBytes = Array.from(Buffer.from(key.slice(0, 32), 'utf8'));
  const encrypted = dataBytes.map((b, i) => b ^ keyBytes[i % keyBytes.length]);
  return Buffer.from(encrypted).toString('base64');
}

function xorDecrypt(data, key) {
  const encBytes = Array.from(Buffer.from(data, 'base64'));
  const keyBytes = Array.from(Buffer.from(key.slice(0, 32), 'utf8'));
  const decrypted = encBytes.map((b, i) => b ^ keyBytes[i % keyBytes.length]);
  return Buffer.from(decrypted).toString('utf8');
}

// Encrypt any string data
export async function encryptData(plainText) {
  try {
    const key = await getMasterKey();
    const iv = await Crypto.getRandomBytesAsync(16);
    const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');
    const encrypted = xorEncrypt(plainText, key + ivHex);
    return { encrypted, iv: ivHex, success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// Decrypt data
export async function decryptData(encryptedText, iv) {
  try {
    const key = await getMasterKey();
    const decrypted = xorDecrypt(encryptedText, key + iv);
    return { decrypted, success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// Hash a PIN with SHA-256
export async function hashPin(pin) {
  const hashed = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    pin + 'saveme_salt_2024'
  );
  return hashed;
}

// Verify PIN
export async function verifyPin(pin, storedHash) {
  const hash = await hashPin(pin);
  return hash === storedHash;
}

// Store hashed PIN
export async function storePin(pin) {
  const hash = await hashPin(pin);
  await SecureStore.setItemAsync('saveme_pin_hash', hash);
}

// Get stored PIN hash
export async function getStoredPinHash() {
  return await SecureStore.getItemAsync('saveme_pin_hash');
}
