// src/screens/RegisterScreen.jsx
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { sendSMSOTP, sendEmailOTP } from '../services/twoFactor';
import { useStore } from '../store/useStore';

export default function RegisterScreen({ navigation }) {
  const { t } = useTranslation();
  const setUser = useStore(s => s.setUser);

  const [form, setForm] = useState({ name: '', firstName: '', birthDate: '', email: '', phone: '', password: '' });
  const [twoFAMethod, setTwoFAMethod] = useState('sms');
  const [step, setStep] = useState(1); // 1=form, 2=verify OTP
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendOTP = async () => {
    if (!form.name || !form.firstName || !form.email || !form.phone) {
      Alert.alert('Erè', 'Tanpri ranpli tout chan obligatwa yo');
      return;
    }
    setLoading(true);
    if (twoFAMethod === 'sms') {
      await sendSMSOTP(form.phone);
    } else {
      await sendEmailOTP(form.email);
    }
    setLoading(false);
    setStep(2);
  };

  const handleVerifyOTP = async () => {
    const { verifyOTP } = await import('../services/twoFactor');
    const result = await verifyOTP(otp);
    if (result.success) {
      setUser({ ...form, id: Date.now().toString() });
    } else {
      Alert.alert('Erè', 'Kòd la mal oswa ekspire. Eseye ankò.');
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
              { key: 'birthDate', placeholder: t('birthDate') + ' (JJ/MM/AAAA)' },
              { key: 'email', placeholder: t('email'), keyboardType: 'email-address' },
              { key: 'phone', placeholder: t('phone'), keyboardType: 'phone-pad' },
              { key: 'password', placeholder: t('password'), secureTextEntry: true },
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

            <Text style={s.label2FA}>{t('confirm2FA')}</Text>
            <View style={s.twoFARow}>
              <TouchableOpacity style={[s.twoFABtn, twoFAMethod === 'sms' && s.twoFAActive]} onPress={() => setTwoFAMethod('sms')}>
                <Text style={s.twoFAText}>📱 {t('viaSMS')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.twoFABtn, twoFAMethod === 'email' && s.twoFAActive]} onPress={() => setTwoFAMethod('email')}>
                <Text style={s.twoFAText}>📧 {t('viaEmail')}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={s.btnPrimary} onPress={handleSendOTP} disabled={loading}>
              <Text style={s.btnPrimaryText}>{loading ? 'Ap voye...' : 'Kontinye →'}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={s.otpInfo}>
              Nou voye yon kòd 6 chif nan {twoFAMethod === 'sms' ? form.phone : form.email}
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
            <TouchableOpacity onPress={() => setStep(1)} style={s.resend}>
              <Text style={s.resendText}>← Chanje enfòmasyon</Text>
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
