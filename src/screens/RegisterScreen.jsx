// src/screens/RegisterScreen.jsx
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { requestEmailCode, verifyEmailCode } from '../services/auth';
import { useStore } from '../store/useStore';

export default function RegisterScreen({ navigation }) {
  const { t } = useTranslation();
  const setUser = useStore(s => s.setUser);

  const [form, setForm] = useState({ name: '', firstName: '', countryCode: '', phone: '', email: '' });
  const [step, setStep] = useState(1); // 1=form, 2=verify OTP
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendOTP = async () => {
    if (!form.name.trim() || !form.firstName.trim() || !form.countryCode.trim() || !form.phone.trim() || !form.email.trim()) {
      Alert.alert(t('registrationFailed'), t('requiredFields'));
      return;
    }
    const countryCode = form.countryCode.trim().replace(/[\s()-]/g, '');
    const nationalNumber = form.phone.trim().replace(/[\s()-]/g, '');
    const phoneNumber = `${countryCode}${nationalNumber}`;
    if (!/^\+[1-9]\d{0,2}$/.test(countryCode) || !/^\d{4,14}$/.test(nationalNumber) || !/^\+[1-9]\d{6,14}$/.test(phoneNumber)) {
      Alert.alert(t('registrationFailed'), t('invalidPhone'));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      Alert.alert(t('registrationFailed'), t('invalidEmail'));
      return;
    }
    setLoading(true);
    try {
      await requestEmailCode(form.email, {
        createUser: true,
        profile: {
          firstName: form.firstName.trim(),
          name: form.name.trim(),
          countryCode,
          phoneNumber,
        },
      });
      setStep(2);
    } catch (e) {
      Alert.alert(t('registrationFailed'), e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    try {
      setUser(await verifyEmailCode(form.email, otp));
    } catch (e) {
      Alert.alert(t('verificationFailed'), e.message);
    }
  };

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}>
          <Text style={s.backText}>{t('back')}</Text>
        </TouchableOpacity>

        <Text style={s.title}>{step === 1 ? t('createAccount') : t('verifyCodeTitle')}</Text>

        {step === 1 ? (
          <>
            {[
              { key: 'firstName', placeholder: t('firstName') },
              { key: 'name', placeholder: t('name') },
              { key: 'countryCode', placeholder: t('countryCode'), keyboardType: 'phone-pad' },
              { key: 'phone', placeholder: t('phoneRequired'), keyboardType: 'phone-pad' },
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
                autoCapitalize={field.key === 'firstName' || field.key === 'name' ? 'words' : 'none'}
                autoComplete={field.key === 'email' ? 'email' : field.key === 'phone' ? 'tel' : undefined}
              />
            ))}

            <Text style={s.label2FA}>{t('emailCodeInfo')}</Text>

            <TouchableOpacity style={s.btnPrimary} onPress={handleSendOTP} disabled={loading}>
              <Text style={s.btnPrimaryText}>{loading ? t('sending') : t('continue')}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={s.otpInfo}>
              {t('codeSentTo', { email: form.email })}
            </Text>
            <TextInput
              style={[s.input, s.otpInput]}
              placeholder={t('emailCode')}
              placeholderTextColor="#555"
              value={otp}
              onChangeText={setOtp}
              keyboardType="numeric"
              maxLength={8}
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
