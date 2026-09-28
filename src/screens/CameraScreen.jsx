// ============================================================
// src/screens/CameraScreen.jsx
// ============================================================
import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useStore } from '../store/useStore';
import { encryptData } from '../services/encryption';

export function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState('back');
  const [capturing, setCapturing] = useState(false);
  const cameraRef = useRef(null);
  const addFile = useStore(s => s.addFile);

  if (!permission) return <View style={cs.container}><Text style={cs.msg}>Chajman...</Text></View>;
  if (!permission.granted) {
    return (
      <SafeAreaView style={cs.container}>
        <Text style={cs.msg}>📷 Nou bezwen aksè kamera ou</Text>
        <TouchableOpacity style={cs.permBtn} onPress={requestPermission}>
          <Text style={cs.permBtnText}>Otorize Kamera</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const takePicture = async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8, base64: false });
      const { encrypted, iv } = await encryptData(photo.uri);
      addFile({
        id: Date.now().toString(),
        name: `photo_${Date.now()}.jpg`,
        type: 'image',
        size: '~2 MB',
        encryptedUri: encrypted,
        iv,
        createdAt: new Date().toISOString(),
      });
      Alert.alert('✓ Foto Sekirize', 'Foto ou chifre epi sove nan Vault la. Li pa nan galri telefòn ou.');
    } catch (e) {
      Alert.alert('Erè', 'Foto pa ka pran');
    }
    setCapturing(false);
  };

  return (
    <View style={cs.container}>
      <CameraView style={cs.camera} facing={facing} ref={cameraRef}>
        <View style={cs.overlay}>
          <View style={cs.badge}><Text style={cs.badgeText}>🔒 Kamera Sekirize · Pa galri · Pa cloud</Text></View>
          <View style={cs.controls}>
            <TouchableOpacity style={cs.flipBtn} onPress={() => setFacing(f => f === 'back' ? 'front' : 'back')}>
              <Text style={{ fontSize: 24 }}>🔄</Text>
            </TouchableOpacity>
            <TouchableOpacity style={cs.captureBtn} onPress={takePicture} disabled={capturing}>
              <View style={cs.captureInner} />
            </TouchableOpacity>
            <View style={{ width: 50 }} />
          </View>
        </View>
      </CameraView>
    </View>
  );
}

const cs = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A1A', alignItems: 'center', justifyContent: 'center' },
  camera: { flex: 1, width: '100%' },
  overlay: { flex: 1, justifyContent: 'space-between', padding: 20 },
  badge: { alignSelf: 'center', marginTop: 50, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  badgeText: { color: '#4CAF50', fontSize: 11 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingBottom: 30 },
  flipBtn: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  captureBtn: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#D32F2F' },
  captureInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#D32F2F' },
  msg: { color: '#fff', fontSize: 16, textAlign: 'center', padding: 24 },
  permBtn: { backgroundColor: '#D32F2F', borderRadius: 12, padding: 14, marginTop: 16 },
  permBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});

export default CameraScreen;
