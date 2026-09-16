import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { homeColors, homeRadius, homeShadow, homeSpacing } from '@/lib/homeTheme';

type IconName = ComponentProps<typeof Ionicons>['name'];

// `reasons` from `get_top_matches` are plain, already-written sentences
// (see the RPC's `reasons` CASE list) — not a typed category, so this is a
// best-effort keyword map purely for icon choice. The text itself is never
// altered or invented; only its icon is guessed. Falls back to a generic
// spark for any phrasing this doesn't recognize (future-proof against the
// RPC's reason copy changing).
function reasonIcon(reason: string): IconName {
  const r = reason.toLowerCase();
  if (r.includes('looking for') || r.includes('intention')) return 'person-outline';
  if (r.includes('love') || r.includes('hobby') || r.includes('hobbies')) return 'musical-notes-outline';
  if (r.includes('nearby') || r.includes('away') || r.includes('km')) return 'location-outline';
  if (r.includes('spot')) return 'pin-outline';
  if (r.includes('drink')) return 'wine-outline';
  if (r.includes('smok')) return 'ban-outline';
  if (r.includes('first date') || r.includes('meet')) return 'cafe-outline';
  if (r.includes('zodiac')) return 'sparkles-outline';
  return 'sparkles-outline';
}

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
          <ThemedText style={styles.reasonText}>{reason}</ThemedText>
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
