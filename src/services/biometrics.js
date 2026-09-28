// src/services/biometrics.js
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

// Check if biometrics are available on device
export async function isBiometricAvailable() {
  const compatible = await LocalAuthentication.hasHardwareAsync();
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  return compatible && enrolled;
}

// Get type of biometric available
export async function getBiometricType() {
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return 'face';
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return 'fingerprint';
  }
  return 'none';
}

// Authenticate user with biometrics
export async function authenticate(promptMessage = 'Verifye idantite ou / Verify your identity') {
  try {
    const available = await isBiometricAvailable();
    if (!available) {
      return { success: false, error: 'biometric_not_available' };
    }
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      fallbackLabel: 'Itilize PIN / Use PIN',
      disableDeviceFallback: false,
      cancelLabel: 'Anile / Cancel',
    });
    return result;
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// Save biometric preference
export async function setBiometricEnabled(enabled) {
  await SecureStore.setItemAsync('saveme_biometric', enabled ? 'true' : 'false');
}

// Get biometric preference
export async function isBiometricEnabled() {
  const val = await SecureStore.getItemAsync('saveme_biometric');
  return val !== 'false';
}
