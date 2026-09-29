// src/screens/DashboardScreen.jsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useStore } from '../store/useStore';

const ACTIONS = [
  { icon: '🔐', labelKey: 'vault', subKey: 'recentFiles', screen: 'Vault', color: 'rgba(211,47,47,0.15)' },
  { icon: '📷', labelKey: 'camera', subKey: 'privatePhoto', screen: 'Camera', color: 'rgba(21,101,192,0.15)' },
  { icon: '💬', labelKey: 'messages', sub: '', screen: 'Messages', color: 'rgba(76,175,80,0.15)' },
  { icon: '🚨', labelKey: 'alerts', subKey: 'noAlerts', screen: 'Alerts', color: 'rgba(255,165,0,0.15)' },
];

export default function DashboardScreen({ navigation }) {
  const { t } = useTranslation();
  const { user, files, plan } = useStore();
  const initials = user ? `${(user.firstName || 'U')[0]}${(user.name || 'S')[0]}`.toUpperCase() : 'SM';
  const displayName = user ? `${user.firstName} ${user.name}` : 'Utilisateur';

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.scroll}>
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.greeting}>{t('hello')} 👋</Text>
            <Text style={s.name}>{displayName}</Text>
          </View>
          <View style={s.avatar}><Text style={s.avatarText}>{initials}</Text></View>
        </View>

        {/* Security card */}
        <View style={s.secCard}>
          <Text style={s.secLabel}>{t('vault')}</Text>
          <View style={s.secRow}>
            <View style={s.dot} />
            <Text style={s.secVal}>{files.length} {t('recentFiles')}</Text>
          </View>
          <Text style={s.barPct}>{t('vaultOnlySecurity')}</Text>
        </View>

        {/* Plan badge */}
        <TouchableOpacity style={s.planBadge} onPress={() => navigation.navigate('Plans')}>
          <Text style={s.planText}>
            {plan === 'free' ? `🆓 ${t('free')} — ${t('plans')}` :
             plan === 'pro' ? `⭐ ${t('pro')}` :
             plan === 'premium' ? `💎 ${t('premium')}` : `🏢 ${t('business')}`}
          </Text>
          {plan === 'free' && <Text style={s.planArrow}>→</Text>}
        </TouchableOpacity>

        {/* Quick actions */}
        <View style={s.qaGrid}>
          {ACTIONS.map(a => (
            <TouchableOpacity key={a.labelKey} style={s.qaCard} onPress={() => navigation.navigate(a.screen)}>
              <View style={[s.qaIcon, { backgroundColor: a.color }]}>
                <Text style={{ fontSize: 22 }}>{a.icon}</Text>
              </View>
              <Text style={s.qaLabel}>{t(a.labelKey)}</Text>
              <Text style={s.qaSub}>{a.subKey === 'recentFiles' ? `${files.length} ${t('recentFiles')}` : a.subKey ? t(a.subKey) : ''}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Recent files */}
        <Text style={s.sectionTitle}>{t('recentFiles')}</Text>
        {files.length === 0 ? (
          <Text style={s.emptyText}>{t('vaultEmpty')}</Text>
        ) : (
          files.slice(0, 5).map(f => (
            <View key={f.id} style={s.fileRow}>
                <Text style={s.fileIcon}>{f.type === 'image' ? '🖼️' : '🎬'}</Text>
              <View style={s.fileInfo}>
                <Text style={s.fileName}>{f.type === 'video' ? t('video') : t('photo')} · {new Date(f.createdAt).toLocaleDateString()}</Text>
                <Text style={s.fileMeta}>AES-256-GCM · {((f.size || 0) / 1048576).toFixed(1)} MB</Text>
              </View>
              <Text style={s.fileLock}>🔒</Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A1A' },
  scroll: { padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  greeting: { color: '#8888AA', fontSize: 13 },
  name: { color: '#fff', fontSize: 18, fontWeight: '600' },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#D32F2F', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  secCard: { background: 'transparent', backgroundColor: '#1565C0', borderRadius: 14, padding: 14, marginBottom: 12 },
  secLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginBottom: 4 },
  secRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4CAF50' },
  secVal: { color: '#fff', fontSize: 15, fontWeight: '600' },
  barPct: { color: 'rgba(255,255,255,0.6)', fontSize: 10, textAlign: 'right' },
  planBadge: { backgroundColor: '#12122A', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  planText: { color: '#CCC', fontSize: 12 },
  planArrow: { color: '#D32F2F', fontSize: 14 },
  qaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  qaCard: { width: '47%', backgroundColor: '#12122A', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: 12, gap: 6 },
  qaIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  qaLabel: { color: '#DDD', fontSize: 12, fontWeight: '500' },
  qaSub: { color: '#666', fontSize: 11 },
  sectionTitle: { color: '#8888AA', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.05)' },
  fileIcon: { fontSize: 22 },
  fileInfo: { flex: 1 },
  fileName: { color: '#DDD', fontSize: 13, fontWeight: '500' },
  fileMeta: { color: '#555', fontSize: 11, marginTop: 2 },
  fileLock: { fontSize: 16, color: '#D32F2F' },
  emptyText: { color: '#555', fontSize: 13, textAlign: 'center', marginTop: 20 },
});
