// Matches tab (V2 product decision, 2026-10-01): only REAL mutual matches,
// no algorithmic candidates, no compatibility %, no "Plan a date" before a
// match. Two sections:
//   Matches — every active match; "Say hello" (no messages yet) or
//             "Continue chatting" (a conversation exists).
//   Plans   — date suggestions waiting for a reply (yours / theirs) and
//             accepted plans, kept clearly apart.
// Data comes only from get_my_matches_v2 / get_my_date_plans_v2 (server
// filters blocked / unmatched / deleted; first name + main photo only).
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { MatchesHeader } from '@/components/matches/MatchesHeader';
import { MatchesSegmentedControl, type MatchesTabKey } from '@/components/matches/MatchesSegmentedControl';
import { PersonAvatar } from '@/components/matches/PersonAvatar';
import { homeColors, homeFonts, homeSpacing } from '@/lib/homeTheme';
import { loadDatePlans, loadMyMatches, type DatePlan, type MyMatch } from '@/lib/matchChatV2';
import { formatMeetingTime } from '@/lib/matchInvite';
import { preloadProfilePhotoUrls, cachedProfilePhotoUrl } from '@/lib/resolveProfilePhotoUrl';

type Data = { matches: MyMatch[]; plans: DatePlan[] };

export function V2MatchesScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<MatchesTabKey>('ready');
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      void (async () => {
        setError(null);
        const [m, p] = await Promise.all([loadMyMatches(), loadDatePlans()]);
        if (!live) return;
        if (!m.ok) return setError(m.message);
        if (!p.ok) return setError(p.message);
        await preloadProfilePhotoUrls([...m.value.map((x) => x.photo_path), ...p.value.map((x) => x.photo_path)]);
        if (live) setData({ matches: m.value, plans: p.value });
      })();
      return () => {
        live = false;
      };
    }, [reload]),
  );

  const openChat = (otherId: string, name: string | null, matchId: string) =>
    router.push({ pathname: '/chat', params: { userId: otherId, userName: name ?? '', matchId } });
  const openProfile = (otherId: string) => router.push(`/v2/profile?userId=${otherId}` as never);

  const pendingTheirs = data?.plans.filter((p) => p.status === 'pending' && !p.mine) ?? [];
  const pendingMine = data?.plans.filter((p) => p.status === 'pending' && p.mine) ?? [];
  const accepted = data?.plans.filter((p) => p.status === 'accepted') ?? [];

  return (
    <View style={styles.root}>
      <View style={styles.headerPad}>
        <MatchesHeader />
        <MatchesSegmentedControl value={tab} onChange={setTab} readyCount={data?.matches.length} plansCount={data?.plans.length} />
      </View>
      {error ? (
        <View style={styles.center}>
          <Text style={styles.body} accessibilityLiveRegion="polite">{error}</Text>
          <TouchableOpacity onPress={() => setReload((n) => n + 1)} accessibilityRole="button" hitSlop={10}>
            <Text style={styles.link}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : !data ? (
        <View style={styles.center}>
          <ActivityIndicator color={homeColors.accent} accessibilityLabel="Loading" />
        </View>
      ) : tab === 'ready' ? (
        <FlatList
          data={data.matches}
          keyExtractor={(m) => m.match_id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Empty title="No matches yet" text="When you and someone like each other, you'll find them here." />
          }
          renderItem={({ item }) => {
            const started = !!item.last_message_at;
            return (
              <View style={styles.card}>
                <TouchableOpacity onPress={() => openProfile(item.other_id)} accessibilityRole="button" accessibilityLabel={`View ${item.first_name ?? 'profile'}`}>
                  <PersonAvatar photoUrl={cachedProfilePhotoUrl(item.photo_path)} name={item.first_name} size={64} />
                </TouchableOpacity>
                <View style={styles.cardText}>
                  <Text style={styles.name} numberOfLines={1}>{item.first_name ?? 'Your match'}</Text>
                  <Text style={styles.sub} numberOfLines={1}>
                    {started
                      ? `${item.last_from_me ? 'You: ' : ''}${item.last_message ?? ''}`
                      : 'You matched. Start the conversation.'}
                  </Text>
                  {item.unread > 0 ? <Text style={styles.unread}>{item.unread === 1 ? '1 new message' : `${item.unread} new messages`}</Text> : null}
                </View>
                <TouchableOpacity
                  style={styles.cta}
                  onPress={() => openChat(item.other_id, item.first_name, item.match_id)}
                  accessibilityRole="button"
                  accessibilityLabel={started ? `Continue chatting with ${item.first_name ?? 'your match'}` : `Say hello to ${item.first_name ?? 'your match'}`}>
                  <Text style={styles.ctaText}>{started ? 'Continue chatting' : 'Say hello'}</Text>
                </TouchableOpacity>
              </View>
            );
          }}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {data.plans.length === 0 ? (
            <Empty title="No plans yet" text="Suggest a date from a chat with + → Suggest a date. It shows up here." />
          ) : null}
          <PlanSection title="Waiting for your reply" items={pendingTheirs} note="Suggested a date" onOpen={openChat} />
          <PlanSection title="Awaiting their reply" items={pendingMine} note="You suggested" onOpen={openChat} />
          <PlanSection title="Confirmed" items={accepted} note="Confirmed" onOpen={openChat} />
        </ScrollView>
      )}
    </View>
  );
}

