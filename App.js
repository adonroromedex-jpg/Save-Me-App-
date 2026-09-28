import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import './src/i18n';
import AppNavigator from './src/navigation/AppNavigator';
import useAutoLock from './src/hooks/useAutoLock';

export default function App() {
  useAutoLock();

  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <AppNavigator />
    </NavigationContainer>
  );
}
