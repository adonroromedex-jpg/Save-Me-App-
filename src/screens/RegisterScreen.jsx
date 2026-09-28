// src/screens/RegisterScreen.jsx
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { requestEmailCode, verifyEmailCode } from '../services/auth';
import { useStore } from '../store/useStore';

export default function RegisterScreen({ navigation }) {
  const { t } = useTranslation();
  const setUser = useStore(s => s.setUser);

  const [form, setForm] = useState({ name: '', firstName: '', email: '' });
  const [step, setStep] = useState(1); // 1=form, 2=verify OTP
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendOTP = async () => {
    if (!form.name.trim() || !form.firstName.trim() || !form.email.trim()) {
      Alert.alert('Erè', 'Tanpri ranpli tout chan obligatwa yo');
      return;
    }
    setLoading(true);
    try {
      await requestEmailCode(form.email, {
        createUser: true,
        profile: { firstName: form.firstName.trim(), name: form.name.trim() },
      });
      setStep(2);
    } catch (e) {
      Alert.alert('Enskripsyon pa fini', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    try {
      setUser(await verifyEmailCode(form.email, otp));
    } catch (e) {
      Alert.alert('Verifikasyon echwe', e.message);
    }
  };

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}>
          <Text style={s.backText}>← Retounen</Text>
        </TouchableOpacity>

        <Text style={s.title}>{step === 1 ? t('createAccount') : 'Verifye Kòd la'}</Text>

        {step === 1 ? (
          <>
            {[
              { key: 'firstName', placeholder: t('firstName') },
              { key: 'name', placeholder: t('name') },
              { key: 'email', placeholder: t('email'), keyboardType: 'email-address' },
            ].map(field => (
              <TextInput
                key={field.key}
                style={s.input}
                placeholder={field.placeholder}
                placeholderTextColor="#555"
                value={form[field.key]}
                onChangeText={v => setForm(f => ({ ...f, [field.key]: v }))}
                keyboardType={field.keyboardType || 'default'}
                secureTextEntry={field.secureTextEntry}
                autoCapitalize="none"
              />
            ))}

            <Text style={s.label2FA}>N ap voye yon kòd konfimasyon nan imèl ou.</Text>

            <TouchableOpacity style={s.btnPrimary} onPress={handleSendOTP} disabled={loading}>
              <Text style={s.btnPrimaryText}>{loading ? 'Ap voye...' : 'Kontinye →'}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={s.otpInfo}>
              Antre kòd nou voye nan {form.email}
            </Text>
            <TextInput
              style={[s.input, s.otpInput]}
              placeholder="000000"
              placeholderTextColor="#555"
              value={otp}
              onChangeText={setOtp}
              keyboardType="numeric"
              maxLength={6}
              textAlign="center"
            />
            <TouchableOpacity style={s.btnPrimary} onPress={handleVerifyOTP}>
              <Text style={s.btnPrimaryText}>{t('verify')} ✓</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A1A' },
  scroll: { padding: 24, paddingTop: 16 },
  back: { marginBottom: 16 },
  backText: { color: '#8888AA', fontSize: 14 },
  title: { color: '#fff', fontSize: 24, fontWeight: '700', marginBottom: 24 },
  input: { backgroundColor: '#12122A', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 14, color: '#fff', fontSize: 14, marginBottom: 12 },
  otpInput: { fontSize: 28, fontWeight: '700', letterSpacing: 8 },
  label2FA: { color: '#8888AA', fontSize: 12, marginBottom: 10, marginTop: 4 },
  twoFARow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  twoFABtn: { flex: 1, backgroundColor: '#12122A', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 12, alignItems: 'center' },
  twoFAActive: { borderColor: '#D32F2F', backgroundColor: 'rgba(211,47,47,0.1)' },
  twoFAText: { color: '#CCC', fontSize: 13 },
  btnPrimary: { backgroundColor: '#D32F2F', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  otpInfo: { color: '#8888AA', fontSize: 13, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  resend: { alignItems: 'center', marginTop: 16 },
  resendText: { color: '#8888AA', fontSize: 13 },
});
