import { useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { colors } from '@/lib/designTokens';
import {
  DAILY_VIEW_LIMIT_PREMIUM,
  formatDailyResetCountdown,
  msUntilReset,
} from '@/lib/dailyViews';

const ACCENT = '#1A1A1A';

type DailyLimitEmptyStateProps = {
  resetAt: string;
  /** Today's actual cap (5 free / 10 premium) — upsell only shows below the
   * premium cap, so an already-premium user doesn't see a pointless CTA. */
  limit: number;
};

export function DailyLimitEmptyState({ resetAt, limit }: DailyLimitEmptyStateProps) {
  const router = useRouter();
  const [countdown, setCountdown] = useState(() =>
    formatDailyResetCountdown(msUntilReset(resetAt)),
  );

  useEffect(() => {
    const update = () => setCountdown(formatDailyResetCountdown(msUntilReset(resetAt)));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [resetAt]);

  const showUpsell = limit < DAILY_VIEW_LIMIT_PREMIUM;

  return (
    <View style={styles.wrap}>
      <ThemedText style={styles.title}>That&apos;s everyone for today 🌙</ThemedText>
      <ThemedText style={styles.subtitle}>Come back tomorrow for new faces</ThemedText>
      <ThemedText style={styles.countdown}>New people in {countdown}</ThemedText>

      {showUpsell ? (
        <TouchableOpacity
          style={styles.upsellCard}
          activeOpacity={0.9}
          onPress={() => router.push('/premium' as never)}
          accessibilityRole="button"
          accessibilityLabel={`Go Premium for up to ${DAILY_VIEW_LIMIT_PREMIUM} likes a day`}>
          <ThemedText style={styles.upsellTitle}>Go Premium ✨</ThemedText>
          <ThemedText style={styles.upsellText}>
            Get up to {DAILY_VIEW_LIMIT_PREMIUM} likes a day instead of {limit}
          </ThemedText>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 22,
  },
  countdown: {
    fontSize: 14,
    color: ACCENT,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  upsellCard: {
    marginTop: 20,
    backgroundColor: ACCENT,
    borderRadius: 16,
    paddingHorizontal: 22,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 4,
  },
  upsellTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  upsellText: { fontSize: 13, color: '#EDEDED', textAlign: 'center' },
});
