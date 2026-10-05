import React,{useEffect,useRef,useState} from 'react';
import {ActivityIndicator,AppState,ScrollView,StyleSheet,Text,TextInput,TouchableOpacity,View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {SecureOverlay} from './SecureOverlay';
import {requestEmailCode,verifyEmailCode} from '../services/auth';
import {restartIdentity} from '../services/identity';
import {useStore} from '../store/useStore';
import {Alert} from './AppDialog';

export default function IdentityRestart(){
 const {t}=useTranslation(),user=useStore(s=>s.user);
 const [open,setOpen]=useState(false),[code,setCode]=useState(''),[busy,setBusy]=useState(false),[sent,setSent]=useState(false),[error,setError]=useState('');
 const epoch=useRef(0),alive=useRef(true),working=useRef(false);
 useEffect(()=>{alive.current=true;const sub=AppState.addEventListener('change',state=>{if(state!=='active')setCode('');});return()=>{alive.current=false;epoch.current++;sub.remove();};},[]);
 const close=()=>{epoch.current++;setOpen(false);setCode('');setError('');};
 const send=async()=>{
  if(working.current)return;working.current=true;setBusy(true);setError('');const token=epoch.current;
  try{await requestEmailCode(user.email);if(alive.current&&token===epoch.current)setSent(true);}
  catch(e){if(alive.current&&token===epoch.current)setError(e.message);}
  finally{working.current=false;if(alive.current)setBusy(false);}
 };
 const confirm=async()=>{
  if(working.current || !/^\d{6,10}$/.test(code))return;working.current=true;setBusy(true);setError('');const token=epoch.current;
  try{
   const verified=await verifyEmailCode(user.email,code);setCode('');
   if(verified.id!==user.id)throw new Error(t('restartWrongAccount'));
   if(!alive.current || token!==epoch.current)return;
   await restartIdentity(user.id);
   if(useStore.getState().user?.id===user.id){useStore.getState().identityChanged();useStore.getState().setSyncIssue('identity',null);useStore.getState().profileChanged();}
   if(alive.current && token===epoch.current){close();Alert.alert(t('restartIdentity'),t('restartDone'));}
  }catch(e){if(alive.current&&token===epoch.current)setError(e.message);}
  finally{working.current=false;if(alive.current)setBusy(false);}
 };
 return <>
  <TouchableOpacity style={s.entry} onPress={()=>{setSent(false);setError('');setCode('');setOpen(true);}}><Text style={s.link}>{t('restartIdentity')}</Text></TouchableOpacity>
  <SecureOverlay visible={open} onRequestClose={()=>{if(!busy)close();}}>
   <View style={s.shade}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.panel} style={{flexGrow:0}}>
    <Text style={s.title}>{t('restartIdentity')}</Text>
    <Text style={s.warning}>{t('restartWarning')}</Text>
    <Text style={s.hint}>{user?.email}</Text>
    <TouchableOpacity disabled={busy} onPress={send} style={s.button}><Text style={s.link}>{t('sendCode')}</Text></TouchableOpacity>
    <Text style={s.hint}>{t(sent?'restartCodeSent':'restartCodeHint')}</Text>
    <TextInput value={code} onChangeText={v=>setCode(v.replace(/\D/g,''))} maxLength={10} keyboardType="number-pad" secureTextEntry autoComplete="one-time-code" style={s.input} accessibilityLabel={t('restartEmailCode')} placeholder={t('restartEmailCode')} placeholderTextColor="#9CAFC5" editable={!busy} />
    {!!error&&<Text accessibilityLiveRegion="polite" style={s.warning}>{error}</Text>}
    {busy&&<ActivityIndicator color="#9CCBFF" />}
    <TouchableOpacity disabled={busy || !/^\d{6,10}$/.test(code)} onPress={confirm} style={[s.button,{opacity:busy||!/^\d{6,10}$/.test(code)?0.4:1}]}><Text style={s.link}>{t('restartConfirm')}</Text></TouchableOpacity>
    <TouchableOpacity disabled={busy} onPress={close} style={s.button}><Text style={s.hint}>{t('cancel')}</Text></TouchableOpacity>
   </ScrollView></View>
  </SecureOverlay>
 </>;
}
const s=StyleSheet.create({entry:{padding:14,borderTopWidth:0.5,borderTopColor:'#25324A'},link:{color:'#9CCBFF',fontSize:15},shade:{flex:1,backgroundColor:'rgba(0,0,0,0.9)',justifyContent:'center',padding:22},panel:{backgroundColor:'#142238',borderRadius:20,padding:22},title:{color:'#fff',fontSize:20,fontWeight:'700'},warning:{color:'#FFD0BB',fontSize:14,lineHeight:21,marginVertical:12},hint:{color:'#BECDE0',fontSize:13,lineHeight:20,marginVertical:8},input:{backgroundColor:'#25364B',borderRadius:12,padding:14,color:'#fff',fontSize:20},button:{paddingVertical:12}});
