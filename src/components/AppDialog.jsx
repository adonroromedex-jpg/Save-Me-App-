import React, { useEffect, useState } from 'react';
import { AppState, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SecureOverlay } from './SecureOverlay';
import { useStore } from '../store/useStore';

let queue = [], notify = () => {};
export const Alert = {
  alert(title, message = '', buttons = [{ text: 'OK' }]) {
    if (AppState.currentState !== 'active') return;
    queue.push({ title, message, buttons: buttons.length ? buttons : [{ text: 'OK' }] });
    notify([...queue]);
  },
};
export function AppDialogHost() {
  const [items, setItems] = useState(queue);
  useEffect(() => {
    notify = setItems;
    const clear = () => { queue = []; setItems([]); };
    const subscription = AppState.addEventListener('change', state => { if (state !== 'active') clear(); });
    const unsubscribe = useStore.subscribe((state, previous) => {
      if ((state.isLocked && !previous.isLocked) || (previous.user?.id && state.user?.id !== previous.user.id)) clear();
    });
    return () => { notify = () => {}; subscription.remove(); unsubscribe(); };
  }, []);
  const item = items[0];
  const choose = button => {
    if (!item || queue[0] !== item) return;
    queue.shift(); setItems([...queue]);
    Promise.resolve().then(() => button?.onPress?.()).catch(error => Alert.alert('Save Me', error.message));
  };
  const cancel = () => {
    const button = item?.buttons.find(b => b.style === 'cancel');
    if (button || item?.buttons.length === 1) choose(button);
  };
  const destructive = item?.buttons.some(b => b.style === 'destructive');
  return <SecureOverlay visible={!!item} onRequestClose={cancel}>
    <View style={s.backdrop} accessibilityViewIsModal>
      <View style={s.card}>
        <View style={[s.icon, destructive && s.dangerIcon]}><Ionicons name={destructive ? 'alert-circle-outline' : 'chatbubble-ellipses-outline'} size={30} color={destructive ? '#FFADAD' : '#93C5FD'} /></View>
        <Text accessibilityRole="header" style={s.title}>{item?.title}</Text>
        {!!item?.message && <ScrollView style={s.body}><Text selectable style={s.message}>{item.message}</Text></ScrollView>}
        <View style={s.buttons}>{item?.buttons.map((button,index) => <TouchableOpacity key={index} accessibilityRole="button"
          onPress={() => choose(button)} style={[s.button, button.style === 'cancel' ? s.secondary : button.style === 'destructive' ? s.danger : s.primary]}>
          <Text style={s.buttonText}>{button.text}</Text>
        </TouchableOpacity>)}</View>
      </View>
    </View>
  </SecureOverlay>;
}
const s = StyleSheet.create({
  backdrop: {flex:1,backgroundColor:'rgba(3,10,24,0.78)',justifyContent:'center',alignItems:'center',padding:24},
  card: {width:'100%',maxWidth:420,maxHeight:'85%',backgroundColor:'#111E34',borderRadius:24,padding:24,borderWidth:1,borderColor:'#2A3D59',elevation:20},
  icon: {width:56,height:56,borderRadius:18,backgroundColor:'#193B61',alignItems:'center',justifyContent:'center',marginBottom:18},
  dangerIcon: {backgroundColor:'#502635'},title:{color:'#F4F8FF',fontSize:21,fontWeight:'700',marginBottom:12},
  body:{flexGrow:0,marginBottom:20},message:{color:'#BECCE0',fontSize:15,lineHeight:23},
  buttons:{gap:10,marginTop:6},button:{padding:15,borderRadius:14,alignItems:'center'},
  primary:{backgroundColor:'#2267BA'},secondary:{backgroundColor:'#23334B'},danger:{backgroundColor:'#AC3545'},buttonText:{color:'#fff',fontSize:15,fontWeight:'700'},
});
