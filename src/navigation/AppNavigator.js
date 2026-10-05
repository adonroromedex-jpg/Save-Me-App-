// src/navigation/AppNavigator.js
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useStore } from '../store/useStore';

import WelcomeScreen from '../screens/WelcomeScreen';
import RegisterScreen from '../screens/RegisterScreen';
import LoginScreen from '../screens/LoginScreen';
import BiometricScreen from '../screens/BiometricScreen';
import DashboardScreen from '../screens/DashboardScreen';
import VaultScreen from '../screens/VaultScreen';
import CameraScreen from '../screens/CameraScreen';
import MessagesScreen from '../screens/MessagesScreen';
import SettingsScreen from '../screens/SettingsScreen';
import PlansScreen from '../screens/PlansScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function TabIcon({ name, focused }) {
  const icons = {
    Dashboard: ['home-outline', 'home'],
    Vault: ['lock-closed-outline', 'lock-closed'],
    Camera: ['camera-outline', 'camera'],
    Messages: ['chatbubbles-outline', 'chatbubbles'],
    Settings: ['settings-outline', 'settings'],
  };
  return <View style={{ width: 48, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: focused ? 'rgba(255,255,255,0.18)' : 'transparent' }}>
    <Ionicons name={icons[name][focused ? 1 : 0]} size={23} color={focused ? '#FFFFFF' : 'rgba(255,255,255,0.75)'} />
  </View>;
}

function MainTabs() {
  const { t } = useTranslation();
  const unread=useStore(s=>s.unread);
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, 10);
  return (
    <Tab.Navigator screenOptions={({ route }) => ({
      headerShown: false,
      tabBarHideOnKeyboard: true,
      tabBarStyle: {
        backgroundColor: '#104A91', borderTopWidth: 0,
        paddingTop: 7, paddingBottom: bottom, height: 64 + bottom,
        elevation: 0, shadowOpacity: 0,
      },
      tabBarActiveTintColor: '#FFFFFF',
      tabBarInactiveTintColor: 'rgba(255,255,255,0.75)',
      tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginBottom: 3 },
      tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
    })}>
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ tabBarLabel: t('home') }} />
      <Tab.Screen name="Vault" component={VaultScreen} options={{ tabBarLabel: t('vault') }} />
      <Tab.Screen name="Camera" component={CameraScreen} options={{ tabBarLabel: t('camera') }} />
      <Tab.Screen name="Messages" component={MessagesScreen} options={{ tabBarLabel: t('messages'),tabBarBadge:unread?Math.min(unread,99):undefined }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarLabel: t('settings') }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { isAuthenticated, isLocked, user } = useStore();

  return (
    <View style={{flex:1}}>
    <View style={{flex:1,display:isAuthenticated&&isLocked?'none':'flex'}} accessibilityElementsHidden={isAuthenticated&&isLocked} importantForAccessibility={isAuthenticated&&isLocked?'no-hide-descendants':'auto'}>
    <Stack.Navigator key={user?.id||'guest'} screenOptions={{ headerShown: false }}>
      {!isAuthenticated ? (
        <>
          <Stack.Screen name="Welcome" component={WelcomeScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen name="Plans" component={PlansScreen} />
        </>
      )}
    </Stack.Navigator>
    </View>
    {isAuthenticated&&isLocked&&<BiometricScreen />}
    </View>
  );
}
