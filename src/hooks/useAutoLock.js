// src/hooks/useAutoLock.js
import { useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import { useStore } from '../store/useStore';

const AUTO_LOCK_MINUTES = 10; // 10 minit
const AUTO_LOCK_MS = AUTO_LOCK_MINUTES * 60 * 1000;

export default function useAutoLock() {
  const { isAuthenticated, lockApp } = useStore();
  const timerRef = useRef(null);
  const lastActiveRef = useRef(Date.now());
  const appStateRef = useRef(AppState.currentState);

  const resetTimer = useCallback(() => {
    lastActiveRef.current = Date.now();
    if (timerRef.current) clearTimeout(timerRef.current);
    if (isAuthenticated) {
      timerRef.current = setTimeout(() => {
        lockApp();
      }, AUTO_LOCK_MS);
    }
  }, [isAuthenticated, lockApp]);

  useEffect(() => {
    if (!isAuthenticated) return;

    // Kòmanse timer la
    resetTimer();

    // Detekte lè app la al background
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (appStateRef.current === 'active' && nextState.match(/inactive|background/)) {
        // App la al background — tcheke si 10 minit pase
        lastActiveRef.current = Date.now();
      }

      if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        // App la tounen — tcheke si 10 minit pase
        const elapsed = Date.now() - lastActiveRef.current;
        if (elapsed >= AUTO_LOCK_MS) {
          lockApp();
        } else {
          resetTimer();
        }
      }

      appStateRef.current = nextState;
    });

    return () => {
      subscription.remove();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isAuthenticated, resetTimer, lockApp]);

  return { resetTimer };
}
