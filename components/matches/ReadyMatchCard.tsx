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
 *
 * 2026-09-18 (devam) — `height` is now a real prop, computed by the caller
 * from an `onLayout`-measured available area (not a guessed constant): a
 * fixed compile-time height can't adapt to how much room the device
 * actually has, which is what made "3 cards fit densely" a matter of luck
 * rather than a guarantee. `photo`'s `height:'100%'` still resolves
 * against this real number, same fix as before, just prop-driven now.
 */
export function ReadyMatchCard({
  item,
  height,
  onPress,
}: {
  item: ReadyItem;
  height: number;
  onPress: () => void;
}) {
  return (
    <View style={[styles.card, { height }]}>
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
            <View style={styles.reasonIconWrap}>
              <Ionicons name={reasonIcon(item.reason)} size={17} color={homeColors.textSecondary} />
            </View>
            <ThemedText style={styles.reasonText} numberOfLines={2} ellipsizeMode="tail">
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
  // `height` comes from the `height` prop (inline, merged below) — not a
  // minHeight. `photo`'s height:'100%' resolves against `photoWrap`, which
  // stretches to `card`'s height; without a DEFINITE height that chain has
  // nothing concrete to resolve against, and RN's layout engine once blew
  // the photo (and the whole card) up to a runaway size on-device because
  // of exactly this (found via screenshot, 2026-09-18). A real number here
  // (whatever the caller computes) keeps that resolution well-defined.
  card: {
    flexDirection: 'row',
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
  // Explicit lineHeight (same fix as MatchesHeader's title / PersonAvatar's
  // initial) — ThemedText's inherited default lineHeight (24) is tight
  // enough at 21px bold that ascenders/descenders could clip on some
  // devices; a real value removes the ambiguity instead of relying on the
  // default happening to be just barely enough.
  name: { fontSize: 21, lineHeight: 26, fontWeight: '800', color: homeColors.textPrimary },
  scorePill: {
    alignSelf: 'flex-start',
    backgroundColor: homeColors.accentSoft,
    borderRadius: homeRadius.pill,
    paddingHorizontal: homeSpacing.sm,
    paddingVertical: 3,
  },
  // Explicit lineHeight — same class of bug as `name` above: without it,
  // ThemedText's default (24) made this small pill render taller than its
  // 13pt text needed, quietly eating into this card's tight fixed-height
  // budget.
  scorePillText: { fontSize: 13, lineHeight: 16, fontWeight: '700', color: homeColors.accent },
  // alignItems:'flex-start' (not 'center') — with numberOfLines={2} now
  // allowed, centering the icon against a two-line block put it at an odd
  // mid-height instead of level with the first line (2026-09-18 brief).
  reasonRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  // Nudges the icon down to align with the reason text's cap-height/first
  // line instead of its own glyph box top, which sits a couple px higher.
  reasonIconWrap: { paddingTop: 1 },
  // No width/maxWidth — `flex:1` already lets this take the full remaining
  // row width next to the icon (2026-09-18: confirmed no other constraint
  // was forcing the earlier single-line truncation; numberOfLines was the
  // only thing capping it, now 2 instead of 1).
  reasonText: { flex: 1, fontSize: 14.5, lineHeight: 20, fontWeight: '500', color: homeColors.textSecondary },
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
  ctaText: { color: '#FFFFFF', fontSize: 13.5, lineHeight: 17, fontWeight: '700' },
  ctaTextDisabled: { color: homeColors.textSecondary, fontSize: 13.5, lineHeight: 17, fontWeight: '700' },
});
