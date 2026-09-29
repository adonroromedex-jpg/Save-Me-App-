// src/screens/BiometricScreen.jsx
import React, { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { authenticate, isBiometricAvailable, getBiometricType } from '../services/biometrics';
import { useStore } from '../store/useStore';
import { signOutAccount } from '../services/auth';

export default function BiometricScreen() {
  const { t } = useTranslation();
  const unlockApp = useStore(s => s.unlockApp);
  const logout = useStore(s => s.logout);
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
    else setError(t('biometricRetry'));
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.inner}>
        {/* Logo */}
        <View style={s.logoWhiteBackground}>
          <Image source={require('../../assets/logo_save_me.png')} style={s.logoImage} resizeMode="contain" />
        </View>
        <Text style={s.title}>{t('biometricTitle')}</Text>
        <Text style={s.sub}>{t('biometricSub')}</Text>

        {error ? <Text style={s.error}>{error}</Text> : null}

        {/* Biometric button */}
        {bioType !== 'none' && (
          <TouchableOpacity style={s.bioBtn} onPress={tryBiometric}>
            <Text style={s.bioBtnText}>{bioType === 'face' ? '😊 Face ID' : '👆 Emprènt'}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity onPress={async () => {
          try { await signOutAccount(); logout(); }
          catch (e) { setError(e.message); }
        }}>
          <Text style={s.sub}>{t('loginAgain')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A1A' },
  inner: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  logoWhiteBackground: { width: 80, height: 80, borderRadius: 16, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  logoImage: { width: 74, height: 74 },
  title: { color: '#fff', fontSize: 20, fontWeight: '600', marginBottom: 8 },
  sub: { color: '#8888AA', fontSize: 13, textAlign: 'center', marginBottom: 28 },
  error: { color: '#D32F2F', fontSize: 12, marginBottom: 12 },
  bioBtn: { borderWidth: 1, borderColor: '#1565C0', borderRadius: 24, paddingHorizontal: 20, paddingVertical: 8, marginBottom: 24 },
  bioBtnText: { color: '#1565C0', fontSize: 14 },
});
