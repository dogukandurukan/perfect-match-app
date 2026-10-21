// Chat list header while older history exists: a quiet "Earlier messages"
// button (also loads when the reader scrolls near the top), a small spinner
// while a page loads, and a plain error with "Try again" that keeps the
// history already on screen. Shown instead of the "How it started" card until
// the start of the conversation is loaded (the card belongs there, once).
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import type { OlderState } from '@/lib/chat/sync';
import { obColors, obFonts } from '@/lib/onboardingV2/theme';

export function OlderHistoryHeader({ state, onLoad }: { state: OlderState; onLoad: () => void }) {
  if (state.loading) {
    return (
      <View style={styles.wrap} accessible accessibilityLabel="Loading earlier messages" accessibilityLiveRegion="polite">
        <ActivityIndicator color={obColors.textSecondary} />
      </View>
    );
  }
  if (state.error) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.error} accessibilityLiveRegion="polite">
          Couldn’t load earlier messages.
        </Text>
        <Pressable onPress={onLoad} hitSlop={8} style={styles.btn} accessibilityRole="button" accessibilityLabel="Try again to load earlier messages">
          <Text style={styles.btnText}>Try again</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <View style={styles.wrap}>
      <Pressable onPress={onLoad} hitSlop={8} style={styles.btn} accessibilityRole="button" accessibilityLabel="Load earlier messages">
        <Text style={styles.btnText}>Earlier messages</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { minHeight: 44, alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 6 },
  error: { fontFamily: obFonts.body, fontSize: 13, lineHeight: 18, color: obColors.textSecondary },
  btn: { minHeight: 32, paddingHorizontal: 12, justifyContent: 'center' },
  btnText: { fontFamily: obFonts.bodyMedium, fontSize: 13, lineHeight: 18, color: obColors.cta },
});
