import PrivateVideo from '../components/PrivateVideo';
import { SecureOverlay } from '../components/SecureOverlay';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, FlatList, Image, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as Contacts from 'expo-contacts';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useStore } from '../store/useStore';
import { listConversations, listMessages, lookupContact, openMedia, authorizeMedia, normalizePhone, sendMedia, sendText, setContactBlocked } from '../services/messages';
import { securityNumbers } from '../services/identity';
import { removePickerCopy } from '../services/vault';
import { removePrivateFile } from '../services/privateFiles';
import { useCodePrompt } from '../components/CodePrompt';

const label = p => `${p?.first_name || ''} ${p?.last_name || ''}`.trim() || 'Save Me';
const colors = ['#1565C0','#4B3781','#17655D','#7F3546'];
export default function MessagesScreen({ navigation }) {
  const { t } = useTranslation();
  const user = useStore(s => s.user);
  const { askCode, codeModal } = useCodePrompt();
  const [menuOpen,setMenuOpen] = useState(false);
  const [peer,setPeer] = useState(null), [mode,setMode] = useState('list');
  const [conversations,setConversations] = useState([]), [messages,setMessages] = useState([]), [contacts,setContacts] = useState([]);
  const [filter,setFilter] = useState(''), [phone,setPhone] = useState(''), [input,setInput] = useState('');
  const [busy,setBusy] = useState(false), [error,setError] = useState(''), [progress,setProgress] = useState(null);
  const [preview,setPreview] = useState(null), [recording,setRecording] = useState(false), [voice,setVoice] = useState(null);
  const [seconds,setSeconds] = useState(0), [color,setColor] = useState(colors[0]), [loadingOlder,setLoadingOlder] = useState(false);
  const peerRef = useRef(null), previewRef = useRef(null), recordingRef = useRef(null), voiceRef = useRef(null), soundRef = useRef(null);
  const alive = useRef(true), focused = useRef(false), operation = useRef(0), refreshing = useRef(false);
  const themeKey = person => `chat-theme-${user.id}-${person.id}`;
  const stopSound = useCallback(async () => { const sound=soundRef.current; soundRef.current=null; if(sound) await sound.unloadAsync().catch(()=>{}); },[]);
  const closePreview = useCallback(() => {
    const current=previewRef.current; previewRef.current=null; setPreview(null);
    stopSound().finally(()=>{if(current) removePrivateFile(current.uri).catch(()=>{});});
  },[stopSound]);
  const discardVoice = useCallback(async () => {
    await stopSound();
    const item=voiceRef.current; voiceRef.current=null; setVoice(null);
    if(item) await removePickerCopy(item).catch(()=>{});
  },[stopSound]);
  const abortRecording = useCallback(async () => {
    const recorder=recordingRef.current; recordingRef.current=null; setRecording(false);
    if(recorder) { await recorder.stopAndUnloadAsync().catch(()=>{}); await removePickerCopy({uri:recorder.getURI()}).catch(()=>{}); }
    await Audio.setAudioModeAsync({allowsRecordingIOS:false,staysActiveInBackground:false}).catch(()=>{});
  },[]);
  const refresh = useCallback(async () => {
    if(!user?.id || refreshing.current || !focused.current || AppState.currentState!=='active') return;
    refreshing.current=true;
    const target=peerRef.current?.id;
    try {
      if(target) {
        const rows=await listMessages(user.id,target);
        if(alive.current && peerRef.current?.id===target && focused.current) setMessages(current=>{
          const cutoff=rows[rows.length-1]?.created_at;
          const older=cutoff?current.filter(m=>m.created_at<cutoff && (!m.expires_at || new Date(m.expires_at).getTime()>Date.now())):[];
          return [...rows,...older];
        });
      } else {
        const rows=await listConversations(user.id);
        if(alive.current && !peerRef.current && focused.current) setConversations(rows);
      }
      if(alive.current) setError('');
    } catch(e) { if(alive.current) setError(e.message); }
    finally { refreshing.current=false; }
  },[user?.id]);
  useFocusEffect(useCallback(()=>{
    focused.current=true; refresh(); const timer=setInterval(refresh,8000);
    return ()=>{ focused.current=false; operation.current++; clearInterval(timer); closePreview(); abortRecording(); discardVoice(); };
  },[refresh,closePreview,abortRecording,discardVoice]));
  useEffect(()=>{
    alive.current=true;
    const sub=AppState.addEventListener('change',state=>{if(state!=='active'){operation.current++;closePreview();abortRecording();discardVoice();}});
    return ()=>{alive.current=false;operation.current++;sub.remove();};
  },[closePreview,abortRecording,discardVoice]);
  useEffect(()=>{
    if(!preview) return;
    let stopped=false,checking=false;
    const close=()=>{if(!stopped){closePreview();setError(t('previewClosed'));}};
    const ttl=preview.deadline-performance.now();
    const expiry=Number.isFinite(ttl)?setTimeout(close,Math.max(0,ttl)):null;
    const timer=setInterval(async()=>{
      if(checking) return; checking=true;
      try { await authorizeMedia(preview.message.id); } catch { close(); }
      finally {checking=false;}
    },5000);
    return ()=>{stopped=true;clearInterval(timer);if(expiry)clearTimeout(expiry);};
  },[preview,closePreview,t]);

  const openChat=person=>{
    operation.current++;closePreview();discardVoice();abortRecording();
    peerRef.current=person;setPeer(person);setMode('chat');setMessages([]);setInput('');setError('');
    setColor(colors[0]);AsyncStorage.getItem(themeKey(person)).then(v=>{if(v && peerRef.current?.id===person.id)setColor(v);});
    listMessages(user.id,person.id).then(rows=>{if(peerRef.current?.id===person.id && alive.current)setMessages(rows);}).catch(e=>setError(e.message));
  };
  const back=()=>{operation.current++;closePreview();discardVoice();abortRecording();peerRef.current=null;setPeer(null);setMode('list');setInput('');refresh();};
  const older=async()=>{
    if(loadingOlder || !messages.length)return;setLoadingOlder(true);const target=peer.id;
    try {const rows=await listMessages(user.id,target,messages[messages.length-1].created_at);if(peerRef.current?.id===target)setMessages(current=>[...current,...rows.filter(r=>!current.some(m=>m.id===r.id))]);}
    catch(e){setError(e.message);}finally{setLoadingOlder(false);}
  };
  const browseContacts=async()=>{
    setMode('contacts');
    const permission=await Contacts.requestPermissionsAsync();
    if(!permission.granted){Alert.alert(t('messages'),t('contactsPermission'));return;}
    setBusy(true);
    try {const all=[];let offset=0,more=true;while(more && offset<10000){
      const page=await Contacts.getContactsAsync({fields:[Contacts.Fields.PhoneNumbers],pageSize:500,pageOffset:offset});
      all.push(...page.data.filter(c=>c.phoneNumbers?.length));more=page.hasNextPage && page.data.length>0;offset+=page.data.length;
    }setContacts(all);}catch(e){Alert.alert(t('messages'),e.message);}finally{setBusy(false);}
  };
  const findPhone=async number=>{
    setBusy(true);try{
      const normalized=normalizePhone(number,user?.countryCode||'');
      if(!normalized)throw new Error(t('countryCodeNeeded'));
      if(normalized===normalizePhone(user?.phoneNumber,user?.countryCode||''))throw new Error(t('ownPhoneContact'));
      const found=await lookupContact(normalized);if(!found)Alert.alert(t('messages'),t('contactNotFound'));else openChat(found);
    }catch(e){Alert.alert(t('messages'),e.message);}finally{setBusy(false);}
  };
  const submitText=async()=>{
    if(!input.trim() || busy || !peer)return;setBusy(true);
    try{await sendText(user.id,peer.id,input);setInput('');await refresh();}catch(e){Alert.alert(t('messages'),e.message);}finally{setBusy(false);}
  };
  const pickMedia=async()=>{
    if(busy)return;
    const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();if(!permission.granted){Alert.alert(t('messages'),t('galleryPermission'));return;}
    const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:ImagePicker.MediaTypeOptions.All,quality:0.85,videoExportPreset:ImagePicker.VideoExportPreset.MediumQuality});
    if(result.canceled || !result.assets?.[0])return;
    const asset=result.assets[0];setBusy(true);
    try{
      const code=await askCode({create:true,shareOption:true});if(!code)return;
      await sendMedia(user.id,peer.id,asset,code.pin,setProgress);
      if(code.share)try{await sendText(user.id,peer.id,t('sentCode',{code:code.pin}));}catch{Alert.alert(t('messages'),t('sendFailedCode'));}
      await refresh();
    }catch(e){Alert.alert(t('messages'),e.message);}finally{await removePickerCopy(asset).catch(()=>{});setBusy(false);setProgress(null);}
  };
  const attachments=()=>Alert.alert(t('attachment'),'',[
    {text:t('fromGallery'),onPress:pickMedia},{text:t('fromCamera'),onPress:()=>navigation.navigate('Camera',{chatPeer:peer})},{text:t('cancel'),style:'cancel'}]);
  const viewMedia=async message=>{
    if(busy)return;
    if(!message.media_parts){Alert.alert(t('messages'),t('upgradeMedia'));return;}
    closePreview();setBusy(true);
    try{
      const code=message.media_kind==='audio'?{}:await askCode({});if(!code)return;
      const token=++operation.current;
      const result=await openMedia(user.id,message,code.pin,setProgress);
      if(token!==operation.current || !alive.current || !focused.current){await removePrivateFile(result.uri);return;}
      previewRef.current=result;setPreview(result);
    }catch(e){Alert.alert(t('messages'),e.message);await refresh();}finally{setBusy(false);setProgress(null);}
  };
  const play=async uri=>{
    await stopSound();await Audio.setAudioModeAsync({allowsRecordingIOS:false,playsInSilentModeIOS:true,staysActiveInBackground:false});
    const {sound}=await Audio.Sound.createAsync({uri},{shouldPlay:true});
    if(!alive.current || !focused.current || AppState.currentState!=='active'){await sound.unloadAsync();return;}
    soundRef.current=sound;
  };
  const startVoice=async()=>{
    if(busy || recording || voice)return;setBusy(true);
    try{
      const permission=await Audio.requestPermissionsAsync();if(!permission.granted)throw new Error(t('microphonePermission'));
      await Audio.setAudioModeAsync({allowsRecordingIOS:true,playsInSilentModeIOS:true,staysActiveInBackground:false});
      const recorder=new Audio.Recording();recordingRef.current=recorder;
      await recorder.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      if(!focused.current || AppState.currentState!=='active'){await abortRecording();return;}
      recorder.setOnRecordingStatusUpdate(status=>{setSeconds(Math.floor(status.durationMillis/1000));});
      await recorder.startAsync();setSeconds(0);setRecording(true);
    }catch(e){await abortRecording();Alert.alert(t('voice'),e.message);}finally{setBusy(false);}
  };
  const stopVoice=async()=>{
    const recorder=recordingRef.current;if(!recorder)return;recordingRef.current=null;setRecording(false);setBusy(true);
    try{await recorder.stopAndUnloadAsync();const asset={uri:recorder.getURI(),type:'audio',mimeType:'audio/mp4'};
      if(!focused.current || AppState.currentState!=='active'){await removePickerCopy(asset);return;}
      voiceRef.current=asset;setVoice(asset);
    }catch(e){Alert.alert(t('voice'),e.message);}finally{await Audio.setAudioModeAsync({allowsRecordingIOS:false});setBusy(false);}
  };
  useEffect(()=>{if(recording && seconds>=180)stopVoice();},[seconds,recording]);
  const sendVoice=async()=>{
    if(!voice || busy)return;setBusy(true);
    try{await stopSound();await sendMedia(user.id,peer.id,voice,null,setProgress);await discardVoice();await refresh();}
    catch(e){Alert.alert(t('voice'),e.message);}finally{setBusy(false);setProgress(null);}
  };
  const menu=()=>setMenuOpen(true);
  const menuItems = [
    ['securityNumbers', async()=>{try{Alert.alert(t('securityNumbers'),`${t('securityHint')}\n\n${await securityNumbers(user.id,peer.id)}`);}catch(e){Alert.alert(t('messages'),e.message);}}],
    ['chatColor',()=>{const next=colors[(colors.indexOf(color)+1)%colors.length];setColor(next);AsyncStorage.setItem(themeKey(peer),next);} ],
    ['blockContact',async()=>{try{await setContactBlocked(user.id,peer.id,true);back();}catch(e){Alert.alert(t('messages'),e.message);}}],
    ['unblockContact',async()=>{try{await setContactBlocked(user.id,peer.id,false);}catch(e){Alert.alert(t('messages'),e.message);}}],
  ];
  const kindLabel=kind=>t(kind==='audio'?'voice':kind==='video'?'video':'photo');
  const expiryLabel=m=>{const mins=Math.max(0,Math.ceil((new Date(m.expires_at).getTime()-Date.now())/60000));return t('expiresIn',{hours:Math.floor(mins/60),minutes:mins%60});};
  return <View style={s.container}>{codeModal}
    <SecureOverlay visible={menuOpen} transparent onRequestClose={()=>setMenuOpen(false)} animationType="fade">
      <View style={{flex:1,backgroundColor:'rgba(0,0,0,0.8)',justifyContent:'center',padding:24}}><View style={{backgroundColor:'#18182D',borderRadius:18,padding:12}}>
        <Text style={[s.title,{padding:16}]}>{t('chatMenu')}</Text>
        {menuItems.map(([key,action])=><TouchableOpacity key={key} style={s.row} onPress={()=>{setMenuOpen(false);action();}}><Text style={s.link}>{t(key)}</Text></TouchableOpacity>)}
        <TouchableOpacity style={s.row} onPress={()=>setMenuOpen(false)}><Text style={s.link}>{t('close')}</Text></TouchableOpacity>
      </View></View>
    </SecureOverlay>
    <View style={s.header}>
      {mode!=='list' && <TouchableOpacity disabled={busy} onPress={back}><Text style={s.link}>{t('back')}</Text></TouchableOpacity>}
      <Text numberOfLines={1} style={[s.title,{flexShrink:1}]}>{mode==='chat'?label(peer):mode==='contacts'?t('phoneContacts'):t('messages')}</Text>
      {mode==='list' && <TouchableOpacity onPress={browseContacts}><Text style={s.link}>＋ {t('newChat')}</Text></TouchableOpacity>}
      {mode==='chat' && <TouchableOpacity onPress={menu} accessibilityLabel={t('chatMenu')}><Text style={s.link}>•••</Text></TouchableOpacity>}
    </View>
    {!!error && <Text style={s.error}>{error}</Text>}
    {busy && <View style={s.inputRow}><ActivityIndicator color="#82B9FF" />{progress!==null && <Text style={s.sub}>{progress}%</Text>}</View>}
    {mode==='list' && <>
      <TouchableOpacity onPress={()=>setMode('contacts')} style={s.action}><Text style={s.actionText}>{t('findByPhone')} →</Text></TouchableOpacity>
      <FlatList data={conversations} keyExtractor={r=>r.peer.id} onRefresh={refresh} refreshing={false} ListEmptyComponent={<Text style={s.empty}>{t('noConversations')}</Text>}
        renderItem={({item})=><TouchableOpacity style={s.row} onPress={()=>openChat(item.peer)}><Text style={s.person}>{label(item.peer)}</Text><Text style={s.sub}>🔒 {item.last.media_kind?kindLabel(item.last.media_kind):t('encryptedMessage')}</Text></TouchableOpacity>} />
    </>}
    {mode==='contacts' && <>
      <Text style={s.hint}>{t('contactPrivacy')}</Text>
      <TouchableOpacity style={s.action} onPress={browseContacts}><Text style={s.actionText}>{t('phoneContacts')}</Text></TouchableOpacity>
      <View style={s.inputRow}><TextInput style={s.input} placeholder="+509…" placeholderTextColor="#888" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
        <TouchableOpacity style={s.send} onPress={()=>findPhone(phone)} disabled={busy}><Text style={s.sendText}>→</Text></TouchableOpacity></View>
      <TextInput style={s.search} placeholder={t('searchContacts')} placeholderTextColor="#888" value={filter} onChangeText={setFilter} />
      <FlatList keyboardShouldPersistTaps="handled" data={contacts.flatMap(c=>(c.phoneNumbers||[]).map((n,i)=>({id:`${c.id}-${i}`,name:c.name,number:n.number}))).filter(c=>`${c.name} ${c.number}`.toLowerCase().includes(filter.toLowerCase()))}
        keyExtractor={c=>c.id} renderItem={({item})=><TouchableOpacity style={s.row} onPress={()=>findPhone(item.number)}><Text style={s.person}>{item.name}</Text><Text style={s.sub}>{item.number}</Text></TouchableOpacity>} />
    </>}
    {mode==='chat' && <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}>
      <Text style={s.hint}>{t('chatExpiry')}</Text>
      <FlatList inverted data={messages} keyExtractor={m=>m.id} contentContainerStyle={[s.messages,{justifyContent:'flex-start'}]} keyboardShouldPersistTaps="handled"
        ListFooterComponent={messages.length>=50?<TouchableOpacity onPress={older} disabled={loadingOlder}><Text style={s.hint}>{t('olderMessages')}</Text></TouchableOpacity>:null}
        renderItem={({item})=><TouchableOpacity disabled={!item.media_path || busy} onPress={()=>viewMedia(item)} style={[s.bubble,item.sender_id===user.id?[s.mine,{backgroundColor:color}]:s.theirs]}>
          <Text style={s.message}>{item.decryptError || item.body || `🔒 ${kindLabel(item.media_kind)}`}</Text>
          {item.legacy && <Text style={s.time}>{t('legacyMessage')}</Text>}
          {!!item.expires_at && <Text style={s.time}>{expiryLabel(item)}</Text>}
          <Text style={s.time}>{new Date(item.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</Text>
        </TouchableOpacity>} />
      {recording?<View style={s.inputRow}><Text style={[s.message,{flex:1}]}>● {seconds}s</Text><TouchableOpacity onPress={abortRecording}><Text style={s.link}>{t('discard')}</Text></TouchableOpacity><TouchableOpacity onPress={stopVoice}><Text style={s.link}>{t('stopRecording')}</Text></TouchableOpacity></View>
      :voice?<View><Text style={s.hint}>{t('voiceReady')}</Text><View style={s.inputRow}>
        <TouchableOpacity disabled={busy} onPress={()=>play(voice.uri).catch(e=>setError(e.message))}><Text style={s.link}>▶ {t('listen')}</Text></TouchableOpacity>
        <TouchableOpacity disabled={busy} onPress={discardVoice}><Text style={s.link}>{t('discard')}</Text></TouchableOpacity>
        <TouchableOpacity disabled={busy} style={s.send} onPress={sendVoice}><Text style={s.sendText}>{t('send')}</Text></TouchableOpacity>
      </View></View>:<View style={s.inputRow}>
        <TouchableOpacity style={s.attach} onPress={attachments} disabled={busy}><Text style={s.sendText}>＋</Text></TouchableOpacity>
        <TextInput multiline style={[s.input,{maxHeight:100}]} placeholder={t('writeMessage')} placeholderTextColor="#888" value={input} onChangeText={setInput} maxLength={4000} />
        {input.trim()?<TouchableOpacity style={s.send} onPress={submitText} disabled={busy}><Text style={s.sendText}>➤</Text></TouchableOpacity>
        :<TouchableOpacity style={s.send} onPress={startVoice} disabled={busy} accessibilityLabel={t('recordVoice')}><Text style={s.sendText}>🎙</Text></TouchableOpacity>}
      </View>}
    </KeyboardAvoidingView>}
    <SecureOverlay visible={!!preview} onRequestClose={closePreview} animationType="fade"><View style={s.viewer}>
      <TouchableOpacity style={s.close} onPress={closePreview}><Text style={s.link}>✕ {t('close')}</Text></TouchableOpacity>
      {preview?.message.media_kind==='audio'?<TouchableOpacity style={s.action} onPress={()=>play(preview.uri).catch(e=>setError(e.message))}><Text style={s.actionText}>▶ {t('listen')}</Text></TouchableOpacity>
      :preview?.message.media_kind==='video'?<PrivateVideo uri={preview.uri} />
      :preview && <Image source={{uri:preview.uri}} style={s.media} resizeMode="contain" />}
      <Text style={s.hint}>{t('chatExpiry')}</Text>
    </View></SecureOverlay>
  </View>;
}
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A1A' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#25253B' },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' }, link: { color: '#FF7777', fontSize: 14 },
  hint: { color: '#9999AA', fontSize: 11, margin: 14, lineHeight: 16 }, error: { color: '#FF7777', margin: 14 },
  action: { margin: 16, padding: 14, borderRadius: 10, backgroundColor: '#22223B' }, actionText: { color: '#fff' },
  row: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#25253B' }, person: { color: '#fff', fontSize: 16 },
  sub: { color: '#9999AA', fontSize: 12, marginTop: 5 }, empty: { color: '#888', textAlign: 'center', margin: 30 },
  search: { color: '#fff', backgroundColor: '#16162B', marginHorizontal: 14, padding: 12, borderRadius: 10 },
  messages: { padding: 16, gap: 8, flexGrow: 1, justifyContent: 'flex-end' },
  bubble: { maxWidth: '80%', padding: 12, borderRadius: 14 }, mine: { alignSelf: 'flex-end', backgroundColor: '#1565C0' },
  theirs: { alignSelf: 'flex-start', backgroundColor: '#22223B' }, message: { color: '#fff', fontSize: 15 },
  time: { color: '#BAC5D9', fontSize: 10, marginTop: 5, textAlign: 'right' },
  inputRow: { flexDirection: 'row', padding: 12, alignItems: 'center', gap: 8 },
  input: { flex: 1, color: '#fff', backgroundColor: '#22223B', borderRadius: 20, padding: 12 },
  send: { padding: 12, borderRadius: 24, backgroundColor: '#D32F2F' },
  attach: { padding: 12, borderRadius: 24, backgroundColor: '#22223B' }, sendText: { color: '#fff', fontSize: 17 },
  viewer: { flex: 1, backgroundColor: '#050510', justifyContent: 'center' },
  close: { position: 'absolute', right: 20, top: 40, zIndex: 2, padding: 14 }, media: { width: '100%', height: '80%' },
});
