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
 *
 * 2026-09-18 (V3 pass): rendered exactly ONCE by matches.tsx, as a fixed
 * sibling ABOVE whichever body (loading/error/Ready FlatList/Plans
 * SectionList) is showing — never per-branch, never a ListHeaderComponent.
 * An earlier round tried two different render paths for this (a plain
 * sibling for Ready, a SectionList ListHeaderComponent for Plans) that
 * happened to use the same padding value but were structurally different
 * (one scrolled with its list, one didn't) — a single shared instance
 * removes that divergence entirely. No horizontal padding of its own —
 * matches.tsx's `headerWrap` owns the 20pt gutter, single source.
 */
export function MatchesHeader() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingTop: insets.top + homeSpacing.sm }]}>
      <ThemedText style={styles.wordmark}>{HOME_BRAND_NAME}</ThemedText>
      <ThemedText style={styles.title}>Matches</ThemedText>
      <ThemedText style={styles.subtitle}>People you&apos;re ready to meet</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingBottom: homeSpacing.md,
    backgroundColor: homeColors.background,
  },
  wordmark: {
    fontSize: 16,
    fontWeight: '700',
    color: homeColors.accent,
  },
  // Explicit lineHeight required — ThemedText's inherited default is too
  // short for a 34px bold weight, clipping the top of ascenders/tall
  // glyphs (the exact same bug this app hit on HingeProfileCard's name
  // line, 2026-09-03/04, fixed the same way there).
  title: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    color: homeColors.textPrimary,
    marginTop: 6,
  },
  subtitle: {
    fontSize: 15.5,
    color: homeColors.textSecondary,
    marginTop: 4,
  },
});
