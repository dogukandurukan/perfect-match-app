import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { MatchCountdown } from '@/components/matches/MatchCountdown';
import { PersonAvatar } from '@/components/matches/PersonAvatar';
import { ThemedText } from '@/components/themed-text';
import { reasonIcon } from '@/lib/matchReason';
import { homeColors, homeRadius, homeShadow, homeSpacing } from '@/lib/homeTheme';

export type ReadyCardCta =
  | { kind: 'plan'; label: string; onPress: () => void }
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
 * Compact horizontal Ready card — Matches is a comparison list of up to 3
 * candidates, not a discovery feed, so the whole point of this layout is
 * fitting several at once (2026-09-18 V2 brief: no full-bleed photo, no
 * full-width CTA bar). Ready only ever holds fresh, never-invited
 * candidates now (see matches.tsx) — the `cta` union dropped 'waiting' and
 * 'review', which moved to Plans as `PendingPlanCard`.
 */
export function ReadyMatchCard({ item, onPress }: { item: ReadyItem; onPress: () => void }) {
  return (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.photoWrap}
        activeOpacity={0.85}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`View ${item.name}'s profile`}>
        <PersonAvatar
          photoUrl={item.photoUrl}
          name={item.name}
          size={96}
          radius={homeRadius.cardSmall}
          style={styles.photo}
        />
      </TouchableOpacity>

      <TouchableOpacity style={styles.info} activeOpacity={0.85} onPress={onPress}>
        <ThemedText style={styles.name} numberOfLines={1}>
          {item.name}
          {item.age > 0 ? `, ${item.age}` : ''}
        </ThemedText>
        {typeof item.matchPercentage === 'number' ? (
          <View style={styles.scorePill}>
            <ThemedText style={styles.scorePillText}>{Math.round(item.matchPercentage)}% match</ThemedText>
          </View>
        ) : null}
        {item.reason ? (
          <View style={styles.reasonRow}>
            <Ionicons name={reasonIcon(item.reason)} size={13} color={homeColors.textSecondary} />
            <ThemedText style={styles.reasonText} numberOfLines={2}>
              {item.reason}
            </ThemedText>
          </View>
        ) : null}

        <View style={styles.bottomRow}>
          {item.expiresAt ? <MatchCountdown expiresAt={item.expiresAt} /> : <View />}
          <CtaButton cta={item.cta} />
        </View>
      </TouchableOpacity>
    </View>
  );
}

function CtaButton({ cta }: { cta: ReadyCardCta }) {
  if (cta.kind === 'expired') {
    return (
      <View style={[styles.cta, styles.ctaDisabled]}>
        <ThemedText style={styles.ctaTextDisabled}>{cta.label}</ThemedText>
      </View>
    );
  }
  return (
    <TouchableOpacity
      style={styles.cta}
      onPress={cta.onPress}
      activeOpacity={0.85}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      accessibilityRole="button"
      accessibilityLabel={cta.label}>
      <ThemedText style={styles.ctaText}>{cta.label}</ThemedText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // Fixed height, not minHeight — `photo` below sizes itself to
  // height:'100%' of `photoWrap`, which itself stretches to `card`'s
  // height; with only a minHeight (no definite height) that chain has no
  // resolvable value to stretch against, and RN's layout engine blew the
  // photo (and the whole card) up to a runaway size on-device (found via
  // screenshot, 2026-09-18) instead of the intended ~140pt row. A definite
  // height makes every percentage resolution in this card well-defined.
  card: {
    flexDirection: 'row',
    height: 146,
    backgroundColor: homeColors.surface,
    borderRadius: homeRadius.card - 2,
    borderWidth: 1,
    borderColor: homeColors.border,
    padding: homeSpacing.sm + 2,
    gap: homeSpacing.sm + 2,
    ...homeShadow,
    // Lighter than the shared homeShadow default — this is a compact list
    // row, not a hero card.
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  photoWrap: { alignSelf: 'stretch', width: 96 },
  photo: { width: 96, height: '100%' },
  info: { flex: 1, justifyContent: 'center', gap: 5 },
  name: { fontSize: 21, fontWeight: '800', color: homeColors.textPrimary },
  scorePill: {
    alignSelf: 'flex-start',
    backgroundColor: homeColors.accentSoft,
    borderRadius: homeRadius.pill,
    paddingHorizontal: homeSpacing.sm,
    paddingVertical: 3,
  },
  scorePillText: { fontSize: 13, fontWeight: '700', color: homeColors.accent },
  reasonRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 5 },
  reasonText: { flex: 1, fontSize: 13, color: homeColors.textSecondary, lineHeight: 17 },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
    gap: homeSpacing.sm,
  },
  cta: {
    minHeight: 40,
    paddingHorizontal: homeSpacing.md,
    borderRadius: homeRadius.pill,
    backgroundColor: homeColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDisabled: { backgroundColor: homeColors.mutedSurface },
  ctaText: { color: '#FFFFFF', fontSize: 13.5, fontWeight: '700' },
  ctaTextDisabled: { color: homeColors.textSecondary, fontSize: 13.5, fontWeight: '700' },
});
