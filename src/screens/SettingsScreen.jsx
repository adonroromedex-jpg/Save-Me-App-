// ============================================================
// src/screens/SettingsScreen.jsx
// ============================================================
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useStore } from '../store/useStore';
import { changeAppLanguage } from '../i18n/language';
import { signOutAccount } from '../services/auth';
import { updateProfile } from '../services/messages';

const LANGS = [
  { code: 'fr', label: '🇫🇷 Français' },
  { code: 'en', label: '🇺🇸 English' },
  { code: 'es', label: '🇪🇸 Español' },
  { code: 'ht', label: '🇭🇹 Kreyòl' },
];

export function SettingsScreen({ navigation }) {
  const { t } = useTranslation();
  const { user, language, logout, setUser } = useStore();
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({ firstName: user?.firstName || '', name: user?.name || '', phoneNumber: user?.phoneNumber || '' });
  const [saving, setSaving] = useState(false);

  const saveProfile = async () => {
    setSaving(true);
    try {
      const updated = await updateProfile(form);
      setUser({ ...user, firstName: updated.user_metadata.firstName, name: updated.user_metadata.name,
        phoneNumber: updated.user_metadata.phoneNumber });
      setEdit(false);
    } catch (e) { Alert.alert(t('profile'), e.message); }
    finally { setSaving(false); }
  };

  const handleLogout = () => {
    Alert.alert(t('logout'), t('logoutQuestion'), [
      { text: t('logout'), style: 'destructive', onPress: async () => {
        try {
          await signOutAccount();
          logout();
        } catch (e) {
          Alert.alert(t('logout'), e.message);
        }
      } },
      { text: t('cancel'), style: 'cancel' },
    ]);
  };

  const handleLangChange = (code) => {
    changeAppLanguage(code).catch(() => Alert.alert(t('language'), t('languageSaveFailed')));
  };

  return (
    <SafeAreaView style={ss.container}>
      <ScrollView contentContainerStyle={ss.scroll}>
        <Text style={ss.title}>⚙️ {t('settings')}</Text>

        {/* Profile */}
        <View style={ss.section}>
          <Text style={ss.sectionTitle}>{t('profile')}</Text>
          <View style={ss.profileRow}>
            <View style={ss.avatar}><Text style={ss.avatarText}>{user ? `${(user.firstName||'U')[0]}${(user.name||'S')[0]}`.toUpperCase() : 'SM'}</Text></View>
            <View>
              <Text style={ss.profileName}>{user ? `${user.firstName} ${user.name}` : 'Utilisateur'}</Text>
              <Text style={ss.profileEmail}>{user?.email || ''}</Text>
            </View>
          </View>
          <Text style={ss.profileEmail}>{user?.phoneNumber || t('phoneMissing')}</Text>
          {edit ? <View style={{ padding: 14 }}>
            {['firstName', 'name', 'phoneNumber'].map(key => <TextInput key={key} style={ss.input}
              placeholder={t(key === 'phoneNumber' ? 'phoneFull' : key)} placeholderTextColor="#999"
              keyboardType={key === 'phoneNumber' ? 'phone-pad' : 'default'}
              value={form[key]} onChangeText={value => setForm(previous => ({ ...previous, [key]: value }))} />)}
            <TouchableOpacity style={ss.item} disabled={saving} onPress={saveProfile}><Text style={ss.itemLabel}>{t('saveProfile')}</Text></TouchableOpacity>
          </View> : <TouchableOpacity style={ss.item} onPress={() => setEdit(true)}><Text style={ss.itemLabel}>{t('editProfile')}</Text></TouchableOpacity>}
        </View>

        {/* Language */}
        <View style={ss.section}>
          <Text style={ss.sectionTitle}>{t('language')}</Text>
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
          <View style={ss.item}><Text style={ss.itemLabel}>👆 {t('biometricAuth')}</Text></View>
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
  input: { color: '#fff', backgroundColor: '#22223B', borderRadius: 8, padding: 12, marginBottom: 8 },
});

export default SettingsScreen;
