// Screen: Your plan (confirmed date detail) | Status: new | Added 2026-09-18 (Matches Warm Editorial redesign)
import { useCallback, useState } from 'react';
import { Alert, Share, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import { PersonAvatar } from '@/components/matches/PersonAvatar';
import { MatchScoreBadge } from '@/components/matches/MatchScoreBadge';
import { SafetyCard } from '@/components/matches/SafetyCard';
import { ThemedText } from '@/components/themed-text';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { hingeSafeAge } from '@/lib/hingeProfile';
import { formatMeetingTime } from '@/lib/matchInvite';
import { homeColors, homeRadius, homeShadow, homeSpacing } from '@/lib/homeTheme';
import { getProfilePhotoPublicUrl } from '@/lib/resolveProfilePhotoUrl';
import { supabase } from '@/lib/supabaseClient';

function firstParam(val: string | string[] | undefined): string {
  if (Array.isArray(val)) return val[0] ?? '';
  return val ?? '';
}

function splitVenueText(raw: string | null): { venue: string | null; district: string | null } {
  if (!raw?.trim()) return { venue: null, district: null };
  const idx = raw.indexOf(' — ');
  if (idx === -1) return { venue: raw.trim(), district: null };
  const venue = raw.slice(0, idx).trim();
  let rest = raw.slice(idx + 3).trim();
  const dotIdx = rest.indexOf(' · ');
  if (dotIdx !== -1) rest = rest.slice(0, dotIdx).trim();
  return { venue: venue || null, district: rest || null };
}

type PlanData = {
  otherName: string;
  otherAge: number;
  otherPhoto: string | null;
  matchPercentage: number | null;
  venue: string | null;
  district: string | null;
  whenLabel: string | null;
  canMessage: boolean;
};

export default function PlanDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const matchId = firstParam(params.matchId);
  const otherUserId = firstParam(params.otherUserId);

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [plan, setPlan] = useState<PlanData | null>(null);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      (async () => {
        setLoading(true);
        setNotFound(false);
        if (!matchId || !otherUserId) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        const [{ data: match }, { data: profile }] = await Promise.all([
          supabase
            .from('matches')
            .select('id, match_score, meeting_at, confirmed_place, meetup_confirmed, chat_opened')
            .eq('id', matchId)
            .maybeSingle(),
          supabase.from('profiles').select('first_name, date_of_birth, photos').eq('id', otherUserId).maybeSingle(),
        ]);

        if (!mounted) return;

        // Real, live re-check — a plan can stop being confirmed between the
        // Plans list load and opening this screen (e.g. reset in another
        // session). Never show a stale/fabricated confirmed state.
        if (!match || !match.meeting_at || match.meetup_confirmed !== true) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        const { venue, district } = splitVenueText(match.confirmed_place ?? null);
        const photos = (profile?.photos as string[] | null) ?? null;
        const photoUrl = photos?.[0]?.trim() ? getProfilePhotoPublicUrl(photos[0]) : null;

        setPlan({
          otherName: profile?.first_name ?? 'Someone',
          otherAge: hingeSafeAge(profile?.date_of_birth ?? null),
          otherPhoto: photoUrl,
          matchPercentage: typeof match.match_score === 'number' ? Math.round(match.match_score) : null,
          venue,
          district,
          whenLabel: formatMeetingTime(match.meeting_at),
          canMessage: match.chat_opened === true,
        });
        setLoading(false);
      })();
      return () => {
        mounted = false;
      };
    }, [matchId, otherUserId]),
  );

  async function handleSharePlan() {
    if (!plan) return;
    const parts = [`I'm meeting ${plan.otherName}`];
    if (plan.venue) parts.push(`at ${plan.venue}`);
    if (plan.whenLabel) parts.push(`on ${plan.whenLabel}`);
    if (plan.district) parts.push(`(${plan.district})`);
    try {
      await Share.share({ message: `${parts.join(' ')}.` });
    } catch {
      Alert.alert('Could not share', 'Please try again.');
    }
  }

  function handleMessage() {
    if (!plan || !otherUserId) return;
    router.push({
      pathname: '/chat',
      params: { userId: otherUserId, userName: plan.otherName, matchId },
    });
  }

  if (loading) {
    return (
      <ScreenContainer style={styles.container}>
        <Header onBack={() => router.back()} />
        <View style={styles.centerWrap}>
          <ThemedText style={styles.loadingText}>Loading…</ThemedText>
        </View>
      </ScreenContainer>
    );
  }

  if (notFound || !plan) {
    return (
      <ScreenContainer style={styles.container}>
        <Header onBack={() => router.back()} />
        <View style={styles.centerWrap}>
          <Ionicons name="calendar-outline" size={36} color={homeColors.textSecondary} />
          <ThemedText style={styles.emptyTitle}>This plan isn&apos;t available</ThemedText>
          <ThemedText style={styles.emptySubtitle}>
            It may have changed since you last checked.
          </ThemedText>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer style={styles.container}>
      <Header onBack={() => router.back()} title="Your plan" />
      <View style={styles.content}>
        <View style={styles.profileRow}>
          <PersonAvatar photoUrl={plan.otherPhoto} name={plan.otherName} size={72} />
          <View style={styles.profileInfo}>
            <ThemedText style={styles.name}>
              {plan.otherName}
              {plan.otherAge > 0 ? `, ${plan.otherAge}` : ''}
            </ThemedText>
            {typeof plan.matchPercentage === 'number' ? (
              <MatchScoreBadge percentage={plan.matchPercentage} />
            ) : null}
          </View>
        </View>

        <ThemedText style={styles.meetingLine}>You&apos;re meeting</ThemedText>

        <View style={styles.planCard}>
          {plan.venue ? (
            <PlanRow icon="cafe-outline" text={plan.venue} />
          ) : null}
          {plan.whenLabel ? <PlanRow icon="calendar-outline" text={plan.whenLabel} /> : null}
          {plan.district ? <PlanRow icon="location-outline" text={plan.district} /> : null}
          <View style={styles.confirmedRow}>
            <Ionicons name="checkmark-circle" size={16} color="#2E7D4F" />
            <ThemedText style={styles.confirmedText}>Confirmed by both</ThemedText>
          </View>
        </View>

        <SafetyCard onSharePlan={() => void handleSharePlan()} />

        {plan.canMessage ? (
          <TouchableOpacity
            style={styles.messageBtn}
            onPress={handleMessage}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`Message ${plan.otherName}`}>
            <ThemedText style={styles.messageBtnText}>Message {plan.otherName}</ThemedText>
          </TouchableOpacity>
        ) : null}
      </View>
    </ScreenContainer>
  );
}

