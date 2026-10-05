import { enableNotifications } from '../services/notifications';
import { shareProfileWithContacts } from '../services/profileCards';
import * as ImagePicker from 'expo-image-picker';
import { saveProfilePhoto, loadProfilePhoto } from '../services/profilePhoto';
import { removePickerCopy } from '../services/vault';
import { Alert } from '../components/AppDialog';
// ============================================================
// src/screens/SettingsScreen.jsx
// ============================================================
import React, { useState, useEffect } from 'react';
import { View, Image, Text, NativeModules, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
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
  const { user, language, logout, patchUser } = useStore();
  const syncIssues = useStore(state=>state.syncIssues);
  const deliveries=useStore(state=>state.deliveryMetrics);
  const metrics = useStore(state=>state.transferMetrics);
  const seconds = value => (value/1000).toFixed(1);
  const locked = useStore(state => state.isLocked);
  const [photo, setPhoto] = useState(null);
  useEffect(() => {
    let active=true; setPhoto(null);
    if(user?.id && !locked) loadProfilePhoto(user.id).then(uri=>{if(active)setPhoto(uri);}).catch(()=>{});
    return ()=>{active=false;};
  }, [user?.id, locked]);
  const changePhoto = async () => {
    if(saving)return;
    let asset;
    setSaving(true);
    try {
      const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();
      if(!permission.granted) throw new Error(t('galleryPermission'));
      const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:ImagePicker.MediaTypeOptions.Images,allowsEditing:true,aspect:[1,1],quality:0.4});
      asset=result.assets?.[0]; if(result.canceled || !asset)return;
      await saveProfilePhoto(user.id,asset);
      setPhoto(await loadProfilePhoto(user.id));
      shareProfileWithContacts().catch(e=>useStore.getState().setSyncIssue('profile',{message:e.message}));
    } catch(error) { Alert.alert(t('profile'),error.message); }
    finally { if(asset)await removePickerCopy(asset).catch(()=>{}); setSaving(false); }
  };
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({ firstName: user?.firstName || '', name: user?.name || '' });
  const [notificationStatus,setNotificationStatus]=useState('');
  const [saving, setSaving] = useState(false);

  const saveProfile = async () => {
    setSaving(true);
    try {
      const updated = await updateProfile(form);
      if(useStore.getState().user?.id!==updated.id)return;
      patchUser({ firstName: updated.user_metadata.firstName, name: updated.user_metadata.name,
        phoneNumber: updated.user_metadata.phoneNumber });
      shareProfileWithContacts().catch(e=>useStore.getState().setSyncIssue('profile',{message:e.message}));
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
            <View style={ss.avatar}>{photo ? <Image source={{uri:photo}} style={{width:46,height:46,borderRadius:23}} /> : <Text style={ss.avatarText}>{user ? `${(user.firstName||'U')[0]}${(user.name||'S')[0]}`.toUpperCase() : 'SM'}</Text>}</View>
            <View>
              <Text style={ss.profileName}>{user ? `${user.firstName} ${user.name}` : t('profile')}</Text>
              <Text style={ss.profileEmail}>{user?.email || ''}</Text>
            </View>
          </View>
          <Text style={ss.profileEmail}>{user?.phoneNumber || t('phoneMissing')}</Text>
          <Text style={[ss.profileEmail,{paddingHorizontal:14,paddingVertical:8}]}>{t('profileIdentifiersLocked')}</Text>
          <TouchableOpacity disabled={saving} style={ss.item} onPress={changePhoto}><Text style={ss.itemLabel}>{t('changeProfilePhoto')}</Text></TouchableOpacity>
          <Text style={[ss.profileEmail,{paddingHorizontal:14,paddingBottom:12}]}>{t('profilePhotoLocal')}</Text>
          {edit ? <View style={{ padding: 14 }}>
            {['firstName', 'name'].map(key => <TextInput key={key} style={ss.input}
              placeholder={t(key)} placeholderTextColor="#999"
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

        <View style={ss.section}><TouchableOpacity style={ss.item} onPress={async()=>{try{setNotificationStatus(await enableNotifications());}catch(e){Alert.alert(t('notifications'),e.message);}}}>
          <Text style={ss.itemLabel}>{t('enableNotifications')}</Text></TouchableOpacity>
          {!!notificationStatus&&<Text style={[ss.profileEmail,{padding:14}]}>{t('notifications_'+notificationStatus)}</Text>}
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

        <View style={ss.section}>
          <Text style={ss.sectionTitle}>Save Me · 1.3.1</Text>
          <Text style={[ss.profileEmail,{padding:14}]}>{t(NativeModules.SaveMeCrypto?.decryptFileAppend ? 'cryptoNative' : 'cryptoCompatibility')}</Text>
          {Object.entries(syncIssues).filter(([,issue])=>issue).map(([kind,issue])=><View key={kind} style={{padding:14}}>
            <Text style={{color:'#FFB7B7',fontWeight:'700'}}>{t(kind==='identity'?'identitySyncIssue':'profileSyncIssue')}</Text>
            <Text selectable style={ss.profileEmail}>{issue.code ? `[${issue.code}] ` : ''}{issue.message}</Text>
          </View>)}
          <Text style={ss.sectionTitle}>{t('transferDetails')}</Text>
          <Text style={[ss.profileEmail,{padding:14}]}>{t('transferTimingHint')}</Text>
          <Text style={[ss.profileEmail,{padding:14}]}>{t('deliveryTimingHint')}</Text>
          {deliveries.map(metric=><Text key={metric.id} style={[ss.profileEmail,{paddingHorizontal:14,paddingBottom:8}]}>{t(({audio:'voice',image:'photo',video:'video',text:'text'})[metric.kind])} · {t('messageDelivered')}: {seconds(metric.ms)} s</Text>)}
          {metrics.map((metric,index)=><View key={index} style={{padding:14,borderTopWidth:1,borderTopColor:'#25324A'}}>
            <Text style={ss.itemLabel}>{t(metric.direction==='send'?'send':'receive')} · {t(({audio:'voice',image:'photo',video:'video',text:'text'})[metric.kind])} · {(metric.bytes/1048576).toFixed(2)} MB</Text>
            <Text style={ss.profileEmail}>{t('transferTotal')}: {seconds(metric.total)} s</Text>
            <Text style={ss.profileEmail}>{t('transferPhase_prepare')}: {seconds(metric.prepare)} s · {t('transferPhase_transfer')}: {seconds(metric.transfer)} s · {t('transferPhase_validate')}: {seconds(metric.validate)} s</Text>
          </View>)}
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
