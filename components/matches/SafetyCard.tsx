import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { homeColors, homeRadius, homeSpacing } from '@/lib/homeTheme';

/**
 * "Meet with confidence" — calm, reassuring, not alarm-red (brief:
 * "alarm veren kırmızı bir tasarım kullanmamalı"). Soft coral/ivory
 * surface, shield/location outline icons.
 *
 * Safety check-in is rendered disabled with a "Soon" badge — there is no
 * real live-location/emergency-contact backend in this app (checked:
 * `checkin.tsx` is an unrelated POST-meetup "did you go / rate it" flow,
 * not a live safety check-in; no `safety_checkins` table, no location-
 * sharing or emergency-contact system exists). Per the brief's own explicit
 * instruction for exactly this case, this shows a disabled control instead
 * of pretending the feature works.
 */
export function SafetyCard({ onSharePlan }: { onSharePlan: () => void }) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Ionicons name="shield-checkmark-outline" size={18} color={homeColors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.title}>Meet with confidence</ThemedText>
          <ThemedText style={styles.subtitle}>Simple tools for a safer, more enjoyable date.</ThemedText>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={onSharePlan}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Share your plan">
          <Ionicons name="share-outline" size={17} color={homeColors.accent} />
          <ThemedText style={styles.actionText}>Share plan</ThemedText>
        </TouchableOpacity>
        <View
          style={[styles.actionBtn, styles.actionBtnDisabled]}
          accessibilityRole="button"
          accessibilityLabel="Safety check-in, coming soon"
          accessibilityState={{ disabled: true }}>
          <Ionicons name="location-outline" size={17} color={homeColors.textSecondary} />
          <ThemedText style={styles.actionTextDisabled}>Safety check-in</ThemedText>
          <View style={styles.soonBadge}>
            <ThemedText style={styles.soonText}>Soon</ThemedText>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: homeColors.accentSoft,
    borderRadius: homeRadius.card,
    padding: homeSpacing.md,
    gap: homeSpacing.md,
  },
  header: { flexDirection: 'row', gap: homeSpacing.sm, alignItems: 'flex-start' },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: homeColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 15.5, fontWeight: '800', color: homeColors.textPrimary },
  subtitle: { fontSize: 12.5, color: homeColors.textSecondary, marginTop: 2, lineHeight: 17 },
  actions: { gap: homeSpacing.sm },
  actionBtn: {
    minHeight: 44,
    borderRadius: homeRadius.pill,
    backgroundColor: homeColors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionBtnDisabled: { opacity: 0.7 },
  actionText: { fontSize: 14.5, fontWeight: '700', color: homeColors.accent },
  actionTextDisabled: { fontSize: 14.5, fontWeight: '700', color: homeColors.textSecondary },
  soonBadge: {
    backgroundColor: homeColors.mutedSurface,
    borderRadius: homeRadius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  soonText: { fontSize: 10.5, fontWeight: '700', color: homeColors.textSecondary },
});
