import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { PersonAvatar } from '@/components/matches/PersonAvatar';
import { ThemedText } from '@/components/themed-text';
import { homeColors, homeRadius, homeShadow, homeSpacing } from '@/lib/homeTheme';

export type PendingPlan = {
  matchId: string;
  userId: string;
  name: string;
  age: number;
  photoUrl: string | null;
  venue: string | null;
  district: string | null;
  whenLabel: string | null;
  direction: 'outgoing' | 'incoming';
};

/**
 * A date-planning process that has started but isn't confirmed yet — either
 * direction. Outgoing shows a status pill (never a button-shaped element —
 * it's a state, not an action) + a quiet "View invitation" text action.
 * Incoming shows a real primary "Review invitation" button since a
 * decision is actually needed from the viewer.
 */
export function PendingPlanCard({
  plan,
  onPrimaryAction,
}: {
  plan: PendingPlan;
  /** Outgoing: "View invitation" (opens a read-only summary). Incoming: "Review invitation" (routes to the existing invite-review flow). */
  onPrimaryAction: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <PersonAvatar photoUrl={plan.photoUrl} name={plan.name} size={64} radius={homeRadius.cardSmall} />
        <View style={styles.info}>
          <ThemedText style={styles.name} numberOfLines={1}>
            {plan.name}
            {plan.age > 0 ? `, ${plan.age}` : ''}
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
      </View>

      {plan.direction === 'outgoing' ? (
        <View style={styles.bottomRow}>
          <View style={styles.statusPill}>
            <Ionicons name="time-outline" size={12} color={homeColors.accent} />
            <ThemedText style={styles.statusPillText} numberOfLines={1}>
              Waiting for {plan.name}
            </ThemedText>
          </View>
          <TouchableOpacity
            style={styles.viewAction}
            onPress={onPrimaryAction}
            hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="View invitation">
            <ThemedText style={styles.viewActionText}>View invitation</ThemedText>
            <Ionicons name="chevron-forward" size={15} color={homeColors.accent} />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.reviewBtn}
          onPress={onPrimaryAction}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Review invitation">
          <ThemedText style={styles.reviewBtnText}>Review invitation</ThemedText>
        </TouchableOpacity>
      )}
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
    gap: homeSpacing.sm + 2,
    ...homeShadow,
  },
  top: { flexDirection: 'row', gap: homeSpacing.sm + 2 },
  info: { flex: 1, gap: 3, justifyContent: 'center' },
  name: { fontSize: 16.5, fontWeight: '700', color: homeColors.textPrimary },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rowText: { fontSize: 12.5, color: homeColors.textSecondary, flexShrink: 1 },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: homeSpacing.sm,
  },
  // Status pill, not a button — brief: "disabled form button gibi
  // görünmemeli". Small, soft-coral, no shadow/border-radius-pill-button
  // affordance.
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: homeColors.accentSoft,
    borderRadius: homeRadius.pill,
    paddingHorizontal: homeSpacing.sm + 2,
    paddingVertical: 6,
    flexShrink: 1,
  },
  statusPillText: { fontSize: 12, fontWeight: '700', color: homeColors.accent },
  viewAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minHeight: 44,
    paddingHorizontal: 4,
  },
  viewActionText: { fontSize: 13.5, fontWeight: '700', color: homeColors.accent },
  reviewBtn: {
    minHeight: 44,
    borderRadius: homeRadius.pill,
    backgroundColor: homeColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewBtnText: { color: '#FFFFFF', fontSize: 14.5, fontWeight: '700' },
});
