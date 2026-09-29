// src/hooks/useAutoLock.js
import { useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import { useStore } from '../store/useStore';

const ACTIVE_IDLE_MS = 10 * 60 * 1000;

export default function useAutoLock() {
  const { isAuthenticated, lockApp, autoLockSeconds } = useStore();
  const autoLockMs = autoLockSeconds * 1000;
  const timerRef = useRef(null);
  const lastActiveRef = useRef(Date.now());
  const appStateRef = useRef(AppState.currentState);

  const resetTimer = useCallback(() => {
    lastActiveRef.current = Date.now();
    if (timerRef.current) clearTimeout(timerRef.current);
    if (isAuthenticated) {
      timerRef.current = setTimeout(() => {
        lockApp();
      }, ACTIVE_IDLE_MS);
    }
  }, [isAuthenticated, lockApp, autoLockMs]);

  useEffect(() => {
    if (!isAuthenticated) return;

    resetTimer();

    // Detekte lè app la al background
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (appStateRef.current === 'active' && nextState.match(/inactive|background/)) {
        lastActiveRef.current = Date.now();
      }

      if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        // App la tounen — tcheke si 10 minit pase
        const elapsed = Date.now() - lastActiveRef.current;
        if (elapsed >= autoLockMs) {
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
  }, [isAuthenticated, resetTimer, lockApp, autoLockMs]);

  return { resetTimer };
}
