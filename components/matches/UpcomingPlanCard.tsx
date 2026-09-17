import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { PersonAvatar } from '@/components/matches/PersonAvatar';
import { ThemedText } from '@/components/themed-text';
import { homeColors, homeRadius, homeShadow, homeSpacing } from '@/lib/homeTheme';

export type UpcomingPlan = {
  matchId: string;
  userId: string;
  name: string;
  photoUrl: string | null;
  venue: string | null;
  district: string | null;
  whenLabel: string | null;
  canMessage: boolean;
};

/** Confirmed/upcoming date card for the Plans tab — never renders an expired/cancelled/past plan (filtered by the caller). */
export function UpcomingPlanCard({
  plan,
  onViewPlan,
  onMessage,
}: {
  plan: UpcomingPlan;
  onViewPlan: () => void;
  onMessage: () => void;
}) {
  return (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.top}
        activeOpacity={0.85}
        onPress={onViewPlan}
        accessibilityRole="button"
        accessibilityLabel={`View plan with ${plan.name}`}>
        <PersonAvatar photoUrl={plan.photoUrl} name={plan.name} size={56} />
        <View style={styles.info}>
          <ThemedText style={styles.name} numberOfLines={1}>
            {plan.name}
          </ThemedText>
          {plan.venue ? (
            <View style={styles.row}>
              <Ionicons name="cafe-outline" size={13} color={homeColors.textSecondary} />
              <ThemedText style={styles.rowText} numberOfLines={1}>
                {plan.venue}
              </ThemedText>
            </View>
          ) : null}
          {plan.whenLabel ? (
            <View style={styles.row}>
              <Ionicons name="calendar-outline" size={13} color={homeColors.textSecondary} />
              <ThemedText style={styles.rowText} numberOfLines={1}>
                {plan.whenLabel}
              </ThemedText>
            </View>
          ) : null}
          {plan.district ? (
            <View style={styles.row}>
              <Ionicons name="location-outline" size={13} color={homeColors.textSecondary} />
              <ThemedText style={styles.rowText} numberOfLines={1}>
                {plan.district}
              </ThemedText>
            </View>
          ) : null}
        </View>
        <View style={styles.confirmedBadge}>
          <Ionicons name="checkmark-circle" size={13} color="#2E7D4F" />
          <ThemedText style={styles.confirmedText}>Confirmed</ThemedText>
        </View>
      </TouchableOpacity>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.viewBtn}
          onPress={onViewPlan}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="View plan">
          <ThemedText style={styles.viewBtnText}>View plan</ThemedText>
        </TouchableOpacity>
        {plan.canMessage ? (
          <TouchableOpacity
            style={styles.messageBtn}
            onPress={onMessage}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`Message ${plan.name}`}>
            <Ionicons name="chatbubble-outline" size={15} color={homeColors.accent} />
            <ThemedText style={styles.messageBtnText}>Message</ThemedText>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: homeColors.surface,
    borderRadius: homeRadius.card,
    borderWidth: 1,
    borderColor: homeColors.border,
    padding: homeSpacing.md,
    gap: homeSpacing.md,
    ...homeShadow,
  },
  top: { flexDirection: 'row', gap: homeSpacing.sm + 2, alignItems: 'center' },
  info: { flex: 1, gap: 3 },
  name: { fontSize: 16, fontWeight: '700', color: homeColors.textPrimary },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rowText: { fontSize: 12.5, color: homeColors.textSecondary, flexShrink: 1 },
  // Muted green, not a bright/neon success color — matches the app's calm
  // "confirmed" language elsewhere (plan-detail screen uses the same tone).
  confirmedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    alignSelf: 'flex-start',
  },
  confirmedText: { fontSize: 11.5, fontWeight: '700', color: '#2E7D4F' },
  actions: { flexDirection: 'row', gap: homeSpacing.sm },
  viewBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: homeRadius.pill,
    backgroundColor: homeColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewBtnText: { color: '#FFFFFF', fontSize: 14.5, fontWeight: '700' },
  messageBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: homeRadius.pill,
    borderWidth: 1.5,
    borderColor: homeColors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  messageBtnText: { color: homeColors.accent, fontSize: 14.5, fontWeight: '700' },
});
