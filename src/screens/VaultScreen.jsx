import { Alert } from '../components/AppDialog';
import PrivateVideo from '../components/PrivateVideo';
import { SecureOverlay } from '../components/SecureOverlay';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, FlatList, Image,  StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useCodePrompt } from '../components/CodePrompt';
import { hasVaultCode } from '../services/vaultCode';
import { useStore } from '../store/useStore';
import { deleteVaultFile, importVaultFile, listVaultFiles, openVaultFile, removePickerCopy, removeVaultPreview } from '../services/vault';

import { sendMedia, sendText } from '../services/messages';

export default function VaultScreen({route,navigation}) {
  const peer=route.params?.chatPeer;
  const { t } = useTranslation();
  const { askCode, codeModal } = useCodePrompt();
  const getCode = async (onSubmit) => {
    const exists = await hasVaultCode(userId);
    return askCode({ title: t(exists ? 'vaultCode' : 'vaultCodeSetup'), hint: t('vaultCodeHint'), create: !exists, onSubmit });
  };
  const userId = useStore(s => s.user?.id);
  const setFiles = useStore(s => s.setFiles);
  const [files, updateFiles] = useState([]);
  const [search, setSearch] = useState('');
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  const previewEpoch = useRef(0);

  useFocusEffect(useCallback(() => {
    let active = true;
    if (userId) listVaultFiles(userId).then(items => { if (active) { updateFiles(items); setFiles(items); } })
      .catch(e => Alert.alert(t('vault'), e.message));
    return () => { active = false; };
  }, [userId, t, setFiles]));

  const closePreview = useCallback(() => {
    previewEpoch.current++;
    setPreview(current => { if (current) removeVaultPreview(current.uri).catch(() => {}); return null; });
  }, []);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => { if (state !== 'active') closePreview(); });
    return () => { subscription.remove(); closePreview(); };
  }, [closePreview]);

  useFocusEffect(useCallback(() => () => closePreview(), [closePreview]));

  const pickMedia = async () => {
    if (busy) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { Alert.alert(t('vault'), t('galleryPermission')); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.All, quality: 1 });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setProgress(0); setBusy(true);
    try {
      if (useStore.getState().isLocked) throw new Error(t('unlockBeforeImport'));
      const code = await getCode(async code=>{const next=await importVaultFile(userId,asset,code.pin,setProgress);updateFiles(next);setFiles(next);});
      if (!code) return;
    }
    catch (e) { Alert.alert(t('vault'), e.message); }
    finally { await removePickerCopy(asset).catch(() => {}); setBusy(false); }
  };

  const showFile = async item => {
    if (busy) return;
    setProgress(0); setBusy(true);
    try {
      const epoch = previewEpoch.current;
      let uri;
      const code = await getCode(async code=>{
        const opened=await openVaultFile(userId,item,code.pin,setProgress);
        if(epoch!==previewEpoch.current){await removeVaultPreview(opened);return;}
        uri=opened;
      });
      if(!uri)return;
      if(!code || epoch!==previewEpoch.current){await removeVaultPreview(uri);return;}
      if(peer){
        try {
          const sent=await askCode({create:true,shareOption:true,onSubmit:code=>sendMedia(userId,peer.id,{uri,type:item.type,mimeType:({'png':'image/png','webp':'image/webp','mov':'video/quicktime'})[uri.split('.').pop()]},code.pin,setProgress)});
          if(!sent)return;
          if(sent.share)try{await sendText(userId,peer.id,t('sentCode',{code:sent.pin}));}catch{Alert.alert(t('messages'),t('sendFailedCode'));}
          navigation.setParams({chatPeer:null});navigation.navigate('Messages');
        } finally {await removeVaultPreview(uri);}
      }else setPreview({ uri, type: item.type });
    }
    catch (e) { Alert.alert(t('vault'), e.message); }
    finally { setBusy(false); }
  };

  const confirmDelete = item => Alert.alert(t('deleteFile'), t('deleteFileQuestion'), [
    { text: t('cancel'), style: 'cancel' },
    { text: t('deleteFile'), style: 'destructive', onPress: async () => {
      try { const next = await deleteVaultFile(userId, item); updateFiles(next); setFiles(next); }
      catch (e) { Alert.alert(t('vault'), e.message); }
    } },
  ]);

  const visible = files.filter(f => `${f.type} ${f.createdAt}`.toLowerCase().includes(search.toLowerCase()));
  return <View style={s.container}>{codeModal}
    <View style={s.header}><Text style={s.title}>🔐 {t('vault')}</Text>
      <TouchableOpacity onPress={pickMedia} disabled={busy} style={s.button}><Text style={s.buttonText}>+ {t('addFile')}</Text></TouchableOpacity>
    </View>
    {!!peer && <TouchableOpacity onPress={()=>navigation.setParams({chatPeer:null})}><Text style={s.hint}>{t('chatTarget',{name:`${peer.first_name||''} ${peer.last_name||''}`})} · {t('cancel')}</Text></TouchableOpacity>}
    <Text style={s.hint}>{t('vaultImportHint')}</Text>
    <TextInput style={s.input} placeholder={t('searchFiles')} placeholderTextColor="#888" value={search} onChangeText={setSearch} />
    {busy && <View style={{alignItems:"center",padding:12,gap:8}}><ActivityIndicator color="#82B9FF" /><Text style={s.hint}>{progress}%</Text></View>}
    <FlatList data={visible} keyExtractor={item => item.id} numColumns={2} contentContainerStyle={s.grid}
      ListEmptyComponent={<Text style={s.empty}>{t('vaultEmpty')}</Text>}
      renderItem={({ item }) => <TouchableOpacity style={s.card} disabled={busy} onPress={() => showFile(item)} onLongPress={() => confirmDelete(item)}>
        <Text style={s.icon}>{item.type === 'video' ? '🎬' : '🖼️'}</Text>
        <Text style={s.name}>{item.type === 'video' ? t('video') : t('photo')} · {new Date(item.createdAt).toLocaleDateString()}</Text>
        <Text style={s.meta}>{(item.size / 1048576).toFixed(1)} MB · AES-256-GCM</Text>
      </TouchableOpacity>}
    />
    <SecureOverlay visible={!!preview} onRequestClose={closePreview} animationType="fade">
      <View style={s.viewer}><TouchableOpacity onPress={closePreview} style={s.close}><Text style={s.buttonText}>✕ {t('close')}</Text></TouchableOpacity>
        {preview?.type === 'video' ? <PrivateVideo uri={preview.uri} />
          : preview && <Image source={{ uri: preview.uri }} resizeMode="contain" style={s.media} />}
      </View>
    </SecureOverlay>
  </View>;
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A1A', padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: '#fff', fontSize: 19, fontWeight: '700' },
  button: { backgroundColor: '#D32F2F', padding: 10, borderRadius: 10 }, buttonText: { color: '#fff', fontWeight: '700' },
  hint: { color: '#AAA', fontSize: 12, marginVertical: 12 },
  input: { color: '#fff', backgroundColor: '#12122A', padding: 12, borderRadius: 10, marginBottom: 10 },
  grid: { gap: 12, paddingBottom: 30 },
  card: { width: '48%', marginRight: '2%', backgroundColor: '#12122A', borderRadius: 12, padding: 18, minHeight: 125 },
  icon: { fontSize: 32 }, name: { color: '#fff', fontSize: 13, marginTop: 10 }, meta: { color: '#AAB', fontSize: 10, marginTop: 4 },
  empty: { color: '#AAA', marginTop: 40, textAlign: 'center' },
  viewer: { flex: 1, backgroundColor: '#050510', justifyContent: 'center' },
  close: { position: 'absolute', top: 40, right: 20, zIndex: 2, padding: 14 }, media: { width: '100%', height: '80%' },
});
