import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
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
}: {
  person: HingeProfilePerson;
  viewerCity: string | null;
  onNoteTarget?: (target: NoteTarget) => void;
}) {
  const age = hingeSafeAge(person.date_of_birth);
  const location = formatFeedLocation(person.district, person.city, viewerCity);
  const metaLine = [person.occupation?.trim() || null, location?.replace(/^📍\s*/, '') || null]
    .filter(Boolean)
    .join(' · ');
  const hasVerified = !!person.photo_verified;
  const hasScore = typeof person.match_percentage === 'number';

  return (
    <View style={styles.wrap}>
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

      {/* 2026-09-17: was a single flat rgba(0,0,0,0.38) band over the
          bottom 45% — read as a hard, visible dark bar (especially obvious
          on light/mid-tone photos, reported as a stark line across a
          face). Real LinearGradient now, confined to the bottom ~28%, that
          starts fully transparent at its own top — no visible seam because
          there's no opacity jump at the boundary, just a continuous fade
          to a moderate 0.5 at the very bottom for text contrast. */}
      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.08)', 'rgba(0,0,0,0.5)']}
        locations={[0, 0.5, 1]}
        style={styles.overlay}
        pointerEvents="none"
      />

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

const HERO_ASPECT = 0.78;

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: homeSpacing.lg,
    marginTop: homeSpacing.sm,
    borderRadius: homeRadius.heroPhoto,
    overflow: 'hidden',
    aspectRatio: HERO_ASPECT,
    backgroundColor: homeColors.mutedSurface,
  },
  photo: { ...StyleSheet.absoluteFillObject },
  photoFallback: { backgroundColor: homeColors.mutedSurface },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '28%',
  },
  infoBlock: {
    position: 'absolute',
    left: homeSpacing.lg,
    right: homeSpacing.lg,
    bottom: homeSpacing.lg,
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
  // Subtle text shadow (2026-09-17) — the gradient alone is tuned for a
  // "barely there" look, so this is the safety net that keeps name/location
  // readable over a bright patch of an unusually light photo.
  name: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  meta: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.92)',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});
