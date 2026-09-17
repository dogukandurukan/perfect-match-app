import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { homeColors, homeRadius, homeShadow, homeSpacing } from '@/lib/homeTheme';
import { reasonIcon, reasonText } from '@/lib/matchReason';

/**
 * The product's core differentiator card — real algorithmic reasons, never
 * invented copy. Shows at most 3 (the RPC itself already caps `reasons` at
 * 3, in priority order), and renders nothing if there are none rather than
 * showing an empty card.
 */
export function WhyYouMatchCard({ reasons }: { reasons: string[] | null | undefined }) {
  const list = (reasons ?? []).filter((r) => r.trim().length > 0).slice(0, 3);
  if (list.length === 0) return null;

  return (
    <View style={styles.card}>
      <ThemedText style={styles.heading}>Why you match</ThemedText>
      {list.map((reason, i) => (
        <View key={reason} style={[styles.row, i === list.length - 1 && styles.rowLast]}>
          <View style={styles.iconWrap}>
            <Ionicons name={reasonIcon(reason)} size={17} color={homeColors.accent} />
          </View>
          <ThemedText style={styles.reasonText}>{reasonText(reason)}</ThemedText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: homeSpacing.lg,
    marginTop: homeSpacing.lg,
    padding: homeSpacing.lg,
    borderRadius: homeRadius.card,
    backgroundColor: homeColors.surface,
    borderWidth: 1,
    borderColor: homeColors.border,
    ...homeShadow,
  },
  heading: {
    fontSize: 17,
    fontWeight: '800',
    color: homeColors.textPrimary,
    marginBottom: homeSpacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: homeSpacing.md,
    paddingVertical: homeSpacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: homeColors.border,
  },
  rowLast: { borderBottomWidth: 0 },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: homeColors.accentSoft,
  },
  reasonText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: homeColors.textPrimary,
  },
});
