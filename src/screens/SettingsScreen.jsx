// ============================================================
// src/screens/SettingsScreen.jsx
// ============================================================
import React, { useState } from 'react';
import { View, Text, Switch, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useStore } from '../store/useStore';
import i18n from '../i18n';
import { signOutAccount } from '../services/auth';

const LANGS = [
  { code: 'fr', label: '🇫🇷 Français' },
  { code: 'en', label: '🇺🇸 English' },
  { code: 'es', label: '🇪🇸 Español' },
  { code: 'ht', label: '🇭🇹 Kreyòl' },
];

export function SettingsScreen({ navigation }) {
  const { t } = useTranslation();
  const { user, language, biometricEnabled, logout, setLanguage } = useStore();
  const [biometric, setBiometric] = useState(biometricEnabled);

  const handleLogout = () => {
    Alert.alert('Dekonekte', 'Ou vle dekonekte?', [
      { text: 'Wi, dekonekte', style: 'destructive', onPress: async () => {
        try {
          await signOutAccount();
          logout();
        } catch (e) {
          Alert.alert('Dekoneksyon echwe', e.message);
        }
      } },
      { text: 'Non', style: 'cancel' },
    ]);
  };

  const handleLangChange = (code) => {
    i18n.changeLanguage(code);
    setLanguage(code);
  };

  return (
    <SafeAreaView style={ss.container}>
      <ScrollView contentContainerStyle={ss.scroll}>
        <Text style={ss.title}>⚙️ {t('settings')}</Text>

        {/* Profile */}
        <View style={ss.section}>
          <Text style={ss.sectionTitle}>Pwofil</Text>
          <View style={ss.profileRow}>
            <View style={ss.avatar}><Text style={ss.avatarText}>{user ? `${(user.firstName||'U')[0]}${(user.name||'S')[0]}`.toUpperCase() : 'SM'}</Text></View>
            <View>
              <Text style={ss.profileName}>{user ? `${user.firstName} ${user.name}` : 'Utilisateur'}</Text>
              <Text style={ss.profileEmail}>{user?.email || ''}</Text>
            </View>
          </View>
        </View>

        {/* Language */}
        <View style={ss.section}>
          <Text style={ss.sectionTitle}>Lang / Language</Text>
          {LANGS.map(l => (
            <TouchableOpacity key={l.code} style={ss.item} onPress={() => handleLangChange(l.code)}>
              <Text style={ss.itemLabel}>{l.label}</Text>
              {language === l.code && <Text style={{ color: '#D32F2F' }}>✓</Text>}
            </TouchableOpacity>
          ))}
        </View>

        {/* Security */}
        <View style={ss.section}>
          <Text style={ss.sectionTitle}>{t('security')}</Text>
          <View style={ss.item}>
            <Text style={ss.itemLabel}>👆 {t('biometricAuth')}</Text>
            <Switch value={biometric} onValueChange={setBiometric} trackColor={{ true: '#D32F2F' }} />
          </View>
          <TouchableOpacity style={ss.item} onPress={() => navigation.navigate('Plans')}>
            <Text style={ss.itemLabel}>💎 {t('plans')}</Text>
            <Text style={ss.arrow}>→</Text>
          </TouchableOpacity>
        </View>

        {/* Danger */}
        <View style={ss.section}>
          <TouchableOpacity style={ss.dangerBtn} onPress={handleLogout}>
            <Text style={ss.dangerText}>🚪 {t('logout')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const ss = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A1A' },
  scroll: { padding: 16 },
  title: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 20 },
  section: { backgroundColor: '#12122A', borderRadius: 14, marginBottom: 14, overflow: 'hidden', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)' },
  sectionTitle: { color: '#8888AA', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, padding: 12, paddingBottom: 6 },
  item: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.04)' },
  itemLabel: { color: '#DDD', fontSize: 14 },
  arrow: { color: '#555', fontSize: 16 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#D32F2F', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  profileName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  profileEmail: { color: '#8888AA', fontSize: 12, marginTop: 2 },
  dangerBtn: { padding: 14, alignItems: 'center' },
  dangerText: { color: '#D32F2F', fontSize: 15, fontWeight: '600' },
});

export default SettingsScreen;
