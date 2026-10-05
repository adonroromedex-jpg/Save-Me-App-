import { useFocusEffect } from '@react-navigation/native';
import { SecureOverlay } from './SecureOverlay';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState,  View, Text, TextInput, TouchableOpacity, StyleSheet, Switch, ScrollView } from 'react-native';
import * as Crypto from 'expo-crypto';
import { useTranslation } from 'react-i18next';

export function useCodePrompt() {
  const { t } = useTranslation();
  const [prompt, setPrompt] = useState(null);
  const [pin, setPin] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [share, setShare] = useState(false);
  const [submitting,setSubmitting]=useState(false),[error,setError]=useState('');
  const resolver = useRef(null),task=useRef(null);
  const finish = value => { const resolve = resolver.current; resolver.current = null; setPrompt(null); setPin(''); setConfirmation(''); setShare(false); if(task.current){task.current.then(()=>resolve?.(null),()=>resolve?.(null));}else resolve?.(value); };
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => { if (state !== 'active') finish(null); });
    return () => { sub.remove(); finish(null); };
  }, []);
  useFocusEffect(useCallback(() => () => finish(null), []));
  const askCode = options => new Promise(resolve => {
    resolver.current?.(null); resolver.current = resolve;
    setPin(''); setConfirmation(''); setShare(false); setError(''); setSubmitting(false); setPrompt(options);
  });
  const submit = async () => {
    if(task.current || submitting || !valid)return;
    const current=resolver.current;
    const value={pin,share};setSubmitting(true);setError('');
    try {
      if(prompt.onSubmit){
        const running=Promise.resolve().then(()=>prompt.onSubmit(value));task.current=running;
        try{await running;}finally{if(task.current===running)task.current=null;}
      }
      if(resolver.current===current)finish(value);
    } catch(e) { if(resolver.current===current)setError(e.message || String(e)); }
    finally { if(resolver.current===current)setSubmitting(false); }
  };
  const generate = async () => {
    // Rejection sampling avoids modulo bias; code is not the encryption key.
    const bytes = await Crypto.getRandomBytesAsync(32);
    const value = Array.from(bytes).filter(n => n < 250).slice(0,6).map(n => n % 10).join('');
    if (value.length === 6) { setPin(value); setConfirmation(value); }
  };
  const valid = /^\d{6}$/.test(pin) && (!prompt?.create || pin === confirmation);
  const codeModal = <SecureOverlay visible={!!prompt} transparent animationType="fade" onRequestClose={() => finish(null)}>
    <View style={s.shade}><ScrollView keyboardShouldPersistTaps="handled" style={{flexGrow:0,flexShrink:1}} contentContainerStyle={s.panel}>
      <Text style={s.title}>{prompt?.title || t('mediaCode')}</Text>
      <Text style={s.hint}>{prompt?.hint || t('codeHint')}</Text>
      <TextInput autoFocus style={s.input} value={pin} onChangeText={v => setPin(v.replace(/\D/g,''))} maxLength={6}
        keyboardType="number-pad" secureTextEntry={!prompt?.shareOption} placeholder="••••••" placeholderTextColor="#999" accessibilityLabel={prompt?.title || t('mediaCode')} />
      {prompt?.create && <TextInput style={s.input} value={confirmation} onChangeText={v => setConfirmation(v.replace(/\D/g,''))} maxLength={6}
        keyboardType="number-pad" secureTextEntry={!prompt?.shareOption} placeholder={t('confirmCode')} placeholderTextColor="#999" />}
      {prompt?.shareOption && <>
        <TouchableOpacity onPress={generate}><Text style={s.link}>{t('generateCode')}</Text></TouchableOpacity>
        <View style={s.row}><Text style={[s.hint,{flex:1}]}>{t('shareCode')}</Text><Switch value={share} onValueChange={setShare} /></View>
        <Text style={s.hint}>{t('shareCodeWarning')}</Text>
      </>}
      {submitting && <ActivityIndicator color="#82B9FF" />}
      {!!error && <Text accessibilityLiveRegion="polite" style={{color:'#FFB4B4',marginVertical:8}}>{error}</Text>}
      <View style={s.row}><TouchableOpacity disabled={submitting} style={s.button} onPress={() => finish(null)}><Text style={s.link}>{t('cancel')}</Text></TouchableOpacity>
        <TouchableOpacity style={[s.button,{opacity:valid?1:0.35}]} disabled={!valid || submitting} onPress={submit}><Text style={s.link}>{t('continue')}</Text></TouchableOpacity></View>
    </ScrollView></View>
  </SecureOverlay>;
  return { askCode, codeModal };
}
const s = StyleSheet.create({ shade:{flex:1,backgroundColor:'rgba(0,0,0,0.85)',justifyContent:'center',padding:24},panel:{backgroundColor:'#18182D',borderRadius:20,padding:22},title:{color:'#fff',fontSize:20,fontWeight:'700'},hint:{color:'#B9B9CB',fontSize:13,lineHeight:19,marginVertical:10},input:{backgroundColor:'#28283E',color:'#fff',padding:15,borderRadius:12,marginVertical:8,fontSize:22,letterSpacing:5},row:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},button:{paddingVertical:14},link:{color:'#82B9FF',fontSize:14} });
