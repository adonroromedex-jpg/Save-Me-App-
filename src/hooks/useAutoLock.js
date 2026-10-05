import { useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import { useStore } from '../store/useStore';
const ACTIVE_IDLE_MS = 10 * 60 * 1000;
export default function useAutoLock() {
  const authenticated=useStore(s=>s.isAuthenticated);
  const timer=useRef(null);
  const resetTimer=useCallback(()=>{
    clearTimeout(timer.current);
    if(authenticated)timer.current=setTimeout(()=>useStore.getState().lockApp(),ACTIVE_IDLE_MS);
  },[authenticated]);
  useEffect(()=>{
    if(!authenticated)return;
    const protect=state=>{
      const current=useStore.getState();
      if(state==='background'){
        clearTimeout(timer.current);
        if(current.isAuthenticated && !current.isLocked)current.lockApp();
      }else if(state==='active')resetTimer();
    };
    protect(AppState.currentState);
    const subscription=AppState.addEventListener('change',protect);
    return()=>{subscription.remove();clearTimeout(timer.current);};
  },[authenticated,resetTimer]);
  return {resetTimer};
}
