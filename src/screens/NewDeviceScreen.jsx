// ============================================================
// src/screens/NewDeviceScreen.jsx
// ============================================================
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { sendSMSOTP, verifyOTP } from '../services/twoFactor';
import { useStore } from '../store/useStore';

export function NewDeviceScreen({ navigation }) {
  const { t } = useTranslation();
  const { user } = useStore();
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (user?.phone) {
      sendSMSOTP(user.phone).then(() => setSent(true));
    }
  }, []);

  const handleVerify = async () => {
    const result = await verifyOTP(code);
    if (result.success) {
      navigation.replace('Main');
    } else {
      Alert.alert('Erè', 'Kòd la mal oswa ekspire');
    }
  };

  return (
    <SafeAreaView style={nd.container}>
      <View style={nd.inner}>
        <Text style={nd.icon}>📱</Text>
        <Text style={nd.title}>{t('newDevice')}</Text>
        <Text style={nd.sub}>{t('newDeviceSub')}</Text>
        <Text style={nd.info}>Kòd voye nan {user?.phone || user?.email || 'ou'}</Text>
        <TextInput
          style={nd.input}
          placeholder="000000"
          placeholderTextColor="#555"
          value={code}
          onChangeText={setCode}
          keyboardType="numeric"
          maxLength={6}
          textAlign="center"
        />
        <TouchableOpacity style={nd.btn} onPress={handleVerify}>
          <Text style={nd.btnText}>{t('verify')} ✓</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const nd = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A1A' },
  inner: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  icon: { fontSize: 48, marginBottom: 16 },
  title: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  sub: { color: '#8888AA', fontSize: 14, textAlign: 'center', marginBottom: 8 },
  info: { color: '#555', fontSize: 12, marginBottom: 24, textAlign: 'center' },
  input: { backgroundColor: '#12122A', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 14, padding: 16, color: '#fff', fontSize: 28, fontWeight: '700', letterSpacing: 8, width: '100%', marginBottom: 16 },
  btn: { backgroundColor: '#D32F2F', borderRadius: 14, paddingVertical: 16, alignItems: 'center', width: '100%' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

export default NewDeviceScreen;
