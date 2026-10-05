// src/store/useStore.js
import { create } from 'zustand';

const accountChange=(state,user)=>state.user?.id===user.id?{}:{files:[],unread:0,pendingPeer:null,activeChat:null,syncIssues:{},transferMetrics:[],deliveryMetrics:[]};

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

  profileRevision: 0,
  identityRevision: 0,
  identityChanged: () => set(state=>({identityRevision:state.identityRevision+1})),
  activeChat: null,
  setActiveChat: activeChat => set({activeChat}),
  unread: 0,
  pendingPeer: null,
  patchUser: fields => set(state => ({user: state.user ? {...state.user,...fields} : null})),
  profileChanged: () => set(state => ({profileRevision:state.profileRevision+1})),
  setUnread: unread => set({unread}),
  openPeer: pendingPeer => set({pendingPeer}),
  syncIssues: {},
  deliveryMetrics: [],
  recordDelivery: metric => set(state => state.deliveryMetrics.some(row=>row.id===metric.id) ? state : {deliveryMetrics:[metric,...state.deliveryMetrics].slice(0,6)}),
  transferMetrics: [],
  setSyncIssue: (kind, issue) => set(state => ({syncIssues:{...state.syncIssues,[kind]:issue}})),
  addTransferMetric: metric => set(state => ({transferMetrics:[metric,...state.transferMetrics].slice(0,6)})),

  // Alerts
  alerts: [],

  // Actions
  setUser: (user) => set(state=>({...accountChange(state,user),user,isAuthenticated:true,isLocked:true})),
  restoreUser: (user) => set(state=>({...accountChange(state,user),user,isAuthenticated:true,isLocked:true})),
  logout: () => set({ user: null, isAuthenticated: false, isLocked: true, files: [], plan: 'free', syncIssues: {}, transferMetrics: [], deliveryMetrics: [], unread:0, pendingPeer:null, activeChat:null }),
  lockApp: () => set({ isLocked: true }),
  unlockApp: () => set({ isLocked: false }),
  setLanguage: (language) => set({ language }),
  setPlan: (plan) => set({ plan }),
  setFiles: (files) => set({ files }),
  addAlert: (alert) => set((state) => ({ alerts: [alert, ...state.alerts] })),
}));
