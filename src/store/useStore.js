// src/store/useStore.js
import { create } from 'zustand';

export const useStore = create((set) => ({
  // Auth
  user: null,
  isAuthenticated: false,
  isLocked: true,
  plan: 'free', // 'free' | 'pro' | 'premium' | 'business'

  // App state
  language: 'fr',
  biometricEnabled: true,
  autoLockSeconds: 30,

  // Files
  files: [],

  // Alerts
  alerts: [],

  // Actions
  setUser: (user) => set({ user, isAuthenticated: true }),
  logout: () => set({ user: null, isAuthenticated: false, isLocked: true }),
  lockApp: () => set({ isLocked: true }),
  unlockApp: () => set({ isLocked: false }),
  setLanguage: (language) => set({ language }),
  setPlan: (plan) => set({ plan }),
  addFile: (file) => set((state) => ({ files: [...state.files, file] })),
  removeFile: (id) => set((state) => ({ files: state.files.filter(f => f.id !== id) })),
  addAlert: (alert) => set((state) => ({ alerts: [alert, ...state.alerts] })),
}));
