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
  // Single metadata line — occupation and location share one row rather
  // than competing for their own (priority order from the brief: photo >
  // name/age > verification+score > occupation/location > Note).
  const metaLine = [person.occupation?.trim() || null, location?.replace(/^📍\s*/, '') || null]
    .filter(Boolean)
    .join(' · ');

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

      <View style={styles.badgeRow}>
        {person.photo_verified ? <VerifiedBadge /> : <View />}
        {typeof person.match_percentage === 'number' ? (
          <MatchScoreBadge percentage={person.match_percentage} />
        ) : null}
      </View>

      <View style={styles.infoBlock}>
        <View style={styles.nameRow}>
          <ThemedText style={styles.name} numberOfLines={1}>
            {person.first_name ?? 'Someone'}
            {age > 0 ? `, ${age}` : ''}
          </ThemedText>
          {onNoteTarget ? (
            <ContextualNoteButton
              target={{ type: 'photo', key: 'photo-0', label: 'this photo' }}
              onPress={onNoteTarget}
            />
          ) : null}
        </View>
        {metaLine ? (
          <ThemedText style={styles.meta} numberOfLines={1}>
            {metaLine}
          </ThemedText>
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
  badgeRow: {
    position: 'absolute',
    top: homeSpacing.md,
    left: homeSpacing.md,
    right: homeSpacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoBlock: {
    position: 'absolute',
    left: homeSpacing.lg,
    right: homeSpacing.lg,
    bottom: homeSpacing.lg,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: homeSpacing.sm,
  },
  name: {
    flex: 1,
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  meta: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.92)',
  },
});
