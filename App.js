import useIncomingMessages from './src/hooks/useIncomingMessages';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { usePreventScreenCapture } from 'expo-screen-capture';
import { useTranslation } from 'react-i18next';
import { restoreAppLanguage } from './src/i18n/language';
import { SecureOverlayProvider } from './src/components/SecureOverlay';
import { AppDialogHost } from './src/components/AppDialog';
import SplashScreen from './src/screens/SplashScreen';
import AppNavigator from './src/navigation/AppNavigator';
import useAutoLock from './src/hooks/useAutoLock';
import { getSupabaseClient } from './src/services/supabase';
import { publicUser } from './src/services/auth';
import { ensureIdentity } from './src/services/identity';
import { syncProfile } from './src/services/messages';
import { clearVaultPreviews } from './src/services/vault';
import { useStore } from './src/store/useStore';

const navigationRef=createNavigationContainerRef();
export default function App() {
  useIncomingMessages();
  const pendingPeer=useStore(s=>s.pendingPeer),locked=useStore(s=>s.isLocked);
  const openNotification=()=>{if(pendingPeer&&!locked&&navigationRef.isReady())navigationRef.navigate('Main',{screen:'Messages'});};
  useEffect(openNotification,[pendingPeer,locked]);
  const { t } = useTranslation();
  usePreventScreenCapture();
  const { resetTimer } = useAutoLock();
  const [ready, setReady] = useState(false);
  const [languageReady, setLanguageReady] = useState(false);
  const [cacheReady, setCacheReady] = useState(false);
  const [configError, setConfigError] = useState('');
  const [splashDone, setSplashDone] = useState(false);
  const setIssue = (kind, error) => useStore.getState().setSyncIssue(kind, error ? {code:error.code || '', message:error.message || String(error)} : null);

  useEffect(() => {
    restoreAppLanguage().catch(() => {}).finally(() => setLanguageReady(true));
    clearVaultPreviews().catch(() => {}).finally(() => setCacheReady(true));
  }, []);

  useEffect(() => {
    let active = true;
    let generation = 0;
    let subscription;
    try {
      const client = getSupabaseClient();
      const syncSession = async () => {
        const attempt=++generation;
        const { data: { session } } = await client.auth.getSession();
        if (!active || attempt!==generation) return;
        if (!session) {
          useStore.getState().logout();
          setIssue('profile',null); setIssue('identity',null);
        } else {
          const { data: { user }, error } = await client.auth.getUser();
          if (!active || attempt!==generation) return;
          if (error || !user) useStore.getState().logout();
          else {
            if (!useStore.getState().isAuthenticated) useStore.getState().restoreUser(publicUser(user));
            setReady(true);
            // Profile sync and key registration have separate diagnostics.
            const identityRevision=useStore.getState().identityRevision;
            const results = await Promise.allSettled([syncProfile(user), ensureIdentity(user.id)]);
            if (active && attempt===generation && useStore.getState().user?.id === user.id) {
              if(results[0].status==='fulfilled'){const p=results[0].value;useStore.getState().patchUser({firstName:p.first_name,name:p.last_name,phoneNumber:p.phone_e164||''});}
              setIssue('profile', results[0].status === 'rejected' ? results[0].reason :
                results[0].value.phone_e164 ? null : new Error(t('profilePhoneNeeded')));
              if(identityRevision===useStore.getState().identityRevision)setIssue('identity', results[1].status === 'rejected' ? results[1].reason : null);
            }
          }
        }
        setReady(true);
      };
      const result = client.auth.onAuthStateChange(() => {
        setTimeout(() => { syncSession().catch(() => setReady(true)); }, 0);
      });
      subscription = result.data.subscription;
      syncSession().catch(() => setReady(true));
    } catch (e) {
      setConfigError(e.message);
      setReady(true);
    }
    return () => { active = false; subscription?.unsubscribe(); };
  }, []);

  if (!splashDone) return <SplashScreen onFinish={() => setSplashDone(true)} />;
  if (!ready || !languageReady || !cacheReady) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  if (configError) return <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}><Text>{configError}</Text></View>;

  return (
    <SafeAreaProvider>
      <SafeAreaView onTouchStart={resetTimer} style={{ flex: 1, backgroundColor: '#0A0A1A' }} edges={['top']}>
        <SecureOverlayProvider>
        <NavigationContainer ref={navigationRef} onReady={openNotification}>
          <StatusBar style="light" />
          <AppNavigator />
        </NavigationContainer>
        <AppDialogHost />
        </SecureOverlayProvider>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
