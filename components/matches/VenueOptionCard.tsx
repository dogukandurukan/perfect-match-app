import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { homeColors, homeRadius, homeSpacing } from '@/lib/homeTheme';

export type VenueReason = 'both' | 'you' | 'them' | null;

function reasonLabel(reason: VenueReason, otherName: string): string | null {
  if (reason === 'both') return 'Near both of you';
  if (reason === 'you') return 'Near you';
  if (reason === 'them') return `Near ${otherName}`;
  return null;
}

/**
 * Selectable venue row — no venue images (the `venues` table has no image
 * URL column, confirmed by schema inspection before building this; per the
 * brief, a missing real image means a consistent outline icon, never a
 * fabricated/stock photo). No distance/walking-time either — `venues` has
 * no lat/lng, so that field is genuinely unavailable rather than omitted by
 * choice; only the district + real "near who" reason (already computed by
 * the existing pickVenues() matching logic) are shown.
 */
export function VenueOptionCard({
  name,
  district,
  reason,
  otherName,
  selected,
  onPress,
}: {
  name: string;
  district: string | null;
  reason: VenueReason;
  otherName: string;
  selected: boolean;
  onPress: () => void;
}) {
  const reasonText = reasonLabel(reason, otherName);
  return (
    <TouchableOpacity
      style={[styles.row, selected && styles.rowSelected]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="radio"
      accessibilityLabel={`${name}${district ? `, ${district}` : ''}`}
      accessibilityState={{ selected }}>
      <View style={styles.iconWrap}>
        <Ionicons name="cafe-outline" size={20} color={homeColors.accent} />
      </View>
      <View style={styles.info}>
        <ThemedText style={styles.name} numberOfLines={1}>
          {name}
        </ThemedText>
        {district ? (
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={12} color={homeColors.textSecondary} />
            <ThemedText style={styles.meta}>{district}</ThemedText>
          </View>
        ) : null}
        {reasonText ? (
          <ThemedText style={styles.reason} numberOfLines={1}>
            {reasonText}
          </ThemedText>
        ) : null}
      </View>
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected ? <View style={styles.radioDot} /> : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: homeSpacing.sm + 2,
    backgroundColor: homeColors.surface,
    borderRadius: homeRadius.cardSmall,
    borderWidth: 1.5,
    borderColor: homeColors.border,
    padding: homeSpacing.sm + 2,
    minHeight: 44,
  },
  rowSelected: { borderColor: homeColors.accent, backgroundColor: homeColors.accentSoft },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: homeRadius.cardSmall - 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: homeColors.mutedSurface,
  },
  info: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontWeight: '700', color: homeColors.textPrimary },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  meta: { fontSize: 12.5, color: homeColors.textSecondary },
  reason: { fontSize: 12, color: homeColors.accent, fontWeight: '600' },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: homeColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: homeColors.accent },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: homeColors.accent },
});
