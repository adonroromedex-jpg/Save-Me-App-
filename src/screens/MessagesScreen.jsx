import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, FlatList, Image, KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as Contacts from 'expo-contacts';
import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode } from 'expo-av';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useStore } from '../store/useStore';
import { listConversations, listMessages, lookupContact, mediaUrl, normalizePhone, sendMedia, sendText } from '../services/messages';
import { removePickerCopy } from '../services/vault';

const label = person => `${person?.first_name || ''} ${person?.last_name || ''}`.trim() || 'Save Me';

export default function MessagesScreen() {
  const { t } = useTranslation();
  const user = useStore(s => s.user);
  const [peer, setPeer] = useState(null);
  const [mode, setMode] = useState('list');
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [filter, setFilter] = useState('');
  const [phone, setPhone] = useState('');
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const peerRef = useRef(null);

  const refresh = useCallback(async () => {
    if (!user?.id) return;
    try {
      if (peerRef.current) setMessages(await listMessages(user.id, peerRef.current.id));
      else setConversations(await listConversations(user.id));
      setError('');
    } catch (e) { setError(e.message); }
  }, [user?.id]);

  useFocusEffect(useCallback(() => {
    refresh();
    const timer = setInterval(refresh, 8000);
    return () => clearInterval(timer);
  }, [refresh]));

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => { if (state !== 'active') setPreview(null); });
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (!preview) return undefined;
    const remaining = new Date(preview.message.expires_at).getTime() - Date.now();
    if (remaining <= 0) { setPreview(null); refresh(); return undefined; }
    const timer = setTimeout(() => { setPreview(null); refresh(); }, remaining);
    return () => clearTimeout(timer);
  }, [preview, refresh]);

  const openChat = person => {
    peerRef.current = person;
    setPeer(person); setMode('chat'); setMessages([]);
    listMessages(user.id, person.id).then(setMessages).catch(e => setError(e.message));
  };
  const back = () => {
    setPreview(null);
    if (mode === 'chat') { peerRef.current = null; setPeer(null); setMode('list'); refresh(); }
    else setMode('list');
  };

  const browseContacts = async () => {
    const permission = await Contacts.requestPermissionsAsync();
    if (!permission.granted) { Alert.alert(t('messages'), t('contactsPermission')); return; }
    setBusy(true);
    try {
      const all = [];
      let offset = 0;
      let more = true;
      while (more && offset < 10000) {
        const page = await Contacts.getContactsAsync({ fields: [Contacts.Fields.PhoneNumbers], pageSize: 500, pageOffset: offset });
        all.push(...page.data.filter(c => c.phoneNumbers?.length));
        more = page.hasNextPage && page.data.length > 0;
        offset += page.data.length;
      }
      setContacts(all); setMode('contacts');
    } catch (e) { Alert.alert(t('messages'), e.message); }
    finally { setBusy(false); }
  };

  const findPhone = async number => {
    setBusy(true);
    try {
      const found = await lookupContact(number);
      if (!found) Alert.alert(t('messages'), t('contactNotFound'));
      else openChat(found);
    } catch (e) { Alert.alert(t('messages'), e.message); }
    finally { setBusy(false); }
  };

  const submitText = async () => {
    if (!input.trim() || busy || !peer) return;
    setBusy(true);
    try { await sendText(user.id, peer.id, input); setInput(''); await refresh(); }
    catch (e) { Alert.alert(t('messages'), e.message); }
    finally { setBusy(false); }
  };

  const pickMedia = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { Alert.alert(t('messages'), t('galleryPermission')); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.All, quality: 1 });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setBusy(true);
    try {
      if (useStore.getState().isLocked) throw new Error(t('unlockBeforeImport'));
      await sendMedia(user.id, peer.id, asset); await refresh();
    }
    catch (e) { Alert.alert(t('messages'), e.message); }
    finally { await removePickerCopy(asset).catch(() => {}); setBusy(false); }
  };

  const viewMedia = async message => {
    setBusy(true);
    try { setPreview({ message, uri: await mediaUrl(message) }); }
    catch (e) { Alert.alert(t('messages'), e.message); await refresh(); }
    finally { setBusy(false); }
  };

  return <View style={s.container}>
    <View style={s.header}>
      {mode !== 'list' && <TouchableOpacity onPress={back}><Text style={s.link}>{t('back')}</Text></TouchableOpacity>}
      <Text style={s.title}>{mode === 'chat' ? label(peer) : mode === 'contacts' ? t('phoneContacts') : t('messages')}</Text>
      {mode === 'list' && <TouchableOpacity onPress={browseContacts}><Text style={s.link}>+ {t('newChat')}</Text></TouchableOpacity>}
    </View>
    {!!error && <Text style={s.error}>{error}</Text>}
    {busy && <ActivityIndicator color="#D32F2F" />}

    {mode === 'list' && <>
      <TouchableOpacity onPress={() => setMode('contacts')} style={s.action}><Text style={s.actionText}>{t('findByPhone')} →</Text></TouchableOpacity>
      <FlatList data={conversations} keyExtractor={row => row.peer.id}
        ListEmptyComponent={<Text style={s.empty}>{t('noConversations')}</Text>}
        renderItem={({ item }) => <TouchableOpacity style={s.row} onPress={() => openChat(item.peer)}>
          <Text style={s.person}>{label(item.peer)}</Text>
          <Text style={s.sub} numberOfLines={1}>{item.last.body || (item.last.media_kind === 'video' ? t('video') : t('photo'))}</Text>
        </TouchableOpacity>} />
    </>}

    {mode === 'contacts' && <>
      <Text style={s.hint}>{t('contactPrivacy')}</Text>
      <View style={s.inputRow}><TextInput style={s.input} placeholder="+509..." placeholderTextColor="#888" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
        <TouchableOpacity style={s.send} onPress={() => findPhone(phone)} disabled={busy}><Text style={s.sendText}>→</Text></TouchableOpacity></View>
      <TextInput style={s.search} placeholder={t('searchContacts')} placeholderTextColor="#888" value={filter} onChangeText={setFilter} />
      <FlatList data={contacts.filter(c => `${c.name} ${c.phoneNumbers?.map(n => n.number).join(' ')}`.toLowerCase().includes(filter.toLowerCase()))}
        keyExtractor={c => c.id} renderItem={({ item }) => <TouchableOpacity style={s.row}
          onPress={() => {
            const number = item.phoneNumbers?.[0]?.number || '';
            const fallback = user?.countryCode || '';
            const normalized = normalizePhone(number, fallback);
            if (!normalized) Alert.alert(t('messages'), t('countryCodeNeeded'));
            else findPhone(normalized);
          }}><Text style={s.person}>{item.name}</Text><Text style={s.sub}>{item.phoneNumbers?.[0]?.number}</Text></TouchableOpacity>} />
    </>}

    {mode === 'chat' && <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={s.hint}>{t('chatExpiry')}</Text>
      <FlatList data={messages} keyExtractor={m => m.id} contentContainerStyle={s.messages}
        renderItem={({ item }) => <TouchableOpacity disabled={!item.media_path} onPress={() => viewMedia(item)}
          style={[s.bubble, item.sender_id === user.id ? s.mine : s.theirs]}>
          <Text style={s.message}>{item.body || (item.media_kind === 'video' ? `▶ ${t('video')}` : `▣ ${t('photo')}`)}</Text>
          <Text style={s.time}>{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
        </TouchableOpacity>} />
      <View style={s.inputRow}><TouchableOpacity style={s.attach} onPress={pickMedia} disabled={busy}><Text style={s.sendText}>＋</Text></TouchableOpacity>
        <TextInput style={s.input} placeholder={t('writeMessage')} placeholderTextColor="#888" value={input} onChangeText={setInput} maxLength={4000} />
        <TouchableOpacity style={s.send} onPress={submitText} disabled={busy}><Text style={s.sendText}>➤</Text></TouchableOpacity></View>
    </KeyboardAvoidingView>}

    <Modal visible={!!preview} onRequestClose={() => setPreview(null)} animationType="fade">
      <View style={s.viewer}><TouchableOpacity style={s.close} onPress={() => setPreview(null)}><Text style={s.link}>✕ {t('close')}</Text></TouchableOpacity>
        {preview?.message.media_kind === 'video' ? <Video source={{ uri: preview.uri }} style={s.media} useNativeControls resizeMode={ResizeMode.CONTAIN} />
          : preview && <Image source={{ uri: preview.uri }} style={s.media} resizeMode="contain" />}
        <Text style={s.hint}>{t('chatExpiry')}</Text>
      </View>
    </Modal>
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
