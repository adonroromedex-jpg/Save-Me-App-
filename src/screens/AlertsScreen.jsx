// ============================================================
// src/screens/AlertsScreen.jsx
// ============================================================
import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList } from 'react-native';
import { useStore } from '../store/useStore';

const DEMO_ALERTS = [
  { id: '1', type: 'success', title: 'Koneksyon siksè', detail: 'iPhone 14 · Jodi a 9:41 AM', icon: '✅' },
  { id: '2', type: 'warning', title: 'Nouvo aparèy detekte', detail: 'Samsung Galaxy · Yè 11:20 PM · Verifye ✓', icon: '⚠️' },
  { id: '3', type: 'success', title: '2FA aktivé', detail: 'Lendi 8:00 AM', icon: '🔐' },
  { id: '4', type: 'danger', title: 'Tantativ aksè refize', detail: 'Aparèy enkoni · Samdi 3:15 AM · Bloke ✓', icon: '🚫' },
  { id: '5', type: 'success', title: 'Backup chifre fèt', detail: 'Jedi 2:00 PM', icon: '💾' },
];

const COLOR = { success: '#4CAF50', warning: '#FF9800', danger: '#D32F2F' };

export function AlertsScreen() {
  const storeAlerts = useStore(s => s.alerts);
  const all = [...storeAlerts, ...DEMO_ALERTS];

  return (
    <SafeAreaView style={as.container}>
      <Text style={as.title}>🚨 Alèt Sekirite</Text>
      <FlatList
        data={all}
        keyExtractor={i => i.id}
        contentContainerStyle={{ padding: 16, gap: 10 }}
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
