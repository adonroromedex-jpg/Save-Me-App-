import useOwnAvatar from '../hooks/useOwnAvatar';
import React, { useCallback } from 'react';
import { View, Image, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useStore } from '../store/useStore';
import { listVaultFiles } from '../services/vault';

export default function DashboardScreen({ navigation }) {
  const { t } = useTranslation();
  const { user, files, plan, setFiles } = useStore();
  const avatar=useOwnAvatar();
  const unread=useStore(s=>s.unread);
  const initials = user ? `${(user.firstName || 'U')[0]}${(user.name || 'S')[0]}`.toUpperCase() : 'SM';
  const displayName = `${user?.firstName || ''} ${user?.name || ''}`.trim() || t('profile');
  useFocusEffect(useCallback(() => {
    let active = true;
    if (user?.id) listVaultFiles(user.id).then(items => { if (active) setFiles(items); }).catch(() => {});
    return () => { active = false; };
  }, [user?.id, setFiles]));

  return <View style={s.container}>
    <ScrollView contentContainerStyle={s.scroll}>
      <View style={s.header}>
        <View style={{ flex: 1 }}><Text style={s.greeting}>{t('hello')}</Text><Text style={s.name}>{displayName}</Text></View>
        <TouchableOpacity accessibilityLabel={t('notifications')} onPress={()=>navigation.navigate('Messages')} style={{padding:8}}><Ionicons name="notifications-outline" size={25} color="#D5E7FF" />{!!unread&&<Text style={{position:'absolute',top:0,right:0,color:'#fff',backgroundColor:'#C53859',borderRadius:10,paddingHorizontal:5,fontSize:10}}>{Math.min(unread,99)}</Text>}</TouchableOpacity>
        <View style={s.avatar}>{avatar?<Image source={{uri:avatar}} style={{width:48,height:48,borderRadius:24}} />:<Text style={s.avatarText}>{initials}</Text>}</View>
      </View>
      <TouchableOpacity style={s.planBadge} onPress={() => navigation.navigate('Plans')} accessibilityRole="button">
        <Ionicons name="diamond-outline" size={19} color="#8FBFFF" />
        <Text style={s.planText}>{t(plan)} · {t('plans')}</Text>
        <Ionicons name="chevron-forward" size={17} color="#8FBFFF" />
      </TouchableOpacity>
      <Text style={s.sectionTitle}>{t('recentFiles')}</Text>
      {files.length === 0 ? <View style={s.empty}>
        <View style={s.emptyIcon}><Ionicons name="lock-closed-outline" size={32} color="#8FBFFF" /></View>
        <Text style={s.emptyTitle}>{t('homePrivateSpace')}</Text>
        <Text style={s.emptyText}>{t('homeVaultHint')}</Text>
      </View> : files.slice(0, 5).map(file => <View key={file.id} style={s.fileRow}>
        <View style={s.fileIcon}><Ionicons name={file.type === 'video' ? 'videocam-outline' : 'image-outline'} size={22} color="#B8D5FF" /></View>
        <View style={s.fileInfo}>
          <Text style={s.fileName}>{t(file.type === 'video' ? 'video' : 'photo')} · {new Date(file.createdAt).toLocaleDateString()}</Text>
          <Text style={s.fileMeta}>{((file.size || 0) / 1048576).toFixed(1)} MB</Text>
        </View>
        <Ionicons name="lock-closed-outline" size={15} color="#7F9EBB" />
      </View>)}
    </ScrollView>
  </View>;
}
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A1A' },
  scroll: { padding: 22, paddingBottom: 32, flexGrow: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 14, marginBottom: 30 },
  greeting: { color: '#9AAAC1', fontSize: 14, marginBottom: 6 },
  name: { color: '#FFFFFF', fontSize: 25, fontWeight: '700' },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#16365B', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#D5E7FF', fontSize: 16, fontWeight: '700' },
  planBadge: { backgroundColor: '#111E33', borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 30 },
  planText: { color: '#CBD8EA', fontSize: 13, flex: 1 },
  sectionTitle: { color: '#A6B4C7', fontSize: 13, fontWeight: '600', marginBottom: 16 },
  empty: { alignItems: 'center', paddingHorizontal: 22, paddingVertical: 42 },
  emptyIcon: { width: 72, height: 72, backgroundColor: '#111E33', borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyTitle: { color: '#E1EAF7', fontSize: 17, fontWeight: '600', textAlign: 'center', marginBottom: 10 },
  emptyText: { color: '#91A0B8', fontSize: 14, lineHeight: 22, textAlign: 'center' },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#192138' },
  fileIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#111E33', alignItems: 'center', justifyContent: 'center' },
  fileInfo: { flex: 1 }, fileName: { color: '#E1EAF7', fontSize: 14 }, fileMeta: { color: '#8498B4', fontSize: 12, marginTop: 5 },
});
