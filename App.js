import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import './src/i18n';
import AppNavigator from './src/navigation/AppNavigator';
import useAutoLock from './src/hooks/useAutoLock';
import { getSupabaseClient } from './src/services/supabase';
import { publicUser } from './src/services/auth';
import { useStore } from './src/store/useStore';

export default function App() {
  useAutoLock();
  const [ready, setReady] = useState(false);
  const [configError, setConfigError] = useState('');

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
          const { data: level, error } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
          if (!active) return;
          if (!error && level.currentLevel === 'aal2') {
            useStore.getState().setUser(publicUser(session.user));
          } else {
            useStore.getState().logout();
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

  if (!ready) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  if (configError) return <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}><Text>{configError}</Text></View>;

  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <AppNavigator />
    </NavigationContainer>
  );
}
