import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { usePreventScreenCapture } from 'expo-screen-capture';
import { restoreAppLanguage } from './src/i18n/language';
import AppNavigator from './src/navigation/AppNavigator';
import useAutoLock from './src/hooks/useAutoLock';
import { getSupabaseClient } from './src/services/supabase';
import { publicUser } from './src/services/auth';
import { syncProfile } from './src/services/messages';
import { clearVaultPreviews } from './src/services/vault';
import { useStore } from './src/store/useStore';

export default function App() {
  usePreventScreenCapture();
  useAutoLock();
  const [ready, setReady] = useState(false);
  const [languageReady, setLanguageReady] = useState(false);
  const [configError, setConfigError] = useState('');

  useEffect(() => {
    restoreAppLanguage().catch(() => {}).finally(() => setLanguageReady(true));
    clearVaultPreviews().catch(() => {});
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
        } else {
          const { data: { user }, error } = await client.auth.getUser();
          if (!active) return;
          if (error || !user) useStore.getState().logout();
          else {
            if (!useStore.getState().isAuthenticated) useStore.getState().restoreUser(publicUser(user));
            syncProfile(user).catch(error => console.warn('Profile sync:', error.message));
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

  if (!ready || !languageReady) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  if (configError) return <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}><Text>{configError}</Text></View>;

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A1A' }} edges={['top']}>
        <View style={{ backgroundColor: '#FFE600', paddingVertical: 3, alignItems: 'center' }}>
          <Text style={{ color: '#111111', fontSize: 12, fontWeight: '700' }}>SAVE ME • TEST 29/09</Text>
        </View>
        <NavigationContainer>
          <StatusBar style="light" />
          <AppNavigator />
        </NavigationContainer>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
