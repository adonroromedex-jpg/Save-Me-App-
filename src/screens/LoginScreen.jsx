// src/screens/LoginScreen.jsx
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useStore } from '../store/useStore';

export default function LoginScreen({ navigation }) {
  const { t } = useTranslation();
  const setUser = useStore(s => s.setUser);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Erè', 'Tanpri antre imèl ak modpas ou');
      return;
    }
    setLoading(true);
    // TODO: Replace with real API call
    setTimeout(() => {
      setLoading(false);
      // Mock login success
      setUser({ email, name: 'Utilisateur', firstName: 'Save Me', id: '1' });
    }, 1000);
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.inner}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}>
          <Text style={s.backText}>← Retounen</Text>
        </TouchableOpacity>

        <View style={s.logoRow}>
          <View style={s.shield}>
            <Text style={{ fontSize: 22, color: '#fff' }}>✓</Text>
          </View>
          <Text style={s.title}>{t('signIn')}</Text>
        </View>

        <TextInput
          style={s.input}
          placeholder={t('email')}
          placeholderTextColor="#555"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          style={s.input}
          placeholder={t('password')}
          placeholderTextColor="#555"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity style={s.forgot}>
          <Text style={s.forgotText}>Bliye modpas ou? / Forgot password?</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.btnPrimary} onPress={handleLogin} disabled={loading}>
          <Text style={s.btnPrimaryText}>{loading ? 'Koneksyon...' : t('signIn') + ' →'}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Register')} style={s.registerLink}>
          <Text style={s.registerText}>Ou pa gen kont? <Text style={s.registerHighlight}>{t('createAccount')}</Text></Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A1A' },
  inner: { flex: 1, padding: 24, justifyContent: 'center' },
  back: { position: 'absolute', top: 16, left: 24 },
  backText: { color: '#8888AA', fontSize: 14 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 32 },
  shield: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1565C0', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 26, fontWeight: '700' },
  input: { backgroundColor: '#12122A', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 14, color: '#fff', fontSize: 14, marginBottom: 12 },
  forgot: { alignSelf: 'flex-end', marginBottom: 20 },
  forgotText: { color: '#1565C0', fontSize: 12 },
  btnPrimary: { backgroundColor: '#D32F2F', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  registerLink: { alignItems: 'center', marginTop: 20 },
  registerText: { color: '#8888AA', fontSize: 13 },
  registerHighlight: { color: '#D32F2F', fontWeight: '600' },
});
