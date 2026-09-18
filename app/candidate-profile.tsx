// Screen: Candidate profile (opened from Matches Ready / Plans) | Status: new | Added 2026-09-19
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { Dimensions, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MatchScoreBadge } from '@/components/matches/MatchScoreBadge';
import { WhyYouMatchCard } from '@/components/home/WhyYouMatchCard';
import { ThemedText } from '@/components/themed-text';
import { homeColors, homeRadius, homeShadow, homeSpacing } from '@/lib/homeTheme';
import {
  buildAboutMeChips,
  buildAvailabilityChip,
  buildInterestChips,
  buildLookingForChips,
  buildPromptCards,
  formatFavoriteSpots,
  hingeSafeAge,
  parseFavoriteSpots,
  type HingeProfilePerson,
  type ProfileChip,
} from '@/lib/hingeProfile';
import { computeFallbackReasons, type ReasonCompareProfile } from '@/lib/matchReason';
import { getProfilePhotoPublicUrl } from '@/lib/resolveProfilePhotoUrl';
import { supabase } from '@/lib/supabaseClient';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const HERO_HEIGHT = SCREEN_HEIGHT * 0.5;

function firstParam(val: string | string[] | undefined): string {
  if (Array.isArray(val)) return val[0] ?? '';
  return val ?? '';
}

type CandidateProfile = {
  first_name: string | null;
  date_of_birth: string | null;
  photos: string[] | null;
  city: string | null;
  district: string | null;
  gender: string | null;
  zodiac_sign: string | null;
  education: string | null;
  morning_night: string | null;
  drinking: string | null;
  smoking: string | null;
  pets: string | null;
  availability_days: string[] | null;
  hobbies: string[] | null;
  favorite_activity: string | null;
  vibe: string | null;
  core_value: string | null;
  impressed_by: string | null;
  languages: string[] | null;
  favorite_music: string | null;
  favorite_movie: string | null;
  favorite_book: string | null;
  bio: string | null;
  first_date_expectation: string | null;
  favorite_spots: Record<string, string> | null;
  meeting_environment: string[] | null;
};

type MatchRow = {
  id: string;
  user_a_id: string;
  user_b_id: string;
  match_score: number;
  status: string;
  invited_by: string | null;
  chat_opened: boolean;
  expires_at: string | null;
};

