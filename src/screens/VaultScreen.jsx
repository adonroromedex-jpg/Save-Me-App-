// ============================================================
// src/screens/VaultScreen.jsx
// ============================================================
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, FlatList, TextInput, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { useStore } from '../store/useStore';
import { encryptData } from '../services/encryption';

export function VaultScreen() {
  const { t } = useTranslation();
  const { files, addFile, removeFile } = useStore();
  const [search, setSearch] = useState('');

  const filtered = files.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));

  const handleAdd = () => {
    Alert.alert('Ajoute Fichye', 'Chwazi opsyon', [
      { text: '📷 Foto/Videyo', onPress: pickMedia },
      { text: '❌ Anile', style: 'cancel' },
    ]);
  };

  const pickMedia = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Pèmisyon refize'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.All, quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const { encrypted, iv } = await encryptData(asset.uri);
      addFile({
        id: Date.now().toString(),
        name: asset.fileName || `fichye_${Date.now()}.jpg`,
        type: asset.type === 'video' ? 'video' : 'image',
        size: `${((asset.fileSize || 0) / 1024 / 1024).toFixed(1)} MB`,
        encryptedUri: encrypted,
        iv,
        createdAt: new Date().toISOString(),
      });
    }
  };

  const handleDelete = (id, name) => {
    Alert.alert('Efase Fichye', `Efase "${name}"?`, [
      { text: 'Efase', style: 'destructive', onPress: () => removeFile(id) },
      { text: 'Anile', style: 'cancel' },
    ]);
  };

  return (
    <SafeAreaView style={vs.container}>
      <View style={vs.header}>
        <Text style={vs.title}>🔐 {t('vault')}</Text>
        <TouchableOpacity style={vs.addBtn} onPress={handleAdd}>
          <Text style={vs.addText}>+ {t('addFile')}</Text>
        </TouchableOpacity>
      </View>
      <TextInput style={vs.search} placeholder={t('searchFiles')} placeholderTextColor="#555" value={search} onChangeText={setSearch} />
      <FlatList
        data={filtered}
        numColumns={2}
        keyExtractor={i => i.id}
        contentContainerStyle={vs.grid}
        columnWrapperStyle={vs.row}
        ListEmptyComponent={<Text style={vs.empty}>Vault vid. Ajoute premye fichye ou!</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity style={vs.item} onLongPress={() => handleDelete(item.id, item.name)}>
            <Text style={vs.itemIcon}>{item.type === 'image' ? '🖼️' : item.type === 'video' ? '🎥' : item.type === 'audio' ? '🎵' : '📄'}</Text>
            <Text style={vs.itemName} numberOfLines={1}>{item.name}</Text>
            <Text style={vs.itemSize}>{item.size}</Text>
            <View style={vs.itemTag}><Text style={vs.itemTagText}>🔒 {t('encrypted')}</Text></View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const vs = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A1A', padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { color: '#fff', fontSize: 18, fontWeight: '600' },
  addBtn: { backgroundColor: '#D32F2F', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  addText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  search: { backgroundColor: '#12122A', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: 10, color: '#fff', fontSize: 13, marginBottom: 14 },
  grid: { paddingBottom: 20 },
  row: { justifyContent: 'space-between', marginBottom: 10 },
  item: { width: '48%', backgroundColor: '#12122A', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: 12, alignItems: 'center' },
  itemIcon: { fontSize: 30, marginBottom: 6 },
  itemName: { color: '#DDD', fontSize: 11, fontWeight: '500', textAlign: 'center' },
  itemSize: { color: '#555', fontSize: 10, marginTop: 2 },
  itemTag: { backgroundColor: 'rgba(211,47,47,0.15)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, marginTop: 5 },
  itemTagText: { color: '#FF7777', fontSize: 9 },
  empty: { color: '#555', textAlign: 'center', marginTop: 40, fontSize: 13 },
});

export default VaultScreen;
