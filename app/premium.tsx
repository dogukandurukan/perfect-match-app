// Screen: Premium (visual placeholder) | Status: placeholder | Last updated: Temmuz 2026
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';

const ACCENT = '#B8860B';

type FeatureRow = {
  feature: string;
  free: string;
  premium: string;
  premiumCheck?: boolean;
};

const FEATURES: FeatureRow[] = [
  { feature: 'Daily profiles', free: '3', premium: '10' },
  { feature: 'Daily invites', free: '1', premium: '3' },
  { feature: 'Active matches', free: '3', premium: '5' },
  { feature: 'See who likes you', free: '—', premium: '✓', premiumCheck: true },
  { feature: 'Unlimited likes', free: '—', premium: '✓', premiumCheck: true },
];

export default function PremiumScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [comingSoonVisible, setComingSoonVisible] = useState(false);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityLabel="Go back"
          style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={ACCENT} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <MaterialCommunityIcons name="crown" size={44} color={ACCENT} />
          <ThemedText style={styles.title}>Go Premium ✨</ThemedText>
          <ThemedText style={styles.subtitle}>More matches. More invites. More you.</ThemedText>
        </View>

        <View style={styles.table}>
          <View style={[styles.row, styles.tableHeader]}>
            <ThemedText style={[styles.cellFeature, styles.headerCell]}>Feature</ThemedText>
            <ThemedText style={[styles.cellFree, styles.headerCell]}>Free</ThemedText>
            <ThemedText style={[styles.cellPremium, styles.headerCell, styles.premiumHeader]}>
              Premium
            </ThemedText>
          </View>

          {FEATURES.map((row) => (
            <View key={row.feature} style={styles.row}>
              <ThemedText style={styles.cellFeature}>{row.feature}</ThemedText>
              <ThemedText style={styles.cellFree}>{row.free}</ThemedText>
              <ThemedText
                style={[
                  styles.cellPremium,
                  row.premiumCheck ? styles.checkMark : styles.premiumValue,
                ]}>
                {row.premium}
              </ThemedText>
            </View>
          ))}
        </View>

        <View style={styles.priceBlock}>
          <ThemedText style={styles.price}>{'{PRICE} / month'}</ThemedText>
          <ThemedText style={styles.cancelNote}>Cancel anytime</ThemedText>
        </View>

        <TouchableOpacity
          style={styles.cta}
          activeOpacity={0.85}
          onPress={() => setComingSoonVisible(true)}>
          <ThemedText style={styles.ctaText}>Get Premium</ThemedText>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={comingSoonVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setComingSoonVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setComingSoonVisible(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <ThemedText style={styles.modalTitle}>Coming soon ✨</ThemedText>
            <ThemedText style={styles.modalBody}>
              Premium is on the way. Stay tuned.
            </ThemedText>
            <TouchableOpacity
              style={styles.modalBtn}
              activeOpacity={0.85}
              onPress={() => setComingSoonVisible(false)}>
              <ThemedText style={styles.modalBtnText}>Got it</ThemedText>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  backBtn: {
    padding: 8,
    alignSelf: 'flex-start',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  hero: {
    alignItems: 'center',
    gap: 10,
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 22,
  },
  table: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EDEDED',
    overflow: 'hidden',
    marginBottom: 28,
  },
  tableHeader: {
    backgroundColor: '#FAFAFA',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EDEDED',
  },
  headerCell: {
    fontWeight: '700',
    fontSize: 13,
    color: '#888888',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  premiumHeader: {
    color: ACCENT,
  },
  cellFeature: {
    flex: 1.4,
    fontSize: 15,
    color: '#1A1A1A',
  },
  cellFree: {
    flex: 0.7,
    fontSize: 15,
    color: '#888888',
    textAlign: 'center',
  },
  cellPremium: {
    flex: 0.9,
    fontSize: 15,
    textAlign: 'center',
  },
  premiumValue: {
    color: ACCENT,
    fontWeight: '700',
  },
  checkMark: {
    color: ACCENT,
    fontWeight: '700',
    fontSize: 18,
  },
  priceBlock: {
    alignItems: 'center',
    gap: 4,
    marginBottom: 20,
  },
  price: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  cancelNote: {
    fontSize: 14,
    color: '#999999',
  },
  cta: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 28,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    gap: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  modalBody: {
    fontSize: 15,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  modalBtn: {
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 28,
    marginTop: 4,
  },
  modalBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
