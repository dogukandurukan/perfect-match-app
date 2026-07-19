import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { colors } from '@/lib/designTokens';
import { formatDailyResetCountdown, msUntilReset } from '@/lib/dailyViews';

const ACCENT = '#B8860B';

type DailyLimitEmptyStateProps = {
  resetAt: string;
};

export function DailyLimitEmptyState({ resetAt }: DailyLimitEmptyStateProps) {
  const [countdown, setCountdown] = useState(() =>
    formatDailyResetCountdown(msUntilReset(resetAt)),
  );

  useEffect(() => {
    const update = () => setCountdown(formatDailyResetCountdown(msUntilReset(resetAt)));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [resetAt]);

  return (
    <View style={styles.wrap}>
      <ThemedText style={styles.title}>That&apos;s everyone for today 🌙</ThemedText>
      <ThemedText style={styles.subtitle}>Come back tomorrow for new faces</ThemedText>
      <ThemedText style={styles.countdown}>New people in {countdown}</ThemedText>
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
});
