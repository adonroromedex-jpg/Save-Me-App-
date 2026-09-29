import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
// No native fullscreen button: playback must remain in the protected Activity window.
export default function PrivateVideo({uri}) {
  const ref=useRef(null);const [status,setStatus]=useState({});
  const act=async fn=>{try{await fn();}catch{}};
  return <View style={{width:'100%',height:'80%'}}>
    <Video ref={ref} source={{uri}} style={{flex:1}} resizeMode={ResizeMode.CONTAIN} useNativeControls={false} onPlaybackStatusUpdate={setStatus} />
    <View style={s.row}>
      <TouchableOpacity onPress={()=>act(()=>ref.current?.setPositionAsync(Math.max(0,(status.positionMillis||0)-10000)))}><Text style={s.button}>−10s</Text></TouchableOpacity>
      <TouchableOpacity onPress={()=>act(()=>status.isPlaying?ref.current?.pauseAsync():status.didJustFinish?ref.current?.replayAsync():ref.current?.playAsync())}><Text style={s.button}>{status.isPlaying?'Ⅱ':'▶'}</Text></TouchableOpacity>
      <Text style={s.time}>{Math.floor((status.positionMillis||0)/1000)} / {Math.floor((status.durationMillis||0)/1000)}s</Text>
      <TouchableOpacity onPress={()=>act(()=>ref.current?.setPositionAsync(Math.min(status.durationMillis||0,(status.positionMillis||0)+10000)))}><Text style={s.button}>+10s</Text></TouchableOpacity>
    </View>
  </View>;
}
const s=StyleSheet.create({row:{flexDirection:'row',alignItems:'center',justifyContent:'space-around',padding:12},button:{color:'#82B9FF',fontSize:20,padding:10},time:{color:'#fff',fontSize:12}});
