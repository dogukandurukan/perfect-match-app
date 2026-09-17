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

      {/* 2026-09-17 (reverted same day): tried a real LinearGradient here,
          but expo-linear-gradient is a native module and this app runs on
          an already-built dev-client — without rebuilding it, RN renders
          "Unimplemented component: <ViewManagerAdapter_ExpoLinearGradient>"
          literally on screen, which is worse than the original problem.
          User declined a rebuild for this, so: no overlay of any kind
          spanning the photo (flat or gradient) — readability now comes
          from textShadow alone on name/meta, plus a small LOCAL
          semi-transparent surface sized to the text itself (not the photo
          width) for genuinely hard cases. Package uninstalled again
          (package.json) since this was its only use. */}

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
          <View style={styles.textSurface}>
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
  // No overlay spans the photo anymore (2026-09-17, reverted gradient) —
  // textShadow below is the primary readability mechanism. This wraps just
  // the name+location text (shrink-to-fit via alignSelf, never the photo's
  // width) in a small, local semi-transparent surface as a second line of
  // defense for genuinely hard photos — self-contained, unlike a band.
  textSurface: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderRadius: 12,
    paddingHorizontal: homeSpacing.sm,
    paddingVertical: 4,
    gap: 2,
  },
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
