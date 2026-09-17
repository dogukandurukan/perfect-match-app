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

      <View style={styles.overlay} pointerEvents="none" />

      {/* Note is a floating corner action, not part of the identity text
          stack below — brief's priority order (name/age > location >
          verified+score > Note) applies to the info block, and the
          contextual-like affordance reads fine as a separate layer, the
          same way it would as a corner icon on any photo app. */}
      {onNoteTarget ? (
        <View style={styles.noteWrap}>
          <ContextualNoteButton
            target={{ type: 'photo', key: 'photo-0', label: 'this photo' }}
            onPress={onNoteTarget}
          />
        </View>
      ) : null}

      {/* Info hierarchy (2026-09-17, per real-device feedback): name/age →
          location/occupation → verified+score. Badges moved down from a
          top-corner overlay (used to risk landing on the face on some
          photo crops) into this already-scrimmed lower band, sized to
          match VerifiedBadge/MatchScoreBadge's shared small scale instead
          of dominating the card. No badge row rendered at all if the
          person is neither verified nor scored — never an empty gap. */}
      <View style={styles.infoBlock}>
        <ThemedText style={styles.name} numberOfLines={1}>
          {person.first_name ?? 'Someone'}
          {age > 0 ? `, ${age}` : ''}
        </ThemedText>
        {metaLine ? (
          <ThemedText style={styles.meta} numberOfLines={1}>
            {metaLine}
          </ThemedText>
        ) : null}
        {hasVerified || hasScore ? (
          <View style={styles.badgeRow}>
            {hasVerified ? <VerifiedBadge /> : null}
            {hasScore ? <MatchScoreBadge percentage={person.match_percentage as number} /> : null}
          </View>
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
  // Controlled gradient-like readability layer — no expo-linear-gradient
  // dependency, a single tuned flat scrim over just the lower half reads
  // fine at this photo's typical exposure range and keeps the dependency
  // surface unchanged.
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '45%',
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  noteWrap: {
    position: 'absolute',
    top: homeSpacing.md,
    right: homeSpacing.md,
  },
  infoBlock: {
    position: 'absolute',
    left: homeSpacing.lg,
    right: homeSpacing.lg,
    bottom: homeSpacing.lg,
    gap: 4,
  },
  name: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  meta: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.92)',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: homeSpacing.xs,
    marginTop: 2,
  },
});
