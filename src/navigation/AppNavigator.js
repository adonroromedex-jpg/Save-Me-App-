// src/navigation/AppNavigator.js
import React, { useState, useEffect } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { useStore } from '../store/useStore';

import SplashScreen from '../screens/SplashScreen';
import WelcomeScreen from '../screens/WelcomeScreen';
import RegisterScreen from '../screens/RegisterScreen';
import LoginScreen from '../screens/LoginScreen';
import BiometricScreen from '../screens/BiometricScreen';
import NewDeviceScreen from '../screens/NewDeviceScreen';
import DashboardScreen from '../screens/DashboardScreen';
import VaultScreen from '../screens/VaultScreen';
import CameraScreen from '../screens/CameraScreen';
import MessagesScreen from '../screens/MessagesScreen';
import AlertsScreen from '../screens/AlertsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import PlansScreen from '../screens/PlansScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function TabIcon({ name, focused }) {
  const icons = {
    Dashboard: '🏠', Vault: '📁', Camera: '📷',
    Messages: '💬', Alerts: '🚨', Settings: '⚙️',
  };
  return <Text style={{ fontSize: 20 }}>{icons[name] || '●'}</Text>;
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#FDF0F5',
          borderTopColor: 'rgba(211,47,47,0.1)',
          paddingBottom: 8,
          height: 60,
        },
        tabBarActiveTintColor: '#D32F2F',
        tabBarInactiveTintColor: '#AAAAAA',
        tabBarLabelStyle: { fontSize: 10 },
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ tabBarLabel: 'Akèy' }} />
      <Tab.Screen name="Vault" component={VaultScreen} options={{ tabBarLabel: 'Vault' }} />
      <Tab.Screen name="Camera" component={CameraScreen} options={{ tabBarLabel: 'Kamera' }} />
      <Tab.Screen name="Messages" component={MessagesScreen} options={{ tabBarLabel: 'Mesaj' }} />
      <Tab.Screen name="Alerts" component={AlertsScreen} options={{ tabBarLabel: 'Alèt' }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarLabel: 'Paran' }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { isAuthenticated, isLocked } = useStore();
  const [showLockSplash, setShowLockSplash] = useState(false);

  useEffect(() => {
    // Lè app la vèwouye — montre splash screen anvan login
    if (isLocked && isAuthenticated) {
      setShowLockSplash(true);
    }
  }, [isLocked]);

  // Splash screen anvan re-login apre auto-lock
  if (showLockSplash) {
    return (
      <SplashScreen onFinish={() => setShowLockSplash(false)} />
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthenticated ? (
        <>
          <Stack.Screen name="Welcome" component={WelcomeScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="NewDevice" component={NewDeviceScreen} />
        </>
      ) : isLocked ? (
        <Stack.Screen name="Biometric" component={BiometricScreen} />
      ) : (
        <>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen name="Plans" component={PlansScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}
