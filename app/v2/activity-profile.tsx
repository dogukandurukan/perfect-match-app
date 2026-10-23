// The full V2 profile opened from an Activity card (D78): the shared Discover
// layout, read-only, with the liked content + comment right after the main
// photo, and ONE action:
//   • pending interest → "Match & chat": accept_like_v2 on the server, then the
//     existing chat opens directly (nothing is sent, no celebration screen);
//   • already matched   → "Open chat".
// Opening this screen marks THIS like read (mark_like_seen_v2) and nothing
// else; going back creates nothing. A failed / unanswered Match & chat never
// looks matched: an inline error, the same button retries (the server returns
// the same match for a repeat).
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSharedMarks } from '@/lib/interests/useSharedMarks';
import { ACTIVITY_CARD_BORDER, InterestContext } from '@/components/activity/ActivityFeedItems';
import { DiscoverProfileItems, type ItemHandlers } from '@/components/discover/DiscoverProfileItems';
import { acceptErrorText, acceptLike, loadActivity, markLikeSeen, type ActivityInterest } from '@/lib/activity/activityV2';
import { activityBadge } from '@/lib/activity/badge';
import { VisitsNotice } from '@/components/visits/VisitsNotice';
import { useProfileVisit } from '@/hooks/useProfileVisit';
import { interestLabelFor, MATCH_COPY } from '@/lib/activity/copy';
import { loadRealProfile, type RealProfile } from '@/lib/discover/discoverV2';
import { buildDiscoverLayout, STATE_COPY } from '@/lib/discover/profileLayout';
import type { MyMatch } from '@/lib/matchChatV2';
import { obColors, obFonts, obSpacing } from '@/lib/onboardingV2/theme';
import { cachedProfilePhotoUrl, preloadProfilePhotoUrls } from '@/lib/resolveProfilePhotoUrl';

type Load = 'loading' | 'error' | 'unavailable' | 'ready';
const noop = () => {};

