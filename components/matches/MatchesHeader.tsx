import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { HOME_BRAND_NAME, homeColors, homeSpacing } from '@/lib/homeTheme';

/**
 * Safe-area-aware header: wordmark → big screen title → subtitle. Reuses
 * Home's "tempa" wordmark constant and Warm Editorial color tokens
 * (lib/homeTheme.ts) rather than hardcoding the same hex values again — no
 * new token file, matches the mockup's palette exactly since it's the same
 * system as Home's redesign.
 */
export function MatchesHeader() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingTop: insets.top + homeSpacing.md }]}>
      <ThemedText style={styles.wordmark}>{HOME_BRAND_NAME}</ThemedText>
      <ThemedText style={styles.title}>Matches</ThemedText>
      <ThemedText style={styles.subtitle}>People you&apos;re ready to meet</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: homeSpacing.lg,
    paddingBottom: homeSpacing.md,
    backgroundColor: homeColors.background,
  },
  wordmark: {
    fontSize: 15,
    fontWeight: '700',
    color: homeColors.textSecondary,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: homeColors.textPrimary,
    marginTop: 2,
  },
  subtitle: {
    fontSize: 14.5,
    color: homeColors.textSecondary,
    marginTop: 2,
  },
});