function PlanSection({
  title,
  items,
  note,
  onOpen,
}: {
  title: string;
  items: DatePlan[];
  note: string;
  onOpen: (otherId: string, name: string | null, matchId: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} accessibilityRole="header">{title}</Text>
      {items.map((p) => (
        <TouchableOpacity
          key={p.proposal_id}
          style={styles.card}
          onPress={() => onOpen(p.other_id, p.first_name, p.match_id)}
          accessibilityRole="button"
          accessibilityLabel={`${note}, ${p.first_name ?? ''}, ${formatMeetingTime(p.meeting_at)}${p.place ? `, ${p.place}` : ''}`}>
          <PersonAvatar photoUrl={cachedProfilePhotoUrl(p.photo_path)} name={p.first_name} size={52} />
          <View style={styles.cardText}>
            <Text style={styles.name} numberOfLines={1}>{p.first_name ?? 'Your match'}</Text>
            <Text style={styles.sub} numberOfLines={1}>{formatMeetingTime(p.meeting_at)}{p.place ? ` · ${p.place}` : ''}</Text>
            <Text style={[styles.badge, p.status === 'accepted' && styles.badgeConfirmed]}>{note}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.body}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: homeColors.background },
  headerPad: { paddingHorizontal: homeSpacing.xl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: homeSpacing.md, padding: homeSpacing.xl },
  list: { padding: homeSpacing.xl, paddingTop: homeSpacing.sm, gap: homeSpacing.md },
  section: { gap: homeSpacing.sm, marginBottom: homeSpacing.md },
  sectionTitle: { fontFamily: homeFonts.bodySemiBold, fontSize: 13, lineHeight: 18, letterSpacing: 0.4, textTransform: 'uppercase', color: homeColors.textSecondary },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: homeSpacing.md,
    backgroundColor: homeColors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: homeColors.border,
    padding: homeSpacing.md,
  },
  cardText: { flex: 1, gap: 2 },
  name: { fontFamily: homeFonts.heading, fontSize: 19, lineHeight: 25, color: homeColors.textPrimary },
  sub: { fontFamily: homeFonts.body, fontSize: 14, lineHeight: 20, color: homeColors.textSecondary },
  unread: { fontFamily: homeFonts.bodySemiBold, fontSize: 13, lineHeight: 18, color: homeColors.accent },
  cta: { minHeight: 44, paddingHorizontal: homeSpacing.md, borderRadius: 999, backgroundColor: homeColors.accent, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontFamily: homeFonts.bodySemiBold, fontSize: 14, lineHeight: 20, color: '#FFFFFF' },
  badge: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: homeColors.mutedSurface,
    fontFamily: homeFonts.bodyMedium,
    fontSize: 12,
    lineHeight: 17,
    color: homeColors.textPrimary,
  },
  badgeConfirmed: { backgroundColor: homeColors.accentSoft, color: homeColors.accent },
  empty: { alignItems: 'center', gap: homeSpacing.sm, paddingTop: 48, paddingHorizontal: homeSpacing.lg },
  emptyTitle: { fontFamily: homeFonts.heading, fontSize: 22, lineHeight: 28, color: homeColors.textPrimary, textAlign: 'center' },
  body: { fontFamily: homeFonts.body, fontSize: 15, lineHeight: 21, color: homeColors.textSecondary, textAlign: 'center' },
  link: { fontFamily: homeFonts.bodySemiBold, fontSize: 16, lineHeight: 22, color: homeColors.accent, textDecorationLine: 'underline' },
});
