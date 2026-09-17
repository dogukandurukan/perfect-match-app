import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ContextualNoteButton } from '@/components/home/ContextualNoteButton';
import { MatchScoreBadge } from '@/components/home/MatchScoreBadge';
import { VerifiedBadge } from '@/components/home/VerifiedBadge';
import type { NoteTarget } from '@/components/profile/HingeProfileCard';
import { formatFeedLocation, hingeSafeAge, type HingeProfilePerson } from '@/lib/hingeProfile';
import { homeColors, homeRadius, homeSpacing } from '@/lib/homeTheme';

export function ProfileHeroCard({
  person,
  viewerCity,
  onNoteTarget,
  heroHeight,
}: {
  person: HingeProfilePerson;
  viewerCity: string | null;
  onNoteTarget?: (target: NoteTarget) => void;
  // 2026-09-17: computed by the caller from real viewport/inset/tab-bar
  // values (index.tsx) so the hero fills the first viewport instead of a
  // fixed aspect ratio that left "Why you match" visible on load. Kept as
  // a plain number prop (not hooks in here) so this component doesn't need
  // to know about navigation/safe-area context itself.
  heroHeight: number;
}) {
  const age = hingeSafeAge(person.date_of_birth);
  const location = formatFeedLocation(person.district, person.city, viewerCity);
  const metaLine = [person.occupation?.trim() || null, location?.replace(/^📍\s*/, '') || null]
    .filter(Boolean)
    .join(' · ');
  const hasVerified = !!person.photo_verified;
  const hasScore = typeof person.match_percentage === 'number';

  return (
    <View style={[styles.wrap, { height: heroHeight }]}>
      {person.photoUrls[0] ? (
        <Image
          source={{ uri: person.photoUrls[0] }}
          style={styles.photo}
          contentFit="cover"
          contentPosition="top"
          transition={150}
        />
      ) : (
        <View style={[styles.photo, styles.photoFallback]} />
      )}

      {/* 2026-09-17: quota + filter no longer float on the hero photo at
          all — they moved back into HomeHeader's persistent utility bar
          above the hero (Bumble reference: a slim always-visible top bar,
          not controls floating on the photo itself). The photo's top is
          now clean. */}

      {/* 2026-09-17: tried a real LinearGradient here, but expo-linear-
          gradient is a native module and this app runs on an already-built
          dev-client — without rebuilding it, RN renders "Unimplemented
          component: <ViewManagerAdapter_ExpoLinearGradient>" literally on
          screen. Reverted (package uninstalled too). Next tried a small
          local semi-transparent surface behind just the name/location text
          — still read as a visible box/shading on real photos, also
          reverted. There is now NO overlay, surface, or band of any kind
          over the photo — textShadow on name/meta (below) is the only
          readability mechanism. */}

      {/* 2026-09-17: info row — text column (badges pretitle → name/age →
          location/occupation) on the left, Note as a bottom-right action
          balanced against it on the right, both bottom-aligned. Replaces
          the previous top-right-corner Note placement (risked landing over
          the main photo subject) and the previous badges-after-meta order
          (brief now wants badges immediately before/above the name). Row
          layout (not two independently-positioned absolute elements) is
          what actually reserves space for Note so a long name/location
          truncates instead of rendering underneath it. */}
      <View style={styles.infoBlock}>
        <View style={styles.textColumn}>
          {hasVerified || hasScore ? (
            <View style={styles.badgeRow}>
              {hasVerified ? <VerifiedBadge /> : null}
              {hasScore ? <MatchScoreBadge percentage={person.match_percentage as number} /> : null}
            </View>
          ) : null}
          <ThemedText style={styles.name} numberOfLines={1}>
            {person.first_name ?? 'Someone'}
            {age > 0 ? `, ${age}` : ''}
          </ThemedText>
          {metaLine ? (
            <ThemedText style={styles.meta} numberOfLines={1}>
              {metaLine}
            </ThemedText>
          ) : null}
        </View>
        {onNoteTarget ? (
          <ContextualNoteButton
            target={{ type: 'photo', key: 'photo-0', label: 'this photo' }}
            onPress={onNoteTarget}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: homeSpacing.lg,
    // No marginTop — the gap above the hero (HomeHeader → hero) is entirely
    // owned by the ScrollView's own contentContainerStyle.paddingTop in
    // index.tsx (single source, no stacking with a margin here).
    // 2026-09-17: height is now a per-instance inline style (see the
    // `heroHeight` prop above) computed by the caller from real viewport/
    // inset/tab-bar values, replacing a fixed aspectRatio that left "Why
    // you match" visible on load instead of the hero filling the screen.
    borderRadius: homeRadius.heroPhoto,
    overflow: 'hidden',
    backgroundColor: homeColors.mutedSurface,
  },
  photo: { ...StyleSheet.absoluteFillObject },
  photoFallback: { backgroundColor: homeColors.mutedSurface },
  infoBlock: {
    position: 'absolute',
    left: homeSpacing.lg,
    right: homeSpacing.lg,
    // 2026-09-17: bumped from homeSpacing.lg (16pt) to homeSpacing.xl
    // (20pt) — brief asked for ~20-24pt clearance from the hero's real
    // bottom edge now that the card is taller.
    bottom: homeSpacing.xl,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: homeSpacing.sm,
  },
  textColumn: { flex: 1, gap: 4 },
  badgeRow: {
    flexDirection: 'row',
    gap: 4,
  },
  // No overlay or surface behind the text at all (2026-09-17, twice reverted
  // now) — the earlier "small local surface" still read as a visible box/
  // shading right above the name on real photos. textShadow alone is the
  // only readability mechanism left.
  name: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  meta: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.92)',
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
});
