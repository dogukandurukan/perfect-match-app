// DEV-only: always shows which backend this app is talking to
// ("TEST · <project ref>" / "LIVE · <project ref>"), on every screen, so a
// phone test can never be mistaken for the other environment.
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { backend } from '@/lib/supabaseClient';

export function DevBackendBadge() {
  const insets = useSafeAreaInsets();
  if (!__DEV__) return null;
  const isLive = backend.env === 'live';
  const isDev = backend.env === 'dev';
  return (
    <View pointerEvents="none" style={[styles.wrap, { bottom: Math.max(insets.bottom - 16, 2) }]}>
      <Text
        style={[styles.text, isLive ? styles.live : isDev ? styles.dev : backend.env === 'local' ? styles.local : styles.test]}
        accessibilityLabel={`Backend ${backend.env}, project ${backend.projectRef}`}
      >
        {`${backend.env.toUpperCase()} · ${backend.projectRef}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Bottom-left, inside the home-indicator inset: never over a screen title,
  // the tab labels or a primary button.
  wrap: { position: 'absolute', left: 8, alignItems: 'flex-start', zIndex: 9999, elevation: 9999, opacity: 0.85 },
  text: { fontSize: 10, lineHeight: 13, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, overflow: 'hidden' },
  live: { backgroundColor: '#B3261E', color: '#FFFFFF' },
  test: { backgroundColor: '#1F6F43', color: '#FFFFFF' },
  dev: { backgroundColor: '#8A5A00', color: '#FFFFFF' },
  local: { backgroundColor: '#1F4E8A', color: '#FFFFFF' },
});
