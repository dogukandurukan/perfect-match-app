import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { homeColors, homeRadius } from '@/lib/homeTheme';

export type MatchesTabKey = 'ready' | 'plans';

export function MatchesSegmentedControl({
  value,
  onChange,
  readyCount,
  plansCount,
}: {
  value: MatchesTabKey;
  onChange: (next: MatchesTabKey) => void;
  /** Optional counts shown as a small trailing number — omitted (not "0") when undefined, so a still-loading count doesn't flash a wrong zero. */
  readyCount?: number;
  plansCount?: number;
}) {
  return (
    <View style={styles.track} accessibilityRole="tablist">
      <Segment
        label="Ready"
        count={readyCount}
        active={value === 'ready'}
        onPress={() => onChange('ready')}
      />
      <Segment
        label="Plans"
        count={plansCount}
        active={value === 'plans'}
        onPress={() => onChange('plans')}
      />
    </View>
  );
}

function Segment({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count?: number;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.segment, active && styles.segmentActive]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={typeof count === 'number' ? `${label}, ${count}` : label}>
      <ThemedText style={[styles.label, active && styles.labelActive]}>
        {label}
        {typeof count === 'number' && count > 0 ? ` (${count})` : ''}
      </ThemedText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: homeColors.mutedSurface,
    borderRadius: homeRadius.pill,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: homeRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  segmentActive: {
    backgroundColor: homeColors.accent,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    color: homeColors.textSecondary,
  },
  labelActive: {
    color: '#FFFFFF',
  },
});
