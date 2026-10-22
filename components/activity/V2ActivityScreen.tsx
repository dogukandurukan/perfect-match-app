// Real V2 Activity tab (owner-approved design 2026-10-12, D75–D80): ONE
// vertical feed from the server snapshot get_my_activity_v2 — a large photo
// card per person who liked me (like + comment = one card) and a small
// "You and X matched" row per match. A person is never both.
//
//   card  → the full V2 profile (app/v2/activity-profile.tsx); opening it is
//           the only thing that marks the like read — loading this list
//           never does; it never accepts anything.
//   row   → the existing chat (app/chat.tsx).
//
// If the server has no Activity package (the shared DEV/live project today)
// the previous Activity screen (`fallback`) is shown unchanged. A load error
// is shown as an error with retry — never as an empty list.
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { useCallback, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';

import { ACTIVITY_CARD_BORDER, ACTIVITY_SURFACE, CARD_GAP, CARD_INFO, InterestCard, MatchRow } from '@/components/activity/ActivityFeedItems';
import { buildActivityFeed, conversationStarted, loadActivity, type ActivityData } from '@/lib/activity/activityV2';
import { publishActivityBadge } from '@/lib/activity/badge';
import { interestLabelFor, MATCH_COPY, matchedLine, minutesSince, timeAgo, timeAgoLong } from '@/lib/activity/copy';
import { obColors, obFonts, obSpacing } from '@/lib/onboardingV2/theme';
import { cachedProfilePhotoUrl, preloadProfilePhotoUrls } from '@/lib/resolveProfilePhotoUrl';
import { loadMyVisits, visitsEntrySub } from '@/lib/visits/visits';

const HEADER_HEIGHT = 56;

type Load = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'unsupported' } | { kind: 'ready'; data: ActivityData };

const uri = (path: string | null | undefined) => {
  const u = cachedProfilePhotoUrl(path);
  return u ? { uri: u } : null;
};

