import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { homeColors } from '@/lib/homeTheme';

/**
 * `new Date(iso).getTime() - Date.now()` is timezone-safe by construction —
 * both sides are absolute UTC instants (epoch ms), there's no local-calendar
 * math here to get wrong across timezones/DST.
 */
function computeLabel(expiresAtIso: string): { label: string; expired: boolean } {
  const diffMs = new Date(expiresAtIso).getTime() - Date.now();
  if (diffMs <= 0) return { label: 'Expired', expired: true };

  const totalMinutes = Math.floor(diffMs / 60_000);
  const totalHours = Math.floor(diffMs / 3_600_000);
  const totalDays = Math.floor(diffMs / 86_400_000);

  if (totalDays >= 1) {
    return { label: totalDays === 1 ? '1 day left' : `${totalDays} days left`, expired: false };
  }
  if (totalHours >= 1) {
    return { label: `${totalHours}h left`, expired: false };
  }
  return { label: `${Math.max(1, totalMinutes)}m left`, expired: false };
}

/**
 * Real countdown from `matches.expires_at`, updated every minute (interval
 * cleaned up on unmount) — never a hardcoded value. Outline clock icon per
 * the brief ("kum saati emojisi kullanma").
 */
export function MatchCountdown({
  expiresAt,
  onExpire,
}: {
  expiresAt: string;
  /** Called once, the first time this instance observes the countdown cross into expired. */
  onExpire?: () => void;
}) {
  const [state, setState] = useState(() => computeLabel(expiresAt));

  useEffect(() => {
    setState(computeLabel(expiresAt));
    const id = setInterval(() => {
      setState((prev) => {
        const next = computeLabel(expiresAt);
        if (next.expired && !prev.expired) onExpire?.();
        return next;
      });
    }, 60_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiresAt]);

  return (
    <View style={styles.row}>
      <Ionicons
        name="time-outline"
        size={13}
        color={state.expired ? homeColors.textSecondary : homeColors.accent}
      />
      <ThemedText style={[styles.text, state.expired && styles.textExpired]}>
        {state.label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  text: { fontSize: 12.5, fontWeight: '600', color: homeColors.accent },
  textExpired: { color: homeColors.textSecondary },
});
