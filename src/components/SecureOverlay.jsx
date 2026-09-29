// Keep sensitive overlays in the Activity's FLAG_SECURE window.
// React Native 0.74 Modal uses a separate Dialog window; do not use it for media/PINs.
import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
const OverlayContext=createContext(null);
let nextId=0;
export function SecureOverlayProvider({children}) {
  const [entries,setEntries]=useState({});
  const update=useCallback((id,element)=>setEntries(current=>{
    if(!element && !current[id])return current;
    const next={...current};if(element)next[id]=element;else delete next[id];return next;
  }),[]);
  return <OverlayContext.Provider value={update}><View style={{flex:1}}>{children}
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill,{zIndex:10000,elevation:10000}]}>
      {Object.entries(entries).map(([id,element])=><View key={id} style={StyleSheet.absoluteFill}>{element}</View>)}
    </View>
  </View></OverlayContext.Provider>;
}
export function SecureOverlay({visible,children,onRequestClose}) {
  const update=useContext(OverlayContext);const id=useRef(`overlay-${++nextId}`).current;
  useLayoutEffect(()=>{if(!update)throw new Error('SecureOverlayProvider is required');update(id,visible?children:null);},[update,id,visible,children]);
  useEffect(()=>()=>update?.(id,null),[update,id]);
  useEffect(()=>{if(!visible)return;const sub=BackHandler.addEventListener('hardwareBackPress',()=>{onRequestClose?.();return true;});return()=>sub.remove();},[visible,onRequestClose]);
  return null;
}
