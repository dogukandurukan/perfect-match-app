import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, TouchableOpacity } from 'react-native';

import { homeColors } from '@/lib/homeTheme';

// Real 44x44 touch target via hitSlop, not visual padding — the brief
// explicitly wants no visible circular background, so the touch area can't
// come from a large visible box anymore.
const HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 };

/**
 * Filters entry point — lives inline in HomeHeader's utility cluster
 * (2026-09-17: was a standalone floating button over the hero photo, then a
 * fixed-size 44×44 circle; both retired — Bumble reference wants a plain
 * icon sitting directly in the persistent top bar, no button chrome at
 * all). Renamed from FloatingFilterButton since "floating" no longer
 * describes it — it's a normal inline header control now.
 */
export function HeaderFilterButton() {
  const router = useRouter();
  return (
    <TouchableOpacity
      style={styles.btn}
      activeOpacity={0.6}
      hitSlop={HIT_SLOP}
      onPress={() => router.push('/filters' as Parameters<typeof router.push>[0])}
      accessibilityRole="button"
      accessibilityLabel="Filters">
      <Ionicons name="options-outline" size={25} color={homeColors.textPrimary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