export function V2ActivityScreen({ fallback }: { fallback: ReactNode }) {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const tabBar = useBottomTabBarHeight();
  const { height: winH } = useWindowDimensions();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [reload, setReload] = useState(0);
  // Profile visits: a separate small entry, never part of the like cards or
  // the badge (D103). null = unknown (not loaded / server without visits).
  const [visitCount, setVisitCount] = useState<number | null>(null);

  // This screen draws its own title; the old one keeps the native header.
  const unsupported = load.kind === 'unsupported';
  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: unsupported });
  }, [navigation, unsupported]);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      void loadMyVisits().then((v) => {
        if (live && v.ok && v.value.member) setVisitCount(v.value.count);
      });
      void (async () => {
        const r = await loadActivity();
        if (!live) return;
        if (r.kind === 'unsupported') return setLoad({ kind: 'unsupported' });
        // The tab badge from this same snapshot (listing never marks anything seen).
        if (r.kind === 'ok') publishActivityBadge(r.value);
        // A failed refresh keeps what is already on screen.
        if (r.kind === 'error') return setLoad((prev) => (prev.kind === 'ready' ? prev : { kind: 'error', message: r.message }));
        await preloadProfilePhotoUrls([
          ...r.value.pending.flatMap((p) => [p.photo_path, p.target_photo_path]),
          ...r.value.matches.map((m) => m.photo_path),
        ]);
        if (live) setLoad({ kind: 'ready', data: r.value });
      })();
      return () => {
        live = false;
      };
    }, [reload]),
  );

  const feed = useMemo(() => (load.kind === 'ready' ? buildActivityFeed(load.data) : []), [load]);

  if (load.kind === 'unsupported') return <>{fallback}</>;

  // About two cards fit on a normal phone; on small phones the photo gets
  // shorter, the text never does.
  const feedHeight = winH - insets.top - HEADER_HEIGHT - tabBar - obSpacing.sm;
  const photoHeight = Math.round(Math.min(300, Math.max(170, feedHeight / 2 - CARD_INFO - CARD_GAP)));
  const retry = () => {
    setLoad({ kind: 'loading' });
    setReload((n) => n + 1);
  };

  let body: ReactNode;
  if (load.kind === 'loading') {
    body = (
      <View style={styles.stateBody} accessibilityLiveRegion="polite">
        <ActivityIndicator color={obColors.cta} />
        <Text style={styles.stateText}>Loading your activity…</Text>
      </View>
    );
  } else if (load.kind === 'error') {
    body = (
      <View style={styles.stateBody} accessibilityLiveRegion="polite">
        <Ionicons name="cloud-offline-outline" size={36} color={obColors.cta} importantForAccessibility="no" />
        <Text style={styles.stateTitle} accessibilityRole="header">Couldn’t load activity</Text>
        <Text style={styles.stateText}>{load.message}</Text>
        <TouchableOpacity onPress={retry} style={styles.retry} accessibilityRole="button">
          <Text style={styles.primaryText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  } else {
    const locked = !load.data.premium && load.data.pendingCount > 0;
    body = (
      <View style={{ gap: CARD_GAP }}>
        {visitCount !== null ? (
          <TouchableOpacity
            onPress={() => router.push('/v2/profile-visits' as never)}
            style={styles.visits}
            accessibilityRole="button"
            accessibilityLabel={`Profile visits, ${visitsEntrySub(visitCount)}`}
          >
            <Ionicons name="eye-outline" size={22} color={obColors.textPrimary} importantForAccessibility="no" />
            <View style={styles.visitsText}>
              <Text style={styles.visitsTitle}>Profile visits</Text>
              <Text style={styles.visitsSub}>{visitsEntrySub(visitCount)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={obColors.textSecondary} importantForAccessibility="no" />
          </TouchableOpacity>
        ) : null}
        {locked ? (
          // Existing premium rule (as get_my_liker_cards): identities only
          // with premium; without it, a count. Not changed by this screen.
          <View style={styles.locked}>
            <Text style={styles.lockedTitle}>{load.data.pendingCount === 1 ? '1 person likes you' : `${load.data.pendingCount} people like you`}</Text>
            <TouchableOpacity onPress={() => router.push('/premium' as never)} style={styles.retry} accessibilityRole="button">
              <Text style={styles.primaryText}>See who likes you</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {feed.length === 0 && !locked ? (
          <View style={styles.stateBody}>
            <Ionicons name="heart-outline" size={36} color={obColors.cta} importantForAccessibility="no" />
            <Text style={styles.stateTitle} accessibilityRole="header">{MATCH_COPY.emptyTitle}</Text>
            <Text style={styles.stateText}>{MATCH_COPY.emptyText}</Text>
          </View>
        ) : null}
        {feed.map((f) => {
          if (f.kind === 'interest') {
            const i = f.interest;
            const name = i.first_name?.trim() || 'Someone';
            const mins = minutesSince(i.created_at);
            return (
              <InterestCard
                key={f.key}
                name={name}
                age={i.age}
                place={i.city}
                photo={uri(i.photo_path)}
                label={interestLabelFor(i.target_type)}
                time={timeAgo(mins)}
                timeLong={timeAgoLong(mins)}
                answer={i.target_type === 'prompt' ? i.target_answer : null}
                comment={i.note}
                thumb={i.target_type === 'photo' ? uri(i.target_photo_path) : null}
                unread={!i.seen}
                photoHeight={photoHeight}
                onPress={() => router.push({ pathname: '/v2/activity-profile', params: { likeId: i.like_id, userId: i.user_id } } as never)}
              />
            );
          }
          const m = f.match;
          const name = m.first_name?.trim() || 'them';
          const started = conversationStarted(m);
          const mins = minutesSince(started ? m.last_message_at : m.matched_at);
          return (
            <MatchRow
              key={f.key}
              title={m.unavailable ? 'Account unavailable' : matchedLine(name)}
              sub={started ? `Conversation started · ${timeAgoLong(mins)}` : timeAgoLong(mins)}
              photo={m.unavailable ? null : uri(m.photo_path)}
              unread={m.unread > 0}
              onPress={() => router.push({ pathname: '/chat', params: { userId: m.other_id, userName: name, matchId: m.match_id } })}
            />
          );
        })}
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.4}>Activity</Text>
      </View>
      <ScrollView contentContainerStyle={styles.feed}>{body}</ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: obColors.background },
  header: { height: HEADER_HEIGHT, flexDirection: 'row', alignItems: 'center', paddingHorizontal: obSpacing.lg + 4 },
  title: { fontFamily: obFonts.heading, fontSize: 32, lineHeight: 40, color: obColors.textPrimary },
  feed: { paddingHorizontal: obSpacing.sm + 2, paddingTop: obSpacing.xs, paddingBottom: obSpacing.xl },
  stateBody: { alignItems: 'center', gap: obSpacing.md, paddingHorizontal: obSpacing.lg, paddingVertical: obSpacing.xxl * 2 },
  stateTitle: { fontFamily: obFonts.heading, fontSize: 24, lineHeight: 31, color: obColors.textPrimary, textAlign: 'center' },
  stateText: { fontFamily: obFonts.body, fontSize: 15, lineHeight: 21, color: obColors.textSecondary, textAlign: 'center' },
  retry: { minHeight: 48, paddingHorizontal: obSpacing.xl, borderRadius: 14, backgroundColor: obColors.cta, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontFamily: obFonts.bodySemiBold, fontSize: 17, lineHeight: 22, color: obColors.onCta },
  locked: { alignItems: 'center', gap: obSpacing.md, padding: obSpacing.lg, borderRadius: 16, backgroundColor: ACTIVITY_SURFACE, borderWidth: 1, borderColor: ACTIVITY_CARD_BORDER },
  visits: { flexDirection: 'row', alignItems: 'center', gap: obSpacing.md, minHeight: 60, paddingHorizontal: obSpacing.md, paddingVertical: obSpacing.sm, borderRadius: 16, backgroundColor: ACTIVITY_SURFACE, borderWidth: 1, borderColor: ACTIVITY_CARD_BORDER },
  visitsText: { flex: 1, minWidth: 0 },
  visitsTitle: { fontFamily: obFonts.bodySemiBold, fontSize: 16, lineHeight: 21, color: obColors.textPrimary },
  visitsSub: { fontFamily: obFonts.body, fontSize: 14, lineHeight: 19, color: obColors.textSecondary },
  lockedTitle: { fontFamily: obFonts.heading, fontSize: 22, lineHeight: 29, color: obColors.textPrimary, textAlign: 'center' },
});