export default function ActivityProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { likeId: likeParam, userId: userParam } = useLocalSearchParams<{ likeId?: string; userId?: string }>();
  const likeId = String(likeParam ?? '');
  const userId = String(userParam ?? '');

  const [load, setLoad] = useState<Load>('loading');
  const { recordVisit, notice: visitNotice } = useProfileVisit();
  const [reload, setReload] = useState(0);
  const [profile, setProfile] = useState<RealProfile | null>(null);
  const [interest, setInterest] = useState<ActivityInterest | null>(null);
  const [match, setMatch] = useState<MyMatch | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const markedRef = useRef(false);

  useEffect(() => {
    let live = true;
    setLoad('loading');
    void (async () => {
      try {
        const [p, a] = await Promise.all([loadRealProfile(userId), loadActivity()]);
        if (!live) return;
        if (a.kind !== 'ok') return setLoad('error');
        if (!p) return setLoad('unavailable');
        const i = a.value.pending.find((x) => x.like_id === likeId && x.user_id === userId) ?? null;
        const m = a.value.matches.find((x) => x.other_id === userId) ?? null;
        await preloadProfilePhotoUrls([i?.target_photo_path]);
        if (!live) return;
        setProfile(p);
        setInterest(i);
        setMatch(m);
        setLoad('ready');
        recordVisit(userId); // the full profile really loaded → a profile visit (D103)
        // Viewing ≠ accepting: only this like is marked read, once.
        if (i && !i.seen && !markedRef.current) {
          markedRef.current = true;
          // Opened → seen on the server, then the tab badge follows the server.
          void markLikeSeen(i.like_id).then((ok) => {
            if (ok) void activityBadge.refresh();
          });
        }
      } catch (e) {
        console.warn('[ActivityProfile] load failed', e);
        if (live) setLoad('error');
      }
    })();
    return () => {
      live = false;
    };
  }, [likeId, userId, reload]);

  const person = profile?.person ?? null;
  const shared = useSharedMarks(person);
  const name = person?.name || interest?.first_name || 'them';
  const items = useMemo(() => (person ? buildDiscoverLayout(person) : []), [person]);

  const openChat = useCallback(
    (matchId: string) => router.replace({ pathname: '/chat', params: { userId, userName: name, matchId } }),
    [router, userId, name],
  );

  const matchAndChat = useCallback(async () => {
    if (match) return openChat(match.match_id);
    if (!interest || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    const r = await acceptLike(interest.like_id);
    busyRef.current = false;
    setBusy(false);
    if (r.kind === 'ok') {
      void activityBadge.refresh(); // no longer pending
      return openChat(r.matchId);
    }
    setError(acceptErrorText(r, name));
  }, [interest, match, name, openChat]);

  const handlers: ItemHandlers | null =
    person && profile
      ? {
          person,
          photoSource: (i) => (profile.photoUrls[i] ? { uri: profile.photoUrls[i] } : null),
          heroHeight: Math.max(340, Math.round(height * 0.56)),
          editor: null,
          canLike: false,
          liked: false,
          sent: null,
          readOnly: true,
          shared,
          onLike: noop,
          onOpenComment: noop,
          onEditComment: noop,
          onCancelComment: noop,
          onSendComment: noop,
          onEditorResize: noop,
          editorRef: noop,
        }
      : null;

  const thumbUrl = interest?.target_type === 'photo' ? cachedProfilePhotoUrl(interest.target_photo_path) : null;
  const canAct = !!match || !!interest;
  const title = person ? (person.age ? `${person.name}, ${person.age}` : person.name) : '';

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.subHeader}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back to Activity" style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={26} color={obColors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.subTitle} numberOfLines={1} accessibilityRole="header">{title}</Text>
        <View style={styles.iconBtn} />
      </View>
      <VisitsNotice state={visitNotice} />
      {load === 'loading' ? (
        <View style={styles.center}>
          <ActivityIndicator color={obColors.cta} accessibilityLabel="Loading profile" />
        </View>
      ) : load === 'error' ? (
        <View style={styles.center}>
          <Text style={styles.stateText}>{STATE_COPY.errorText}</Text>
          <TouchableOpacity onPress={() => setReload((n) => n + 1)} style={styles.primary} accessibilityRole="button">
            <Text style={styles.primaryText}>{STATE_COPY.retry}</Text>
          </TouchableOpacity>
        </View>
      ) : load === 'unavailable' || !handlers ? (
        <View style={styles.center}>
          <Text style={styles.stateText}>This profile isn’t available.</Text>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={{ paddingBottom: obSpacing.xl }}>
            <DiscoverProfileItems items={items.slice(0, 1)} h={handlers} />
            {interest ? (
              <InterestContext
                label={interestLabelFor(interest.target_type)}
                answer={interest.target_type === 'prompt' ? interest.target_answer : null}
                comment={interest.note}
                thumb={thumbUrl ? { uri: thumbUrl } : null}
                a11y={`${name} ${interestLabelFor(interest.target_type).replace('Liked', 'liked')}${interest.note ? `: ${interest.note}` : ''}`}
              />
            ) : null}
            <DiscoverProfileItems items={items.slice(1)} h={handlers} />
          </ScrollView>
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, obSpacing.md) }]}>
            {error ? (
              <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">{error}</Text>
            ) : null}
            {canAct ? (
              <>
                <TouchableOpacity
                  onPress={() => void matchAndChat()}
                  disabled={busy}
                  style={[styles.primary, busy && { opacity: 0.85 }]}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: busy, busy }}
                  accessibilityLabel={match ? `${MATCH_COPY.open} with ${name}` : `${MATCH_COPY.cta} with ${name}`}>
                  {busy ? <ActivityIndicator color={obColors.onCta} /> : <Text style={styles.primaryText}>{match ? MATCH_COPY.open : MATCH_COPY.cta}</Text>}
                </TouchableOpacity>
                {!match ? <Text style={styles.caption}>{MATCH_COPY.caption(name)}</Text> : null}
              </>
            ) : (
              <Text style={styles.caption}>{`This like from ${name} isn’t available anymore.`}</Text>
            )}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: obColors.background },
  subHeader: { minHeight: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: obSpacing.sm },
  iconBtn: { width: 48, height: 44, alignItems: 'center', justifyContent: 'center' },
  subTitle: { flex: 1, textAlign: 'center', fontFamily: obFonts.heading, fontSize: 22, lineHeight: 29, color: obColors.textPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: obSpacing.md, padding: obSpacing.gutter },
  stateText: { fontFamily: obFonts.body, fontSize: 16, lineHeight: 22, color: obColors.textPrimary, textAlign: 'center' },
  footer: { paddingHorizontal: obSpacing.lg, paddingTop: obSpacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ACTIVITY_CARD_BORDER, backgroundColor: obColors.background },
  primary: { minHeight: 52, paddingHorizontal: obSpacing.xl, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: obColors.cta },
  primaryText: { fontFamily: obFonts.bodySemiBold, fontSize: 17, lineHeight: 22, color: obColors.onCta },
  caption: { fontFamily: obFonts.body, fontSize: 13, lineHeight: 18, color: obColors.textSecondary, textAlign: 'center', marginTop: obSpacing.sm },
  error: { fontFamily: obFonts.body, fontSize: 14, lineHeight: 19, color: obColors.error, textAlign: 'center', marginBottom: obSpacing.sm },
});
