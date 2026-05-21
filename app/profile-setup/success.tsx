// Screen: Setup tamamlandı | Status: wip | Last updated: Mayıs 2026
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, BackHandler, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { HomeTopIcon } from '@/components/ui/HomeTopIcon';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { colors } from '@/lib/designTokens';
import { calculateMatchScore, type SupabaseMatchUser } from '@/lib/matchScoring';
import { normalizeIntentKey } from '@/lib/onboardingIntent';
import { supabase } from '@/lib/supabaseClient';

type SuccessData = {
  city: string | null;
  date_of_birth: string | null;
  meeting_preferences: string[] | null;
  availability_days: string[] | null;
  availability_hours: string[] | null;
  intent: string | null;
  _intentPref?: string | null;
  _intentOnboarding?: string | null;
  _intentProfile?: string | null;
};

type MatchPreview = {
  user_id: string;
  first_name: string | null;
  date_of_birth: string | null;
  city: string | null;
  photos: string[] | null;
  match_percentage: number;
  match_category: string;
  reasons: string[];
};

function safeAgeFromDob(dob: string | null): number {
  if (!dob) return 28;
  const year = new Date(dob).getFullYear();
  if (!year || Number.isNaN(year)) return 28;
  return new Date().getFullYear() - year;
}

function summarizeMeetingPrefs(prefs: string[] | null): string {
  if (!prefs?.length) return 'Everyone';
  if (prefs.includes('Everyone')) return 'Everyone';
  return prefs.join(' & ');
}

function summarizeDays(days: string[] | null): string {
  if (!days?.length) return '';
  const hasMon = days.includes('Mon');
  const hasSat = days.includes('Sat') || days.includes('Sun');
  if (hasMon && hasSat) return 'Weekdays & Weekends';
  if (hasSat) return 'Weekends';
  return 'Weekdays';
}

function summarizeHours(hours: string[] | null): string {
  if (!hours?.length) return '';
  if (hours.includes('Evening (18-21)')) return 'Evenings';
  if (hours.includes('Morning (9-12)')) return 'Mornings';
  if (hours.includes('Afternoon (12-18)')) return 'Afternoons';
  return 'Flexible';
}

const INTENT_TEXT: Record<string, string> = {
  just_friends: 'Just looking for friends',
  keeping_it_casual: 'Keeping it casual',
  open_to_relationship: 'Open to a relationship',
  not_sure_yet: 'Open to anything',
};

function intentText(intent: string | null): string {
  if (!intent) return 'Open to anything';
  return INTENT_TEXT[intent] ?? 'Open to anything';
}

function InfoCard({
  icon,
  label,
  value,
  delay,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  delay: number;
}) {
  return (
    <Animated.View entering={FadeIn.delay(delay).duration(260)} style={styles.card}>
      <View style={styles.cardIconWrap}>
        <Ionicons name={icon} size={18} color={colors.accent} />
      </View>
      <View style={styles.cardBody}>
        <ThemedText style={styles.cardLabel}>{label}</ThemedText>
        <ThemedText style={styles.cardValue}>{value}</ThemedText>
      </View>
    </Animated.View>
  );
}