function Header({ onBack, title }: { onBack: () => void; title?: string }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity
        onPress={onBack}
        hitSlop={12}
        style={styles.backBtn}
        accessibilityRole="button"
        accessibilityLabel="Back">
        <Ionicons name="chevron-back" size={26} color={homeColors.textPrimary} />
      </TouchableOpacity>
      {title ? <ThemedText style={styles.headerTitle}>{title}</ThemedText> : null}
      <View style={styles.headerSpacer} />
    </View>
  );
}

function PlanRow({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.planRow}>
      <Ionicons name={icon} size={17} color={homeColors.accent} />
      <ThemedText style={styles.planRowText} numberOfLines={2}>
        {text}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: 'flex-start', backgroundColor: homeColors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  backBtn: { padding: 8 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: homeColors.textPrimary },
  headerSpacer: { width: 44 },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 32 },
  loadingText: { color: homeColors.textSecondary, fontSize: 15 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: homeColors.textPrimary, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, color: homeColors.textSecondary, textAlign: 'center' },

  content: { flex: 1, paddingHorizontal: homeSpacing.lg, paddingTop: homeSpacing.sm, gap: homeSpacing.lg },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: homeSpacing.md },
  profileInfo: { gap: 6 },
  name: { fontSize: 20, fontWeight: '800', color: homeColors.textPrimary },
  meetingLine: { fontSize: 15, color: homeColors.textSecondary },

  planCard: {
    backgroundColor: homeColors.surface,
    borderRadius: homeRadius.card,
    borderWidth: 1,
    borderColor: homeColors.border,
    padding: homeSpacing.md,
    gap: homeSpacing.sm + 2,
    ...homeShadow,
  },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: homeSpacing.sm },
  planRowText: { flex: 1, fontSize: 15, fontWeight: '600', color: homeColors.textPrimary },
  confirmedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
    paddingTop: homeSpacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: homeColors.border,
  },
  confirmedText: { fontSize: 13.5, fontWeight: '700', color: '#2E7D4F' },

  messageBtn: {
    minHeight: 44,
    borderRadius: homeRadius.pill,
    borderWidth: 1.5,
    borderColor: homeColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageBtnText: { color: homeColors.accent, fontSize: 15.5, fontWeight: '700' },
});
