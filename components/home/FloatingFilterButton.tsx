import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, TouchableOpacity } from 'react-native';

import { homeColors } from '@/lib/homeTheme';

/**
 * Filters entry point — floats over the hero photo's top-right corner (see
 * ProfileHeroCard) instead of living in a separate header row, which no
 * longer exists on Home. 44×44 is the actual visual size here (not a
 * smaller box padded out with hitSlop) since, floating alone with nothing
 * else in its row to compete with for height, there's no "keep the row
 * short" tension to trade against the real touch-target requirement — it
 * also sits right at the top of the 40-44pt "smaller/more refined" range
 * requested for the dynamic-hero pass (2026-09-17), so it stayed put
 * rather than shrinking below the real minimum touch target.
 * Same surface/border/shadow language as DailyLikeQuota's capsule
 * (lightened together, 2026-09-17: opacity 0.15->0.10, radius 6->4).
 */
export function FloatingFilterButton() {
  const router = useRouter();
  return (
    <TouchableOpacity
      style={styles.btn}
      activeOpacity={0.7}
      onPress={() => router.push('/filters' as Parameters<typeof router.push>[0])}
      accessibilityRole="button"
      accessibilityLabel="Filters">
      <Ionicons name="options-outline" size={21} color={homeColors.textPrimary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: 'rgba(255,253,252,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(23,23,23,0.08)',
    shadowColor: '#3A2A24',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
});
