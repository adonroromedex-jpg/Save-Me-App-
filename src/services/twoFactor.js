// src/services/twoFactor.js
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';

const API_BASE = 'https://your-backend.com/api'; // Replace with your backend URL

// Generate 6-digit OTP
export async function generateOTP() {
  const bytes = await Crypto.getRandomBytesAsync(3);
  const num = ((bytes[0] << 16) | (bytes[1] << 8) | bytes[2]) % 1000000;
  return String(num).padStart(6, '0');
}

// Send OTP via SMS
export async function sendSMSOTP(phone) {
  try {
    const otp = await generateOTP();
    // Store OTP locally with expiry (10 min)
    const expiry = Date.now() + 10 * 60 * 1000;
    await SecureStore.setItemAsync('saveme_otp', JSON.stringify({ otp, expiry, method: 'sms' }));

    // Call your backend to send SMS via Twilio
    await axios.post(`${API_BASE}/auth/send-sms`, { phone, otp });
    return { success: true };
  } catch (e) {
    // For dev/demo: just store OTP and log it
    console.log('DEV OTP (SMS):', await SecureStore.getItemAsync('saveme_otp'));
    return { success: true, dev: true };
  }
}

// Send OTP via Email
export async function sendEmailOTP(email) {
  try {
    const otp = await generateOTP();
    const expiry = Date.now() + 10 * 60 * 1000;
    await SecureStore.setItemAsync('saveme_otp', JSON.stringify({ otp, expiry, method: 'email' }));

    await axios.post(`${API_BASE}/auth/send-email`, { email, otp });
    return { success: true };
  } catch (e) {
    console.log('DEV OTP (Email):', await SecureStore.getItemAsync('saveme_otp'));
    return { success: true, dev: true };
  }
}

// Verify OTP
export async function verifyOTP(inputCode) {
  try {
    const stored = await SecureStore.getItemAsync('saveme_otp');
    if (!stored) return { success: false, error: 'no_otp' };

    const { otp, expiry } = JSON.parse(stored);
    if (Date.now() > expiry) {
      await SecureStore.deleteItemAsync('saveme_otp');
      return { success: false, error: 'expired' };
    }
    if (inputCode === otp) {
      await SecureStore.deleteItemAsync('saveme_otp');
      return { success: true };
    }
    return { success: false, error: 'wrong_code' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// Device fingerprint (detect new device)
export async function getDeviceId() {
  let deviceId = await SecureStore.getItemAsync('saveme_device_id');
  if (!deviceId) {
    const bytes = await Crypto.getRandomBytesAsync(16);
    deviceId = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    await SecureStore.setItemAsync('saveme_device_id', deviceId);
  }
  return deviceId;
}

// Check if this is a known device
export async function isKnownDevice(userDevices = []) {
  const deviceId = await getDeviceId();
  return userDevices.includes(deviceId);
}