export default function CandidateProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const matchUserId = firstParam(params.matchUserId);
  const matchId = firstParam(params.matchId);

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [candidate, setCandidate] = useState<CandidateProfile | null>(null);
  const [intent, setIntent] = useState<string | null>(null);
  const [reasons, setReasons] = useState<string[]>([]);
  const [match, setMatch] = useState<MatchRow | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [viewerCity, setViewerCity] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      (async () => {
        setLoading(true);
        setNotFound(false);

        if (!matchUserId || !matchId) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();
        const user = session?.user;
        if (!user || !mounted) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        setMyUserId(user.id);

        const [
          { data: matchRow },
          { data: candidateRow },
          { data: candidateIntentRow },
          { data: meRow },
          { data: meIntentRow },
        ] = await Promise.all([
          supabase
            .from('matches')
            .select('id, user_a_id, user_b_id, match_score, status, invited_by, chat_opened, expires_at')
            .eq('id', matchId)
            .maybeSingle(),
          supabase
            .from('profiles')
            .select(
              'first_name, date_of_birth, photos, city, district, gender, zodiac_sign, education, morning_night, drinking, smoking, pets, availability_days, hobbies, favorite_activity, vibe, core_value, impressed_by, languages, favorite_music, favorite_movie, favorite_book, bio, first_date_expectation, favorite_spots, meeting_environment',
            )
            .eq('id', matchUserId)
            .maybeSingle(),
          supabase.from('onboarding_answers').select('intent').eq('user_id', matchUserId).maybeSingle(),
          supabase
            .from('profiles')
            .select('city, district, hobbies, drinking, smoking, zodiac_sign, favorite_spots, meeting_environment')
            .eq('id', user.id)
            .maybeSingle(),
          supabase.from('onboarding_answers').select('intent').eq('user_id', user.id).maybeSingle(),
        ]);

        if (!mounted) return;

        if (!matchRow || !candidateRow) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        setMatch(matchRow as MatchRow);
        setCandidate(candidateRow as CandidateProfile);
        setIntent(candidateIntentRow?.intent ?? null);
        setViewerCity(typeof meRow?.city === 'string' ? meRow.city : null);

        const meCompare: ReasonCompareProfile = {
          hobbies: meRow?.hobbies ?? null,
          intent: meIntentRow?.intent ?? null,
          drinking: meRow?.drinking ?? null,
          smoking: meRow?.smoking ?? null,
          district: meRow?.district ?? null,
          zodiac_sign: meRow?.zodiac_sign ?? null,
          favorite_spots: parseFavoriteSpots(meRow?.favorite_spots),
          meeting_environment: meRow?.meeting_environment ?? null,
        };
        const themCompare: ReasonCompareProfile = {
          hobbies: (candidateRow as CandidateProfile).hobbies,
          intent: candidateIntentRow?.intent ?? null,
          drinking: (candidateRow as CandidateProfile).drinking,
          smoking: (candidateRow as CandidateProfile).smoking,
          district: (candidateRow as CandidateProfile).district,
          zodiac_sign: (candidateRow as CandidateProfile).zodiac_sign,
          favorite_spots: parseFavoriteSpots((candidateRow as CandidateProfile).favorite_spots),
          meeting_environment: (candidateRow as CandidateProfile).meeting_environment,
        };
        // Real reasons only — no RPC-captured `reasons` are recoverable here
        // (the RPC never persists them to the `matches` row and excludes
        // already-matched pairs from its own results, same limitation
        // documented in lib/matchReason.ts), so this screen always uses the
        // fallback mirror. Ready cards may show a real RPC reason instead
        // when freshly backfilled — both paths share the exact same
        // priority/field-comparison logic in lib/matchReason.ts, so they
        // never disagree, just sometimes draw from a different moment.
        setReasons(computeFallbackReasons(meCompare, themCompare));

        setLoading(false);
      })();

      return () => {
        mounted = false;
      };
    }, [matchUserId, matchId]),
  );

  if (loading) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <BackBar onBack={() => router.back()} />
        <View style={styles.centerWrap} />
      </View>
    );
  }

  if (notFound || !candidate || !match) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <BackBar onBack={() => router.back()} />
        <View style={styles.centerWrap}>
          <Ionicons name="person-outline" size={36} color={homeColors.textSecondary} />
          <ThemedText style={styles.emptyTitle}>This profile isn&apos;t available</ThemedText>
        </View>
      </View>
    );
  }

  const name = candidate.first_name?.trim() || 'Someone';
  const age = hingeSafeAge(candidate.date_of_birth);
  const photos = (candidate.photos ?? []).filter((p) => p?.trim());
  const photoUrl = photos.length > 0 ? getProfilePhotoPublicUrl(photos[0]) : null;
  const matchPercentage = Math.round(match.match_score);

  const isExpired = !!match.expires_at && new Date(match.expires_at).getTime() < Date.now();
  const alreadyInvited = match.invited_by === myUserId;
  const invitedByThem = !!match.invited_by && match.invited_by !== myUserId;

  const availabilityChip = buildAvailabilityChip(candidate.availability_days);
  const aboutChips: ProfileChip[] = [
    ...buildAboutMeChips(candidate as unknown as HingeProfilePerson),
    ...(availabilityChip ? [availabilityChip] : []),
  ];
  const lookingForChips = buildLookingForChips({ ...(candidate as unknown as HingeProfilePerson), intent });
  const interestChips = buildInterestChips(candidate as unknown as HingeProfilePerson);
  const promptCards = buildPromptCards(candidate as unknown as HingeProfilePerson).filter(
    (c) => c.id !== 'spot' && c.id !== 'hangout',
  );
  const hasTaste = !!(candidate.favorite_music?.trim() || candidate.favorite_movie?.trim() || candidate.favorite_book?.trim());
  const location = buildLocationSummary(candidate, viewerCity);

  function handlePlanADate() {
    router.push({
      pathname: '/micro-intro',
      params: {
        matchUserId,
        matchName: name,
        matchAge: age > 0 ? String(age) : '',
        matchCity: candidate?.city ?? '',
        matchPhoto: photoUrl ?? '',
        matchPercentage: String(matchPercentage),
        matchId,
      },
    });
  }

  return (
    <View style={styles.root}>
      <View style={[styles.backBarFloating, { top: insets.top + 8 }]}>
        <BackBar onBack={() => router.back()} floating />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.heroWrap}>
          {photoUrl ? (
            <Image
              source={{ uri: photoUrl }}
              style={styles.heroImage}
              contentFit="cover"
              contentPosition="top"
            />
          ) : (
            <View style={[styles.heroImage, styles.heroFallback]}>
              <ThemedText style={styles.heroFallbackInitial}>{name.charAt(0).toUpperCase()}</ThemedText>
            </View>
          )}
        </View>

        <View style={styles.heroInfoBlock}>
          <ThemedText style={styles.name}>
            {name}
            {age > 0 ? `, ${age}` : ''}
          </ThemedText>
          <MatchScoreBadge percentage={matchPercentage} />
        </View>

        <WhyYouMatchCard reasons={reasons} />

        <SectionCard title={`About ${name}`}>
          <ChipGrid chips={aboutChips} />
        </SectionCard>

        {lookingForChips.length > 0 ? (
          <SectionCard title="Looking for">
            <ChipGrid chips={lookingForChips} />
          </SectionCard>
        ) : null}

        {interestChips.length > 0 ? (
          <SectionCard title="Interests">
            <ChipGrid chips={interestChips} />
          </SectionCard>
        ) : null}

        {hasTaste ? (
          <SectionCard title="Taste">
            <View style={{ gap: 8 }}>
              {candidate.favorite_music?.trim() ? (
                <TasteRow icon="musical-notes-outline" text={candidate.favorite_music} />
              ) : null}
              {candidate.favorite_movie?.trim() ? (
                <TasteRow icon="film-outline" text={candidate.favorite_movie} />
              ) : null}
              {candidate.favorite_book?.trim() ? (
                <TasteRow icon="book-outline" text={candidate.favorite_book} />
              ) : null}
            </View>
          </SectionCard>
        ) : null}

        {promptCards.map((p) => (
          <SectionCard key={p.id} title={p.title}>
            <ThemedText style={styles.promptAnswer}>{p.answer}</ThemedText>
          </SectionCard>
        ))}

        {location ? (
          <SectionCard title="Location">
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={16} color={homeColors.accent} />
              <ThemedText style={styles.locationPrimary}>{location.primary}</ThemedText>
            </View>
            {location.secondary ? <ThemedText style={styles.locationSecondary}>{location.secondary}</ThemedText> : null}
          </SectionCard>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, homeSpacing.md) }]}>
        {invitedByThem ? (
          <View style={[styles.primaryBtn, styles.primaryBtnDisabled]}>
            <ThemedText style={styles.primaryBtnTextDisabled}>Review this in Activity</ThemedText>
          </View>
        ) : alreadyInvited ? (
          <View style={[styles.primaryBtn, styles.primaryBtnDisabled]}>
            <Ionicons name="time-outline" size={16} color={homeColors.textSecondary} />
            <ThemedText style={styles.primaryBtnTextDisabled}> Waiting for {name}</ThemedText>
          </View>
        ) : isExpired ? (
          <View style={[styles.primaryBtn, styles.primaryBtnDisabled]}>
            <ThemedText style={styles.primaryBtnTextDisabled}>Expired</ThemedText>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={handlePlanADate}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Plan a date">
            <ThemedText style={styles.primaryBtnText}>Plan a date</ThemedText>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function BackBar({ onBack, floating }: { onBack: () => void; floating?: boolean }) {
  return (
    <View style={floating ? styles.backBarInnerFloating : styles.backBarInner}>
      <TouchableOpacity
        style={styles.backBtn}
        onPress={onBack}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Back">
        <Ionicons name="chevron-back" size={24} color={floating ? '#FFFFFF' : homeColors.textPrimary} />
      </TouchableOpacity>
    </View>
  );
}

function TasteRow({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.tasteRow}>
      <Ionicons name={icon} size={16} color={homeColors.accent} />
      <ThemedText style={styles.tasteText}>{text}</ThemedText>
    </View>
  );
}

/** Bumble-style section card, Matches' own Warm Editorial palette
 * (`homeColors`) — deliberately NOT the shared `SectionCard` from
 * `components/profile/HingeProfileCard.tsx`, which is styled for the
 * app-wide black-identity palette (`colors` from designTokens.ts). Same
 * split Home's redesign already established: a shared component used by
 * two different visual systems either forces one to compromise or grows a
 * theme-switch prop; a small parallel component is simpler than either. */
function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.sectionCard}>
      <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
      {children}
    </View>
  );
}