export default function ProfileSetupSuccess() {
  const router = useRouter();
  const params = useLocalSearchParams<{ demo?: string }>();
  const isDemoMode = params.demo === '1';

  const [data, setData] = useState<SuccessData>({
    city: null,
    date_of_birth: null,
    meeting_preferences: null,
    availability_days: null,
    availability_hours: null,
    intent: null,
    _intentPref: null,
    _intentOnboarding: null,
    _intentProfile: null,
  });
  const [loading, setLoading] = useState(true);
  const [findingMatches, setFindingMatches] = useState(false);

  const iconScale = useSharedValue(0);
  const pulse = useSharedValue(1);

  useFocusEffect(
    useCallback(() => {
      const onBack = () => true;
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, []),
  );

  useEffect(() => {
    iconScale.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) });
    pulse.value = withRepeat(withTiming(1.06, { duration: 900, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [iconScale, pulse]);

  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: iconScale.value }] }));
  const subtitlePulse = useAnimatedStyle(() => ({ opacity: pulse.value > 1 ? 1 : 0.9 }));

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (isDemoMode) {
        if (!mounted) return;
        setData({
          city: 'Istanbul',
          date_of_birth: '1998-01-01',
          meeting_preferences: ['Everyone'],
          availability_days: ['Sat', 'Sun'],
          availability_hours: ['Evening (18-21)'],
          intent: 'not_sure_yet',
          _intentPref: 'not_sure_yet',
          _intentOnboarding: 'not_sure_yet',
          _intentProfile: 'not_sure_yet',
        });
        setLoading(false);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!mounted || !user) {
        setLoading(false);
        return;
      }

      const [{ data: profile }, { data: pref }, { data: onboarding }] = await Promise.all([
        supabase
          .from('profiles')
          .select('city,date_of_birth,meeting_preferences,availability_days,availability_hours,intent')
          .eq('id', user.id)
          .maybeSingle(),
        supabase.from('preferences').select('intent').eq('user_id', user.id).maybeSingle(),
        supabase.from('onboarding_answers').select('intent').eq('user_id', user.id).maybeSingle(),
      ]);

      if (!mounted) return;
      const resolvedIntent =
        normalizeIntentKey((pref?.intent as string | undefined) ?? '') ??
        normalizeIntentKey((onboarding?.intent as string | undefined) ?? '') ??
        normalizeIntentKey((profile?.intent as string | undefined) ?? '') ??
        'open_to_relationship';
      setData({
        city: profile?.city ?? null,
        date_of_birth: profile?.date_of_birth ?? null,
        meeting_preferences: profile?.meeting_preferences ?? null,
        availability_days: profile?.availability_days ?? null,
        availability_hours: profile?.availability_hours ?? null,
        intent: resolvedIntent,
        _intentPref: (pref?.intent as string | null) ?? null,
        _intentOnboarding: (onboarding?.intent as string | null) ?? null,
        _intentProfile: (profile?.intent as string | null) ?? null,
      });
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [isDemoMode]);

  const age = safeAgeFromDob(data.date_of_birth);
  const minAge = Math.max(18, age - 5);
  const maxAge = age + 5;
  const locationValue = `${data.city ?? 'Your city'} · Ages ${minAge}-${maxAge} · Open to ${summarizeMeetingPrefs(data.meeting_preferences)}`;

  const hoursSummary = summarizeHours(data.availability_hours);
  const daysSummary = summarizeDays(data.availability_days);
  const showAvailabilityCard = Boolean(hoursSummary && daysSummary);

  const cards = useMemo(
    () => [
      { icon: 'location-outline' as const, label: 'Looking in', value: locationValue },
      { icon: 'heart-outline' as const, label: 'Looking for', value: intentText(data.intent) },
      ...(showAvailabilityCard
        ? [{ icon: 'time-outline' as const, label: 'Best time', value: `${hoursSummary} · ${daysSummary}` }]
        : []),
    ],
    [data.intent, daysSummary, hoursSummary, locationValue, showAvailabilityCard],
  );

  const handleFindMyMatch = useCallback(async () => {
    setFindingMatches(true);
    const {
      data: { session },
      error: sessionErr,
    } = await supabase.auth.getSession();
    const {
      data: { user: authUser },
      error: authErr,
    } = await supabase.auth.getUser();
    try {
      let finalUserId: string | null = null;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user?.id) {
        finalUserId = session.user.id;
      } else {
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();
        finalUserId = authUser?.id ?? null;
      }
      if (!finalUserId) throw new Error('Oturum bulunamadi. Lutfen cikis yapip tekrar giris yapin.');

      const [meProfileRes, meOnboardingRes, candidatesRes, candidateOnboardingRes] = await Promise.all([
        supabase
          .from('profiles')
          .select(
            'id,first_name,city,district,date_of_birth,gender,meeting_preferences,languages,morning_night,recharge_style,hobbies,drinking,smoking,education,education_detail,religion,availability_days,availability_hours,meeting_environment,first_date_expectation,bio,photos,setup_completed',
          )
          .eq('id', finalUserId)
          .maybeSingle(),
        supabase.from('onboarding_answers').select('*').eq('user_id', finalUserId).maybeSingle(),
        supabase
          .from('profiles')
          .select(
            'id,first_name,city,district,date_of_birth,gender,meeting_preferences,languages,morning_night,recharge_style,hobbies,drinking,smoking,education,education_detail,religion,availability_days,availability_hours,meeting_environment,first_date_expectation,bio,photos,setup_completed',
          )
          .neq('id', finalUserId)
          .eq('setup_completed', true),
        supabase.from('onboarding_answers').select('*').neq('user_id', finalUserId),
      ]);

      if (meProfileRes.error) throw new Error(meProfileRes.error.message);
      if (meOnboardingRes.error) throw new Error(meOnboardingRes.error.message);
      if (candidatesRes.error) throw new Error(candidatesRes.error.message);
      if (candidateOnboardingRes.error) throw new Error(candidateOnboardingRes.error.message);
      if (!meProfileRes.data || !meOnboardingRes.data) {
        throw new Error('Eslesme icin profil veya onboarding verisi eksik.');
      }

      const me: SupabaseMatchUser = {
        profiles: meProfileRes.data,
        onboarding_answers: meOnboardingRes.data,
      };
      const onboardingMap = new Map((candidateOnboardingRes.data ?? []).map((row) => [row.user_id, row]));

      const top3 = (candidatesRes.data ?? [])
        .map((profile) => {
          const candidate: SupabaseMatchUser = {
            profiles: profile,
            onboarding_answers: onboardingMap.get(profile.id) ?? null,
          };
          const score = calculateMatchScore(me, candidate);
          if (!score.ok) return null;
          const preview: MatchPreview = {
            user_id: profile.id,
            first_name: (profile as any).first_name ?? null,
            date_of_birth: profile.date_of_birth,
            city: profile.city,
            photos: (profile as any).photos ?? null,
            match_percentage: score.matchPercentage,
            match_category: score.matchCategory,
            reasons: score.reasons.slice(0, 3),
          };
          return preview;
        })
        .filter((v): v is MatchPreview => !!v)
        .sort((a, b) => b.match_percentage - a.match_percentage)
        .slice(0, 3);

      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      if (top3.length > 0) {
        const { error: deleteErr } = await supabase
          .from('matches')
          .delete()
          .eq('user_a_id', finalUserId)
          .eq('status', 'pending');
        if (deleteErr) throw new Error(deleteErr.message);

        const rows = top3.map((m) => ({
          user_a_id: finalUserId,
          user_b_id: m.user_id,
          match_score: m.match_percentage,
          status: 'pending',
          expires_at: expiresAt,
          algo_version: 'v2',
        }));
        const { error: insertErr } = await supabase.from('matches').insert(rows);
        if (insertErr) throw new Error(insertErr.message);
      }

      router.push({
        pathname: '/match-results',
        params: { results: encodeURIComponent(JSON.stringify(top3)) },
      });
    } catch (e: any) {
      console.error('FIND MATCH ERROR', e);
      Alert.alert('Match bulunamadi', e?.message ?? 'Bir hata olustu.');
    } finally {
      setFindingMatches(false);
    }
  }, [router]);

  return (
    <ScreenContainer style={styles.container}>
      <HomeTopIcon />
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Animated.View style={[styles.successIconWrap, iconStyle]}>
            <Ionicons name="checkmark" size={34} color={colors.textPrimary} />
          </Animated.View>

          <ThemedText style={styles.title}>You&apos;re all set!</ThemedText>
          <Animated.View style={subtitlePulse}>
            <ThemedText style={styles.subtitle}>Finding your perfect match...</ThemedText>
          </Animated.View>

          {!loading ? (
            <View style={styles.cardsWrap}>
              {cards.map((c, idx) => (
                <InfoCard key={`${c.label}-${idx}`} icon={c.icon} label={c.label} value={c.value} delay={idx * 100} />
              ))}
            </View>
          ) : null}

          <PrimaryButton
            label={findingMatches ? 'Finding...' : 'Find my match'}
            onPress={handleFindMyMatch}
            loading={findingMatches}
            disabled={findingMatches}
          />

          {__DEV__ ? (
            <ThemedText style={styles.debugText}>
              debug intent | pref:{data._intentPref ?? 'null'} | onboarding:{data._intentOnboarding ?? 'null'} | profile:
              {data._intentProfile ?? 'null'} | resolved:{data.intent ?? 'null'}
            </ThemedText>
          ) : null}

          <ThemedText style={styles.footerNote}>We&apos;ll notify you when we find the right person</ThemedText>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'flex-start',
  },
  keyboard: {
    flex: 1,
  },
  content: {
    paddingBottom: 24,
    gap: 12,
  },
  successIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: colors.accent,
    backgroundColor: colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 4,
    marginBottom: 4,
  },
  title: {
    textAlign: 'center',
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '500',
  },
  subtitle: {
    textAlign: 'center',
    color: colors.accent,
    fontSize: 14,
  },
  cardsWrap: {
    marginTop: 8,
    marginBottom: 10,
    gap: 10,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderWidth: 0.5,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  cardIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#EEEEEE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
  },
  cardLabel: {
    color: '#888',
    fontSize: 11,
    marginBottom: 2,
  },
  cardValue: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '500',
  },
  footerNote: {
    marginTop: 12,
    textAlign: 'center',
    color: '#555',
    fontSize: 12,
  },
  debugText: {
    marginTop: 10,
    textAlign: 'center',
    color: '#8A8F9B',
    fontSize: 10,
  },
});

