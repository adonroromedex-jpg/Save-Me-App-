import { Alert } from '../components/AppDialog';
// src/screens/LoginScreen.jsx
import React, { useState } from 'react';
import { View, Text, Image, TextInput, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useStore } from '../store/useStore';
import { requestEmailCode, verifyEmailCode } from '../services/auth';

export default function LoginScreen({ navigation }) {
  const { t } = useTranslation();
  const setUser = useStore(s => s.setUser);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [otp, setOtp] = useState('');

  const handleLogin = async () => {
    if (!email.trim()) {
      Alert.alert(t('loginFailed'), t('requiredFields'));
      return;
    }
    setLoading(true);
    try {
      await requestEmailCode(email);
      setCodeSent(true);
    } catch (e) {
      Alert.alert(t('loginFailed'), e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    try {
      setUser(await verifyEmailCode(email, otp));
    } catch (e) {
      Alert.alert(t('invalidCode'), e.message);
    }
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.inner}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}>
          <Text style={s.backText}>{t('back')}</Text>
        </TouchableOpacity>

        <View style={s.logoRow}>
          <View style={s.logoWhiteBackground}>
            <Image source={require('../../assets/logo_save_me.png')} style={s.logoImage} resizeMode="contain" />
          </View>
          <Text style={s.title}>{t('signIn')}</Text>
        </View>

        {codeSent ? <>
          <Text style={s.forgotText}>{t('codeSentTo', { email })}</Text>
          <TextInput style={s.input} placeholder={t('emailCode')} placeholderTextColor="#555"
            keyboardType="number-pad" maxLength={8} value={otp} onChangeText={setOtp} />
          <TouchableOpacity style={s.btnPrimary} onPress={handleVerify}>
            <Text style={s.btnPrimaryText}>{t('verifyEmail')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.registerLink} onPress={() => setCodeSent(false)}>
            <Text style={s.registerText}>{t('changeEmail')}</Text>
          </TouchableOpacity>
        </> : <>
        <TextInput
          style={s.input}
          placeholder={t('email')}
          placeholderTextColor="#555"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TouchableOpacity style={s.btnPrimary} onPress={handleLogin} disabled={loading}>
          <Text style={s.btnPrimaryText}>{loading ? t('sending') : t('sendCode')}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Register')} style={s.registerLink}>
          <Text style={s.registerText}>{t('noAccount')} <Text style={s.registerHighlight}>{t('createAccount')}</Text></Text>
        </TouchableOpacity>
        </>}
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
  logoWhiteBackground: { width: 52, height: 52, borderRadius: 10, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  logoImage: { width: 48, height: 48 },
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