function ChipGrid({ chips }: { chips: ProfileChip[] }) {
  return (
    <View style={styles.chipRow}>
      {chips.map((c) => (
        <View key={c.key} style={styles.chip}>
          {c.emoji ? (
            <ThemedText style={styles.chipEmoji}>{c.emoji}</ThemedText>
          ) : (
            <Ionicons name={c.icon} size={14} color={homeColors.textPrimary} />
          )}
          <ThemedText style={styles.chipText}>{c.label}</ThemedText>
        </View>
      ))}
    </View>
  );
}

/** Combines "My go-to spot" + "Where I hang out" + real district/city into
 * ONE real, district/city-level location line — never a precise location
 * (2026-09-19 brief: "Kullanıcının kesin konumunu gösterme"). */
function buildLocationSummary(
  candidate: CandidateProfile,
  viewerCity: string | null,
): { primary: string; secondary: string | null } | null {
  const spot = formatFavoriteSpots(candidate.favorite_spots);
  const district = candidate.district?.trim() || null;
  const city = candidate.city?.trim() || null;
  const primary = spot || district || city;
  if (!primary) return null;

  const sameCity = !!viewerCity && !!city && viewerCity.trim().toLowerCase() === city.toLowerCase();
  const primaryLine = sameCity && primary !== city ? `${primary} · nearby` : primary;
  const secondary = city && primary !== city ? `Lives in ${city}` : null;
  return { primary: primaryLine, secondary };
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: homeColors.background },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: homeColors.textPrimary, textAlign: 'center' },

  backBarFloating: { position: 'absolute', left: 8, zIndex: 10 },
  backBarInner: { paddingHorizontal: 8, paddingVertical: 6 },
  backBarInnerFloating: {},
  backBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },

  scrollContent: { paddingBottom: 32 },
  heroWrap: { width: '100%', height: HERO_HEIGHT },
  heroImage: { width: '100%', height: '100%' },
  heroFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: homeColors.mutedSurface },
  heroFallbackInitial: { fontSize: 64, fontWeight: '700', color: homeColors.textSecondary },

  heroInfoBlock: {
    paddingHorizontal: homeSpacing.lg,
    marginTop: homeSpacing.md,
    gap: 8,
  },
  // Explicit lineHeight — same missing-lineHeight bug class found
  // repeatedly elsewhere in this project (MatchesHeader's title,
  // ReadyMatchCard's name, etc.) — a real value here instead of relying on
  // ThemedText's default (24) happening to be enough at 26px/800.
  name: { fontSize: 26, lineHeight: 32, fontWeight: '800', color: homeColors.textPrimary },

  sectionCard: {
    marginHorizontal: homeSpacing.lg,
    marginTop: homeSpacing.lg,
    padding: homeSpacing.lg,
    borderRadius: homeRadius.card,
    backgroundColor: homeColors.surface,
    borderWidth: 1,
    borderColor: homeColors.border,
    ...homeShadow,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: homeColors.textPrimary, marginBottom: homeSpacing.sm + 2 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: homeColors.accentSoft,
    borderRadius: homeRadius.pill,
    paddingHorizontal: homeSpacing.sm + 2,
    paddingVertical: 7,
  },
  chipEmoji: { fontSize: 14 },
  chipText: { fontSize: 13, fontWeight: '600', color: homeColors.textPrimary },

  tasteRow: { flexDirection: 'row', alignItems: 'center', gap: homeSpacing.sm },
  tasteText: { fontSize: 14.5, fontWeight: '600', color: homeColors.textPrimary, flex: 1 },

  promptAnswer: { fontSize: 14.5, color: homeColors.textPrimary, lineHeight: 21 },

  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  locationPrimary: { fontSize: 15, fontWeight: '700', color: homeColors.textPrimary },
  locationSecondary: { fontSize: 13, color: homeColors.textSecondary, marginTop: 4 },

  footer: {
    paddingTop: 10,
    paddingHorizontal: homeSpacing.lg,
    backgroundColor: homeColors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: homeColors.border,
  },
  primaryBtn: {
    minHeight: 52,
    flexDirection: 'row',
    backgroundColor: homeColors.accent,
    borderRadius: homeRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnDisabled: { backgroundColor: homeColors.mutedSurface },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  primaryBtnTextDisabled: { color: homeColors.textSecondary, fontWeight: '700', fontSize: 15 },
});
