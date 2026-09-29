import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { usePreventScreenCapture } from 'expo-screen-capture';
import { useTranslation } from 'react-i18next';
import { restoreAppLanguage } from './src/i18n/language';
import { SecureOverlayProvider } from './src/components/SecureOverlay';
import AppNavigator from './src/navigation/AppNavigator';
import useAutoLock from './src/hooks/useAutoLock';
import { getSupabaseClient } from './src/services/supabase';
import { publicUser } from './src/services/auth';
import { ensureIdentity } from './src/services/identity';
import { syncProfile } from './src/services/messages';
import { clearVaultPreviews } from './src/services/vault';
import { useStore } from './src/store/useStore';

export default function App() {
  const { t } = useTranslation();
  usePreventScreenCapture();
  const { resetTimer } = useAutoLock();
  const [ready, setReady] = useState(false);
  const [languageReady, setLanguageReady] = useState(false);
  const [cacheReady, setCacheReady] = useState(false);
  const [configError, setConfigError] = useState('');
  const [profileError, setProfileError] = useState('');

  useEffect(() => {
    restoreAppLanguage().catch(() => {}).finally(() => setLanguageReady(true));
    clearVaultPreviews().catch(() => {}).finally(() => setCacheReady(true));
  }, []);

  useEffect(() => {
    let active = true;
    let subscription;
    try {
      const client = getSupabaseClient();
      const syncSession = async () => {
        const { data: { session } } = await client.auth.getSession();
        if (!active) return;
        if (!session) {
          useStore.getState().logout();
          setProfileError('');
        } else {
          const { data: { user }, error } = await client.auth.getUser();
          if (!active) return;
          if (error || !user) useStore.getState().logout();
          else {
            if (!useStore.getState().isAuthenticated) useStore.getState().restoreUser(publicUser(user));
            try {
              const profile = await syncProfile(user);
              await ensureIdentity(user.id);
              if (active) setProfileError(profile.phone_e164 ? '' : t('profilePhoneNeeded'));
            } catch (error) {
              if (active) setProfileError(`${t('profileSyncFailed')} ${error.message}`);
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

  if (!ready || !languageReady || !cacheReady) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  if (configError) return <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}><Text>{configError}</Text></View>;

  return (
    <SafeAreaProvider>
      <SafeAreaView onTouchStart={resetTimer} style={{ flex: 1, backgroundColor: '#0A0A1A' }} edges={['top']}>
        <View style={{ backgroundColor: '#163651', paddingVertical: 3, alignItems: 'center' }}>
          <Text style={{ color: '#D5E8F8', fontSize: 12, fontWeight: '700' }}>{t('exchangePilot')}</Text>
        </View>
        {!!profileError && <View style={{ backgroundColor: '#572020', padding: 8 }}>
          <Text style={{ color: '#FFFFFF', fontSize: 12 }}>{profileError}</Text>
        </View>}
        <SecureOverlayProvider>
        <NavigationContainer>
          <StatusBar style="light" />
          <AppNavigator />
        </NavigationContainer>
        </SecureOverlayProvider>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
