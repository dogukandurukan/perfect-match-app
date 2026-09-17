import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { MatchCountdown } from '@/components/matches/MatchCountdown';
import { MatchScoreBadge } from '@/components/matches/MatchScoreBadge';
import { PersonAvatar } from '@/components/matches/PersonAvatar';
import { ThemedText } from '@/components/themed-text';
import { reasonIcon } from '@/lib/matchReason';
import { homeColors, homeRadius, homeShadow, homeSpacing } from '@/lib/homeTheme';

export type ReadyCardCta =
  | { kind: 'plan'; label: string; onPress: () => void }
  | { kind: 'waiting'; label: string }
  | { kind: 'review'; label: string; onPress: () => void }
  | { kind: 'expired'; label: string };

export type ReadyItem = {
  key: string;
  userId: string;
  name: string;
  age: number;
  photoUrl: string | null;
  matchPercentage: number | null;
  /** Already resolved to display text (see lib/matchReason.ts's reasonText) — null hides the row entirely, never a placeholder. */
  reason: string | null;
  expiresAt: string | null;
  cta: ReadyCardCta;
};

/**
 * Unified Ready-tab card — the SAME visual card renders a fresh candidate
 * ("Plan a date"), a pending outgoing invite ("Waiting for {name}"), or an
 * incoming invite awaiting my response ("Review invitation"), only the
 * `cta` differs. Matches the mockup's single continuous card list instead
 * of the old two-section split (a separate "Invites for you" block above a
 * separate candidate list) — CTA state alone communicates what's needed.
 */
export function ReadyMatchCard({ item, onPress }: { item: ReadyItem; onPress: () => void }) {
  return (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.pressable}
        activeOpacity={0.85}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`View ${item.name}'s profile`}>
        <PersonAvatar photoUrl={item.photoUrl} name={item.name} size={104} radius={homeRadius.cardSmall} />
        <View style={styles.info}>
          <ThemedText style={styles.name} numberOfLines={1}>
            {item.name}
            {item.age > 0 ? `, ${item.age}` : ''}
          </ThemedText>
          {typeof item.matchPercentage === 'number' ? (
            <MatchScoreBadge percentage={item.matchPercentage} />
          ) : null}
          {item.reason ? (
            <View style={styles.reasonRow}>
              <Ionicons name={reasonIcon(item.reason)} size={13} color={homeColors.textSecondary} />
              <ThemedText style={styles.reasonText} numberOfLines={1}>
                {item.reason}
              </ThemedText>
            </View>
          ) : null}
          {item.expiresAt ? <MatchCountdown expiresAt={item.expiresAt} /> : null}
        </View>
      </TouchableOpacity>

      <CtaButton cta={item.cta} name={item.name} />
    </View>
  );
}

function CtaButton({ cta, name }: { cta: ReadyCardCta; name: string }) {
  if (cta.kind === 'waiting') {
    return (
      <View style={styles.waitingWrap} accessibilityLabel={`Waiting for ${name} to respond`}>
        <Ionicons name="hourglass-outline" size={15} color={homeColors.textSecondary} />
        <ThemedText style={styles.waitingText}>{cta.label}</ThemedText>
      </View>
    );
  }
  if (cta.kind === 'expired') {
    return (
      <View style={[styles.btn, styles.btnDisabled]}>
        <ThemedText style={styles.btnTextDisabled}>{cta.label}</ThemedText>
      </View>
    );
  }
  return (
    <TouchableOpacity
      style={[styles.btn, cta.kind === 'review' && styles.btnReview]}
      onPress={cta.onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={cta.label}>
      <ThemedText style={styles.btnText}>{cta.label}</ThemedText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: homeColors.surface,
    borderRadius: homeRadius.card,
    borderWidth: 1,
    borderColor: homeColors.border,
    padding: homeSpacing.md,
    gap: homeSpacing.md,
    ...homeShadow,
  },
  pressable: {
    flexDirection: 'row',
    gap: homeSpacing.md,
  },
  info: { flex: 1, gap: 5, justifyContent: 'center' },
  name: { fontSize: 18, fontWeight: '800', color: homeColors.textPrimary },
  reasonRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  reasonText: { flex: 1, fontSize: 13, color: homeColors.textSecondary },
  btn: {
    minHeight: 44,
    borderRadius: homeRadius.pill,
    backgroundColor: homeColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnReview: {
    backgroundColor: homeColors.textPrimary,
  },
  btnDisabled: {
    backgroundColor: homeColors.mutedSurface,
  },
  btnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  btnTextDisabled: { color: homeColors.textSecondary, fontSize: 15, fontWeight: '700' },
  waitingWrap: {
    minHeight: 44,
    borderRadius: homeRadius.pill,
    borderWidth: 1,
    borderColor: homeColors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  waitingText: { fontSize: 14.5, fontWeight: '600', color: homeColors.textSecondary },
});
