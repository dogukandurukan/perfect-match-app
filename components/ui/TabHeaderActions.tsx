// Screen: Tab header actions | Status: stable | Last updated: 2026-09-06
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

const ACCENT = '#1A1A1A';

// Premium crown used to sit here on every tab — neither Bumble nor Hinge
// keep a persistent premium icon in the global header (both keep it
// screen-contextual: Settings/Filters only, premium promoted via an
// in-content banner on Profile instead). Moved there (2026-09-06, user
// reference screenshots).
export function TabHeaderActions() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.iconBtn}
        activeOpacity={0.7}
        onPress={() => router.push('/(tabs)/profile' as Parameters<typeof router.push>[0])}
        hitSlop={8}
        accessibilityLabel="Profile">
        <Ionicons name="person-circle-outline" size={28} color={ACCENT} />
      </TouchableOpacity>
    </View>
  );
}

// Home gets its own Filters icon alongside the Profile avatar — matching
// Bumble's People screen, which keeps a filter icon right next to the
// profile avatar in its top bar (user reference screenshot, 2026-09-10).
export function HomeHeaderActions() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.iconBtn}
        activeOpacity={0.7}
        onPress={() => router.push('/filters' as Parameters<typeof router.push>[0])}
        hitSlop={8}
        accessibilityLabel="Filters">
        <Ionicons name="options-outline" size={24} color={ACCENT} />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.iconBtn}
        activeOpacity={0.7}
        onPress={() => router.push('/(tabs)/profile' as Parameters<typeof router.push>[0])}
        hitSlop={8}
        accessibilityLabel="Profile">
        <Ionicons name="person-circle-outline" size={28} color={ACCENT} />
      </TouchableOpacity>
    </View>
  );
}

// While already ON Profile, a Profile-avatar icon pointing at itself is
// pointless (same lesson as the removed HomeTopIcon) — Filters + Settings
// instead, matching Hinge's own Profile-screen header (user reference
// screenshot, 2026-09-06).
export function ProfileHeaderActions() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.iconBtn}
        activeOpacity={0.7}
        onPress={() => router.push('/filters' as Parameters<typeof router.push>[0])}
        hitSlop={8}
        accessibilityLabel="Filters">
        <Ionicons name="options-outline" size={24} color={ACCENT} />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.iconBtn}
        activeOpacity={0.7}
        onPress={() => router.push('/settings' as Parameters<typeof router.push>[0])}
        hitSlop={8}
        accessibilityLabel="Settings">
        <Ionicons name="settings-outline" size={24} color={ACCENT} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    gap: 12,
  },
  iconBtn: {
    padding: 2,
  },
});
