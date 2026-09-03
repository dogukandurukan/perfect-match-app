import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

// Bumble's real bottom bar keeps the bar itself plain white — the active
// tab's icon is just solid-filled + black, nudged up a couple pixels, no
// background block. A dark pill behind the icon (tried first) squeezed the
// tab bar's fixed layout and made the label text underneath disappear
// (user feedback, 2026-09-03, with a Bumble screenshot for reference).
export function ActiveTabIcon({ focused, children }: { focused: boolean; children: ReactNode }) {
  return <View style={[styles.wrap, focused && styles.wrapActive]}>{children}</View>;
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  wrapActive: {
    transform: [{ translateY: -2 }],
  },
});
