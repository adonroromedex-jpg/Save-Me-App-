// ============================================================
// src/screens/CameraScreen.jsx
// ============================================================
import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useTranslation } from 'react-i18next';
import { useStore } from '../store/useStore';
import { importVaultFile, removePickerCopy } from '../services/vault';

export function CameraScreen() {
  const { t } = useTranslation();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState('back');
  const [mode, setMode] = useState('picture');
  const [capturing, setCapturing] = useState(false);
  const [recording, setRecording] = useState(false);
  const cameraRef = useRef(null);
  const userId = useStore(s => s.user?.id);
  const setFiles = useStore(s => s.setFiles);

  if (!permission) return <View style={cs.container}><Text style={cs.msg}>{t('sending')}</Text></View>;
  if (!permission.granted) {
    return (
      <SafeAreaView style={cs.container}>
        <Text style={cs.msg}>📷 {t('cameraPermission')}</Text>
        <TouchableOpacity style={cs.permBtn} onPress={requestPermission}>
          <Text style={cs.permBtnText}>{t('allowCamera')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const takePicture = async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8, base64: false });
      try {
        const next = await importVaultFile(userId, { ...photo, type: 'image', mimeType: 'image/jpeg' });
        setFiles(next);
        Alert.alert(t('camera'), t('savedToVault'));
      } finally { await removePickerCopy(photo).catch(() => {}); }
    } catch (e) {
      Alert.alert(t('camera'), e.message);
    }
    setCapturing(false);
  };

  const toggleRecording = async () => {
    if (recording) { cameraRef.current?.stopRecording(); return; }
    if (!cameraRef.current || capturing) return;
    setRecording(true);
    try {
      const video = await cameraRef.current.recordAsync({ maxDuration: 30 });
      if (video?.uri) {
        try {
          setFiles(await importVaultFile(userId, { ...video, type: 'video', mimeType: 'video/mp4' }));
          Alert.alert(t('camera'), t('savedToVault'));
        } finally { await removePickerCopy(video).catch(() => {}); }
      }
    } catch (e) { Alert.alert(t('camera'), e.message); }
    finally { setRecording(false); }
  };

  return (
    <View style={cs.container}>
      <CameraView style={cs.camera} facing={facing} mode={mode} mute ref={cameraRef}>
        <View style={cs.overlay}>
          <View style={cs.badge}><Text style={cs.badgeText}>🔒 {t('cameraPrivate')}</Text></View>
          <View style={cs.controls}>
            <TouchableOpacity style={cs.flipBtn} disabled={recording} onPress={() => setFacing(f => f === 'back' ? 'front' : 'back')}>
              <Text style={{ fontSize: 24 }}>🔄</Text>
            </TouchableOpacity>
            <TouchableOpacity style={cs.captureBtn} onPress={mode === 'video' ? toggleRecording : takePicture} disabled={capturing}>
              <View style={cs.captureInner} />
            </TouchableOpacity>
            <TouchableOpacity disabled={recording || capturing} onPress={() => setMode(current => current === 'picture' ? 'video' : 'picture')}>
              <Text style={cs.badgeText}>{mode === 'picture' ? t('video') : t('photo')}{recording ? ' ●' : ''}</Text>
            </TouchableOpacity>
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
