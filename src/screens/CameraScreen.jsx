import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, AppState, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { useIsFocused, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useStore } from '../store/useStore';
import { importVaultFile, removePickerCopy } from '../services/vault';
import { hasVaultCode } from '../services/vaultCode';
import { sendMedia, sendText } from '../services/messages';
import { useCodePrompt } from '../components/CodePrompt';
import { MAX_VIDEO_SECONDS } from '../services/mediaLimits';

export function CameraScreen({ route, navigation }) {
  const {t}=useTranslation();const {askCode,codeModal}=useCodePrompt();
  const [permission,requestPermission]=useCameraPermissions(),[microphone,requestMicrophone]=useMicrophonePermissions();
  const [facing,setFacing]=useState('back'),[mode,setMode]=useState('picture'),[busy,setBusy]=useState(false),[recording,setRecording]=useState(false);
  const [seconds,setSeconds]=useState(0),[progress,setProgress]=useState(null),[active,setActive]=useState(AppState.currentState==='active');
  const camera=useRef(null),valid=useRef(0),working=useRef(false);
  const focused=useIsFocused();const userId=useStore(s=>s.user?.id),setFiles=useStore(s=>s.setFiles);
  const peer=route.params?.chatPeer;
  useFocusEffect(useCallback(()=>()=>{valid.current++;camera.current?.stopRecording();},[]));
  useEffect(()=>{const sub=AppState.addEventListener('change',state=>{setActive(state==='active');if(state!=='active'){valid.current++;camera.current?.stopRecording();}});return()=>{valid.current++;sub.remove();};},[]);
  useEffect(()=>{if(!recording)return;const timer=setInterval(()=>setSeconds(n=>n+1),1000);return()=>clearInterval(timer);},[recording]);
  const save=async(asset,token)=>{
    try{
      if(token!==valid.current || AppState.currentState!=='active' || useStore.getState().isLocked)return;
      if(peer){
        const code=await askCode({create:true,shareOption:true});if(!code)return;
        await sendMedia(userId,peer.id,asset,code.pin,setProgress);
        if(code.share)try{await sendText(userId,peer.id,t('sentCode',{code:code.pin}));}catch{Alert.alert(t('messages'),t('sendFailedCode'));}
        navigation.setParams({chatPeer:null});navigation.navigate('Messages');
      }else{
        const exists=await hasVaultCode(userId);
        const code=await askCode({title:t(exists?'vaultCode':'vaultCodeSetup'),hint:t('vaultCodeHint'),create:!exists});if(!code)return;
        setFiles(await importVaultFile(userId,asset,code.pin));Alert.alert(t('camera'),t('captureSaved'));
      }
    }finally{await removePickerCopy(asset).catch(()=>{});}
  };
  const capture=async()=>{
    if(recording){camera.current?.stopRecording();return;}
    if(!camera.current || working.current)return;
    working.current=true;let token=valid.current;setBusy(true);
    try{
      if(mode==='video'){
        const allowed=microphone?.granted || (await requestMicrophone()).granted;
        if(!allowed)throw new Error(t('microphonePermission'));
        token=valid.current;
        setSeconds(0);setRecording(true);
        const video=await camera.current.recordAsync({maxDuration:MAX_VIDEO_SECONDS});setRecording(false);
        if(video?.uri)await save({...video,type:'video',mimeType:'video/mp4'},token);
      }else{
        const photo=await camera.current.takePictureAsync({quality:0.85,base64:false});
        await save({...photo,type:'image',mimeType:'image/jpeg'},token);
      }
    }catch(e){Alert.alert(t('camera'),e.message);}finally{working.current=false;setRecording(false);setBusy(false);setProgress(null);}
  };
  if(!permission)return <View style={s.container}><ActivityIndicator /></View>;
  if(!permission.granted)return <View style={s.container}><Text style={s.hint}>{t('cameraPermission')}</Text><TouchableOpacity style={s.button} onPress={requestPermission}><Text style={s.text}>{t('allowCamera')}</Text></TouchableOpacity></View>;
  return <View style={s.container}>{codeModal}
    <View style={s.header}><Text style={s.text}>{peer?t('chatTarget',{name:`${peer.first_name||''} ${peer.last_name||''}`}):t('vaultTarget')}</Text>
      {!!peer && <TouchableOpacity disabled={busy} onPress={()=>navigation.setParams({chatPeer:null})}><Text style={s.link}>{t('vault')}</Text></TouchableOpacity>}
    </View>
    {focused && active && <CameraView style={{flex:1,width:'100%'}} ref={camera} facing={facing} mode={mode} videoQuality="480p" mute={false} />}
    <View style={s.controls}>
      <Text style={s.hint}>{recording?t('cameraRecording',{seconds}):t('videoLimit')}</Text>
      {busy && !recording && <ActivityIndicator color="#82B9FF" />}{progress!==null && <Text style={s.text}>{progress}%</Text>}
      <View style={s.row}>
        <TouchableOpacity disabled={busy} onPress={()=>setFacing(f=>f==='back'?'front':'back')} style={s.button}><Text style={s.text}>↺</Text></TouchableOpacity>
        <TouchableOpacity disabled={busy && !recording} onPress={capture} style={[s.shutter,recording&&{backgroundColor:'#D32F2F'}]} accessibilityLabel={recording?t('stopRecording'):t('camera')}><Text style={{fontSize:26}}>{recording?'■':'●'}</Text></TouchableOpacity>
        <TouchableOpacity disabled={busy} onPress={()=>setMode(m=>m==='picture'?'video':'picture')} style={s.button}><Text style={s.text}>{mode==='picture'?t('video'):t('photo')}</Text></TouchableOpacity>
      </View>
    </View>
  </View>;
}
const s=StyleSheet.create({container:{flex:1,backgroundColor:'#0A0A1A',alignItems:'center',justifyContent:'center'},header:{width:'100%',padding:14,flexDirection:'row',justifyContent:'space-between'},text:{color:'#fff',fontSize:14},link:{color:'#82B9FF'},hint:{color:'#AAB',fontSize:13,textAlign:'center',margin:12},controls:{width:'100%',paddingBottom:20},row:{flexDirection:'row',alignItems:'center',justifyContent:'space-around'},button:{padding:14,borderRadius:16,backgroundColor:'#25253B'},shutter:{width:72,height:72,borderRadius:36,backgroundColor:'#fff',alignItems:'center',justifyContent:'center',borderWidth:4,borderColor:'#E25566'}});
export default CameraScreen;
