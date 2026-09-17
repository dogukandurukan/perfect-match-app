import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ContextualNoteButton } from '@/components/home/ContextualNoteButton';
import { DailyLikeQuota } from '@/components/home/DailyLikeQuota';
import { FloatingFilterButton } from '@/components/home/FloatingFilterButton';
import { MatchScoreBadge } from '@/components/home/MatchScoreBadge';
import { VerifiedBadge } from '@/components/home/VerifiedBadge';
import type { NoteTarget } from '@/components/profile/HingeProfileCard';
import { formatFeedLocation, hingeSafeAge, type HingeProfilePerson } from '@/lib/hingeProfile';
import { homeColors, homeRadius, homeSpacing } from '@/lib/homeTheme';

export function ProfileHeroCard({
  person,
  viewerCity,
  onNoteTarget,
  likesRemaining,
  likesLimit,
  likesLoading,
}: {
  person: HingeProfilePerson;
  viewerCity: string | null;
  onNoteTarget?: (target: NoteTarget) => void;
  // 2026-09-17: the old separate header row is gone — quota + filters now
  // float directly over the hero photo (top-left/top-right), which is why
  // this card takes the quota's data as props at all. Optional: index.tsx's
  // loading/error/empty states have no photo to float over, so they render
  // a standalone FloatingFilterButton instead and never pass these.
  likesRemaining?: number;
  likesLimit?: number;
  likesLoading?: boolean;
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

      {/* 2026-09-17: the old separate header row (wordmark/quota/filter)
          is gone entirely — quota floats top-left, filter top-right,
          directly over the photo, so the hero is the first real thing on
          screen after the status bar. Only rendered when the caller
          passes quota data (the loading/error/empty states in index.tsx
          don't have a photo to float over and render their own filter-
          only control there instead). */}
      {typeof likesRemaining === 'number' && typeof likesLimit === 'number' ? (
        <View style={styles.topControls} pointerEvents="box-none">
          <DailyLikeQuota remaining={likesRemaining} limit={likesLimit} loading={!!likesLoading} />
          <FloatingFilterButton />
        </View>
      ) : null}

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

const HERO_ASPECT = 0.78;

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: homeSpacing.lg,
    // No marginTop (was homeSpacing.sm) — the "insets.top + 8-12pt" gap
    // above the hero is now entirely owned by the ScrollView's own
    // contentContainerStyle.paddingTop in index.tsx (single source, no
    // stacking) now that there's no header row handing off a margin here.
    borderRadius: homeRadius.heroPhoto,
    overflow: 'hidden',
    aspectRatio: HERO_ASPECT,
    backgroundColor: homeColors.mutedSurface,
  },
  photo: { ...StyleSheet.absoluteFillObject },
  photoFallback: { backgroundColor: homeColors.mutedSurface },
  topControls: {
    position: 'absolute',
    top: homeSpacing.lg,
    left: homeSpacing.lg,
    right: homeSpacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
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
