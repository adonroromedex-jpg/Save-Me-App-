// src/screens/BiometricScreen.jsx
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Alert, Vibration } from 'react-native';
import { useTranslation } from 'react-i18next';
import { authenticate, isBiometricAvailable, getBiometricType } from '../services/biometrics';
import { verifyPin, getStoredPinHash } from '../services/encryption';
import { useStore } from '../store/useStore';
import { signOutAccount } from '../services/auth';

const KEYS = ['1','2','3','4','5','6','7','8','9','⌫','0','✓'];

export default function BiometricScreen() {
  const { t } = useTranslation();
  const unlockApp = useStore(s => s.unlockApp);
  const logout = useStore(s => s.logout);
  const [pin, setPin] = useState('');
  const [bioType, setBioType] = useState('none');
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const type = await getBiometricType();
      setBioType(type);
      if (type !== 'none') tryBiometric();
    })();
  }, []);

  const tryBiometric = async () => {
    const result = await authenticate();
    if (result.success) unlockApp();
    else setError('Biometri echwe. Itilize PIN.');
  };

  const handleKey = async (key) => {
    if (key === '⌫') {
      setPin(p => p.slice(0, -1));
      setError('');
      return;
    }
    if (key === '✓') {
      const hash = await getStoredPinHash();
      if (!hash) {
        setError('Pa gen PIN ki konfigire. Itilize byometri oswa rekonekte.');
        return;
      }
      const ok = await verifyPin(pin, hash);
      if (ok) {
        unlockApp();
      } else {
        Vibration.vibrate(300);
        setError(t('wrongPin'));
        setPin('');
      }
      return;
    }
    if (pin.length < 6) setPin(p => p + key);
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.inner}>
        {/* Logo */}
        <View style={s.shield}>
          <Text style={s.shieldText}>✓</Text>
        </View>
        <Text style={s.title}>{t('biometricTitle')}</Text>
        <Text style={s.sub}>{t('biometricSub')}</Text>

        {/* PIN dots */}
        <View style={s.dotsRow}>
          {[0,1,2,3,4,5].map(i => (
            <View key={i} style={[s.dot, i < pin.length && s.dotFilled]} />
          ))}
        </View>

        {error ? <Text style={s.error}>{error}</Text> : null}

        {/* Biometric button */}
        {bioType !== 'none' && (
          <TouchableOpacity style={s.bioBtn} onPress={tryBiometric}>
            <Text style={s.bioBtnText}>{bioType === 'face' ? '😊 Face ID' : '👆 Emprènt'}</Text>
          </TouchableOpacity>
        )}

        {/* Numpad */}
        <View style={s.numpad}>
          {KEYS.map((k) => (
            <TouchableOpacity
              key={k}
              style={[s.key, k === '✓' && s.keyConfirm, k === '⌫' && s.keyDel]}
              onPress={() => handleKey(k)}
            >
              <Text style={[s.keyText, k === '✓' && s.keyConfirmText]}>{k}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity onPress={async () => {
          try { await signOutAccount(); logout(); }
          catch (e) { setError(e.message); }
        }}>
          <Text style={s.sub}>Dekonekte pou rekonekte ak imèl</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A1A' },
  inner: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  shield: { width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: '#1565C0', backgroundColor: 'rgba(21,101,192,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  shieldText: { fontSize: 32, color: '#fff' },
  title: { color: '#fff', fontSize: 20, fontWeight: '600', marginBottom: 8 },
  sub: { color: '#8888AA', fontSize: 13, textAlign: 'center', marginBottom: 28 },
  dotsRow: { flexDirection: 'row', gap: 14, marginBottom: 16 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: '#333' },
  dotFilled: { backgroundColor: '#1565C0', borderColor: '#1565C0' },
  error: { color: '#D32F2F', fontSize: 12, marginBottom: 12 },
  bioBtn: { borderWidth: 1, borderColor: '#1565C0', borderRadius: 24, paddingHorizontal: 20, paddingVertical: 8, marginBottom: 24 },
  bioBtnText: { color: '#1565C0', fontSize: 14 },
  numpad: { flexDirection: 'row', flexWrap: 'wrap', width: 240, gap: 12, justifyContent: 'center' },
  key: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#12122A', alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)' },
  keyConfirm: { backgroundColor: '#1565C0', borderColor: '#1565C0' },
  keyDel: { backgroundColor: 'transparent', borderColor: 'transparent' },
  keyText: { color: '#fff', fontSize: 20, fontWeight: '500' },
  keyConfirmText: { color: '#fff' },
});
