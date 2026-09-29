// ============================================================
// src/screens/PlansScreen.jsx
// ============================================================
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useStore } from '../store/useStore';

const PLANS = [
  { id: 'free', icon: '🆓', nameKey: 'free', price: '$0', features: ['vault', 'camera', 'messages'], color: '#555' },
  { id: 'pro', icon: '⭐', nameKey: 'pro', price: '$5', periodKey: 'perWeek', features: ['vault', 'photoSharing'], color: '#FF9800' },
  { id: 'premium', icon: '💎', nameKey: 'premium', price: '$16', periodKey: 'perMonth', features: ['vault', 'photoVideo'], color: '#1565C0', featured: true },
  { id: 'business', icon: '🏢', nameKey: 'business', price: '$55', periodKey: 'perYear', features: ['vault', 'photoVideo', 'messages'], color: '#9C27B0' },
];

export function PlansScreen({ navigation }) {
  const { t } = useTranslation();
  const plan = useStore(s => s.plan);

  const handleSelect = (id) => {
    if (id === 'free') return;
    Alert.alert(t('plans'), t('billingUnavailable'));
  };

  return (
    <SafeAreaView style={ps.container}>
      <ScrollView contentContainerStyle={ps.scroll}>
        <Text style={ps.title}>{t('plans')}</Text>
        <Text style={ps.sub}>{t('choosePlan')}</Text>
        <Text style={ps.sub}>{t('planPreview')}</Text>
        {PLANS.map(p => (
          <TouchableOpacity key={p.id} style={[ps.card, p.featured && ps.cardFeatured, plan === p.id && ps.cardActive]} onPress={() => handleSelect(p.id)}>
            {p.featured && <View style={ps.badge}><Text style={ps.badgeText}>⭐ {t('mostPopular')}</Text></View>}
            <View style={ps.cardRow}>
              <Text style={ps.planName}>{p.icon} {t(p.nameKey)}</Text>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={ps.price}>{p.price}</Text>
                {p.periodKey && <Text style={ps.period}>{t(p.periodKey)}</Text>}
              </View>
            </View>
            {p.features.map(f => (
              <Text key={f} style={ps.feat}>✓ {t(f)}</Text>
            ))}
            {plan === p.id && <Text style={ps.current}>✅ {t('currentPlan')}</Text>}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const ps = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A1A' },
  scroll: { padding: 16 },
  title: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 4 },
  sub: { color: '#8888AA', fontSize: 13, marginBottom: 16 },
  card: { backgroundColor: '#12122A', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: 14, marginBottom: 12, position: 'relative' },
  cardFeatured: { borderColor: '#1565C0', borderWidth: 1.5 },
  cardActive: { borderColor: '#D32F2F' },
  badge: { position: 'absolute', top: -10, right: 14, backgroundColor: '#1565C0', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  planName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  price: { color: '#fff', fontSize: 16, fontWeight: '700' },
  period: { color: '#8888AA', fontSize: 11 },
  feat: { color: '#AABBCC', fontSize: 12, marginBottom: 3 },
  current: { color: '#D32F2F', fontSize: 11, marginTop: 6, fontWeight: '500' },
});

export default PlansScreen;
