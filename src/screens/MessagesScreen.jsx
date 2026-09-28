// ============================================================
// src/screens/MessagesScreen.jsx
// ============================================================
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, FlatList, KeyboardAvoidingView, Platform } from 'react-native';

const MOCK_MSGS = [
  { id: '1', text: 'Bonjou! Mesaj sa a chifre E2E 🔒', from: 'them', time: '9:41' },
  { id: '2', text: 'Wi, tout konvèsasyon an sekirize!', from: 'me', time: '9:42' },
  { id: '3', text: 'Mèsi pou Save Me 🔐', from: 'them', time: '9:43' },
];

export function MessagesScreen() {
  const [messages, setMessages] = useState(MOCK_MSGS);
  const [input, setInput] = useState('');

  const send = () => {
    if (!input.trim()) return;
    setMessages(m => [...m, { id: Date.now().toString(), text: input, from: 'me', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    setInput('');
  };

  return (
    <SafeAreaView style={ms.container}>
      <View style={ms.header}><Text style={ms.title}>💬 Mesaj Sekirize</Text><Text style={ms.badge}>🔒 E2E</Text></View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          data={messages}
          keyExtractor={i => i.id}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          renderItem={({ item }) => (
            <View style={[ms.bubble, item.from === 'me' ? ms.bubbleMe : ms.bubbleThem]}>
              <Text style={ms.bubbleText}>{item.text}</Text>
              <Text style={ms.bubbleTime}>{item.time} 🔒</Text>
            </View>
          )}
        />
        <View style={ms.inputRow}>
          <TextInput style={ms.input} placeholder="Ekri mesaj ou..." placeholderTextColor="#555" value={input} onChangeText={setInput} />
          <TouchableOpacity style={ms.sendBtn} onPress={send}><Text style={{ fontSize: 20 }}>➤</Text></TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const ms = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A1A' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.06)' },
  title: { color: '#fff', fontSize: 17, fontWeight: '600' },
  badge: { backgroundColor: 'rgba(76,175,80,0.15)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, color: '#4CAF50', fontSize: 11 },
  bubble: { maxWidth: '78%', borderRadius: 14, padding: 10 },
  bubbleMe: { alignSelf: 'flex-end', backgroundColor: '#1565C0' },
  bubbleThem: { alignSelf: 'flex-start', backgroundColor: '#12122A', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' },
  bubbleText: { color: '#fff', fontSize: 14 },
  bubbleTime: { color: 'rgba(255,255,255,0.5)', fontSize: 9, marginTop: 3, textAlign: 'right' },
  inputRow: { flexDirection: 'row', padding: 12, gap: 8, borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.06)' },
  input: { flex: 1, backgroundColor: '#12122A', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, color: '#fff', fontSize: 14 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#D32F2F', alignItems: 'center', justifyContent: 'center' },
});

export default MessagesScreen;
