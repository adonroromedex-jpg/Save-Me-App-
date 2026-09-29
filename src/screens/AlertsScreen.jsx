// ============================================================
// src/screens/AlertsScreen.jsx
// ============================================================
import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList } from 'react-native';
import { useStore } from '../store/useStore';
import { useTranslation } from 'react-i18next';

const COLOR = { success: '#4CAF50', warning: '#FF9800', danger: '#D32F2F' };

export function AlertsScreen() {
  const { t } = useTranslation();
  const storeAlerts = useStore(s => s.alerts);

  return (
    <SafeAreaView style={as.container}>
      <Text style={as.title}>🚨 {t('alerts')}</Text>
      <FlatList
        data={storeAlerts}
        keyExtractor={i => i.id}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        ListEmptyComponent={<Text style={as.itemDetail}>{t('noAlerts')}</Text>}
        renderItem={({ item }) => (
          <View style={as.item}>
            <View style={[as.dot, { backgroundColor: COLOR[item.type] || '#666' }]} />
            <Text style={as.icon}>{item.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={as.itemTitle}>{item.title}</Text>
              <Text style={as.itemDetail}>{item.detail}</Text>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const as = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A1A' },
  title: { color: '#fff', fontSize: 18, fontWeight: '600', padding: 16 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#12122A', borderRadius: 12, padding: 12, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)' },
  dot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  icon: { fontSize: 20 },
  itemTitle: { color: '#DDD', fontSize: 13, fontWeight: '500' },
  itemDetail: { color: '#555', fontSize: 11, marginTop: 2 },
});

export default AlertsScreen;
