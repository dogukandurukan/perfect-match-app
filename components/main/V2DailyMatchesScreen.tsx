// Real V2 Matches (approved 3-screen design, D61–D66): two featured cards
// from the SERVER-owned daily picks — "Picked for you" and "You both
// liked". The period (12:00 Istanbul), the people and their live state come
// from get_daily_picks_v2; the app never picks, refreshes or reads the device
// clock for this. Other matches stay in Chats; date suggestions (former
// Plans) live inside each chat.
//
// If the server doesn't have daily picks yet (the 2026-10-09 package is not
// applied there), the previous V2 Matches list is shown unchanged.
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { V2MatchesScreen } from '@/components/main/V2MatchesScreen';
import {
  EmptyCard,
  MatchesTitle,
  PersonCard,
  SayHelloButton,
  SectionHead,
  StartedBox,
  StatusLine,
  ViewProfileButton,
} from '@/components/matches/v2/DailyMatchCards';
import { MATCHES_COPY as C } from '@/lib/matches/copy';
import { loadDailyPicks, mutualEmptyKind, type DailyCard, type DailyPicks } from '@/lib/matches/dailyPicksV2';
import { obColors, obFonts, obSpacing } from '@/lib/onboardingV2/theme';
import { preloadProfilePhotoUrls, cachedProfilePhotoUrl } from '@/lib/resolveProfilePhotoUrl';

type Load = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'unsupported' } | { kind: 'ready'; data: DailyPicks };

export function V2DailyMatchesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [reload, setReload] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      void (async () => {
        const r = await loadDailyPicks();
        if (!live) return;
        if (r.kind === 'unsupported') return setLoad({ kind: 'unsupported' });
        if (r.kind === 'error') return setLoad((prev) => (prev.kind === 'ready' ? prev : { kind: 'error', message: r.message }));
        await preloadProfilePhotoUrls([r.value.pick?.photo_path, r.value.mutual?.photo_path]);
        if (live) setLoad({ kind: 'ready', data: r.value });
      })();
      return () => {
        live = false;
      };
    }, [reload]),
  );

  if (load.kind === 'unsupported') return <V2MatchesScreen />;

  const openProfile = (card: DailyCard, kind: 'pick' | 'mutual') =>
    router.push({ pathname: '/v2/match-profile', params: { userId: card.user_id, kind } } as never);
  // Opens the real chat; never sends anything by itself.
  const sayHello = (card: DailyCard) =>
    card.match_id &&
    router.push({ pathname: '/chat', params: { userId: card.user_id, userName: card.first_name ?? '', matchId: card.match_id } });

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {load.kind === 'loading' ? (
        <View style={styles.center}>
          <ActivityIndicator color={obColors.cta} accessibilityLabel="Loading matches" />
        </View>
      ) : load.kind === 'error' ? (
        <View style={styles.center}>
          <Text style={styles.errorTitle} accessibilityRole="header">Couldn’t load Matches</Text>
          <Text style={styles.errorText} accessibilityLiveRegion="polite">{load.message}</Text>
          <TouchableOpacity onPress={() => { setLoad({ kind: 'loading' }); setReload((n) => n + 1); }} style={styles.retry} accessibilityRole="button">
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <MatchesTitle />
          <SectionHead title={C.pickedTitle} caption={C.pickedCaption} />
          {load.data.pick ? (
            <Card card={load.data.pick} onOpen={() => openProfile(load.data.pick as DailyCard, 'pick')}>
              {load.data.pick.state === 'conversation_started' ? (
                <StartedBox />
              ) : load.data.pick.state === 'matched' ? (
                // Liked back during the period: the same card, now a match.
                <>
                  <StatusLine text={C.likedBack} />
                  <SayHelloButton name={load.data.pick.first_name ?? ''} onPress={() => sayHello(load.data.pick as DailyCard)} />
                </>
              ) : (
                <>
                  {load.data.pick.state === 'like_sent' ? <StatusLine text={C.likeSent} /> : null}
                  <ViewProfileButton name={load.data.pick.first_name ?? ''} onPress={() => openProfile(load.data.pick as DailyCard, 'pick')} />
                </>
              )}
            </Card>
          ) : (
            <EmptyCard icon="sparkles-outline" title={C.noPickTitle} text={C.noPickText} />
          )}

          <SectionHead title={C.mutualTitle} caption={C.mutualCaption} gapAbove />
          {load.data.mutual ? (
            <Card card={load.data.mutual} onOpen={() => openProfile(load.data.mutual as DailyCard, 'mutual')}>
              {load.data.mutual.state === 'conversation_started' ? (
                <StartedBox />
              ) : (
                <SayHelloButton name={load.data.mutual.first_name ?? ''} onPress={() => sayHello(load.data.mutual as DailyCard)} />
              )}
            </Card>
          ) : mutualEmptyKind(load.data) === 'none_today' ? (
            <EmptyCard icon="chatbubbles-outline" title={C.noMutualTodayTitle} text={C.noMutualTodayText} />
          ) : (
            <EmptyCard icon="heart-outline" title={C.noMutualTitle} text={C.noMutualText} />
          )}
        </ScrollView>
      )}
    </View>
  );
}

function Card({ card, onOpen, children }: { card: DailyCard; onOpen: () => void; children: React.ReactNode }) {
  const url = cachedProfilePhotoUrl(card.photo_path);
  return (
    // Location: the server's public city (a district is never sent).
    <PersonCard name={card.first_name ?? ''} age={card.age} location={card.city} photo={url ? { uri: url } : null} onOpenProfile={onOpen}>
      {children}
    </PersonCard>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: obColors.background },
  content: { paddingHorizontal: obSpacing.lg + 4, paddingBottom: obSpacing.xxl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: obSpacing.md, padding: obSpacing.gutter },
  errorTitle: { fontFamily: obFonts.heading, fontSize: 22, lineHeight: 28, color: obColors.textPrimary, textAlign: 'center' },
  errorText: { fontFamily: obFonts.body, fontSize: 15, lineHeight: 21, color: obColors.textSecondary, textAlign: 'center' },
  retry: { minHeight: 48, paddingHorizontal: obSpacing.xl, borderRadius: 12, backgroundColor: obColors.cta, alignItems: 'center', justifyContent: 'center' },
  retryText: { fontFamily: obFonts.bodySemiBold, fontSize: 16, lineHeight: 21, color: obColors.onCta },
});
