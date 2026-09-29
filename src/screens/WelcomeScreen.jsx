// src/screens/WelcomeScreen.jsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { changeAppLanguage } from '../i18n/language';
import { useStore } from '../store/useStore';

const LANGUAGES = [
  { code: 'fr', flag: '🇫🇷', label: 'Bienvenue' },
  { code: 'en', flag: '🇺🇸', label: 'Welcome' },
  { code: 'es', flag: '🇪🇸', label: 'Bienvenido' },
  { code: 'ht', flag: '🇭🇹', label: 'Byenveni' },
];

export default function WelcomeScreen({ navigation }) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState(useStore.getState().language);

  const handleLanguage = (code) => {
    setSelected(code);
    changeAppLanguage(code).catch(() => Alert.alert(t('language'), t('languageSaveFailed')));
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Logo */}
      <View style={styles.logoArea}>
        <View style={styles.shieldOuter}>
          <View style={styles.shieldInner}>
            <Text style={styles.shieldCheck}>✓</Text>
          </View>
        </View>
        <Text style={styles.appName}>SAVE ME</Text>
        <Text style={styles.tagline}>{t('tagline')}</Text>
      </View>

      {/* Language selection */}
      <Text style={styles.selectLang}>{t('selectLanguage')}</Text>
      <View style={styles.langGrid}>
        {LANGUAGES.map(lang => (
          <TouchableOpacity
            key={lang.code}
            style={[styles.langBtn, selected === lang.code && styles.langBtnActive]}
            onPress={() => handleLanguage(lang.code)}
          >
            <Text style={styles.langFlag}>{lang.flag}</Text>
            <Text style={styles.langLabel}>{lang.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.btnPrimary} onPress={() => navigation.navigate('Register')}>
          <Text style={styles.btnPrimaryText}>{t('createAccount')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnSecondary} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.btnSecondaryText}>{t('signIn')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A1A', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  logoArea: { alignItems: 'center', marginBottom: 32 },
  shieldOuter: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: '#D32F2F', alignItems: 'center', justifyContent: 'center', marginBottom: 16, backgroundColor: 'rgba(21,101,192,0.2)' },
  shieldInner: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#1565C0', alignItems: 'center', justifyContent: 'center' },
  shieldCheck: { color: '#fff', fontSize: 24, fontWeight: '700' },
  appName: { color: '#fff', fontSize: 32, fontWeight: '700', letterSpacing: 4, marginBottom: 8 },
  tagline: { color: '#667', fontSize: 13, textAlign: 'center' },
  selectLang: { color: '#8888AA', fontSize: 12, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
  langGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginBottom: 32, width: '100%' },
  langBtn: { width: '44%', backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  langBtnActive: { borderColor: '#D32F2F', backgroundColor: 'rgba(211,47,47,0.1)' },
  langFlag: { fontSize: 24, marginBottom: 4 },
  langLabel: { color: '#CCC', fontSize: 12, fontWeight: '500' },
  actions: { width: '100%', gap: 12 },
  btnPrimary: { backgroundColor: '#D32F2F', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  btnSecondary: { backgroundColor: 'transparent', borderRadius: 14, paddingVertical: 16, alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.2)' },
  btnSecondaryText: { color: '#AAA', fontSize: 16 },
});
