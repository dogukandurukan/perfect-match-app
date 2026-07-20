// Screen: Ana sayfa sekmesi | Status: stable | Last updated: Mayıs 2026
import { DailyLimitEmptyState } from '@/components/DailyLimitEmptyState';
import { ThemedText } from '@/components/themed-text';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { colors } from '@/lib/designTokens';
import { supabase } from '@/lib/supabaseClient';
import { getProfileSetupState, type ProfileSetupState } from '@/lib/profileCompletion';
import {
  getDailyViewsState,
  incrementDailyViews,
  remainingDailyViews,
  type DailyViewsState,
} from '@/lib/dailyViews';
import { resolveProfilePhotoUrl } from '@/lib/userPhotosStorage';
import {
  formatAvailabilityLabel,
  formatDrinkingLabel,
  formatIntentLabel,
  formatSmokingLabel,
} from '@/lib/labels';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const PHOTO1_HEIGHT = SCREEN_HEIGHT * 0.55;
const ACCENT = '#B8860B';

type TopMatchRow = {
  user_id: string;
  first_name: string | null;
  date_of_birth: string | null;
  district: string | null;
  city: string | null;
  match_percentage: number;
  availability_days: string[] | null;
  drinking: string | null;
  smoking: string | null;
  hobbies: string[] | null;
  favorite_music: string | null;
  favorite_movie: string | null;
  favorite_book: string | null;
  photos: string[] | null;
};

type ActiveMatch = {
  matchId: string;
  firstName: string;
  status: 'pending' | 'accepted';
  isUserA: boolean;
  introAnswers: { kafe?: string; gun?: string; saat?: string } | null;
};

type FeedUser = {
  user_id: string;
  first_name: string | null;
  date_of_birth: string | null;
  district: string | null;
  city: string | null;
  match_percentage: number;
  intent: string | null;
  availability_days: string[] | null;
  drinking: string | null;
  smoking: string | null;
  languages: string[] | null;
  hobbies: string[] | null;
  favorite_music: string | null;
  favorite_movie: string | null;
  favorite_book: string | null;
  bio: string | null;
  first_date_expectation: string | null;
  favorite_spots: Record<string, string> | null;
  photoUrls: string[];
};

type PromptCard = {
  id: string;
  title: string;
  answer: string;
};

function safeAge(dob: string | null): number {
  if (!dob) return 0;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return 0;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return Math.max(0, age);
}

function formatFavoriteSpots(spots: Record<string, string> | null | undefined): string | null {
  if (!spots || typeof spots !== 'object') return null;
  const values = Object.values(spots)
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter((v) => v.length > 0);
  if (values.length === 0) return null;
  return values.join(' · ');
}

function isBogusLocationToken(raw: string): boolean {
  const lower = raw.toLowerCase();
  return /\d+\s*km/.test(lower) || lower.includes('fazla') || lower.includes('away');
}

/** Readable pin line — no raw distance junk. */
function formatFeedLocation(
  district: string | null | undefined,
  city: string | null | undefined,
  viewerCity: string | null | undefined,
): string | null {
  const dRaw = district?.trim() ?? '';
  const cRaw = city?.trim() ?? '';
  const d = dRaw && !isBogusLocationToken(dRaw) ? dRaw : '';
  const c = cRaw && !isBogusLocationToken(cRaw) ? cRaw : '';
  if (!d && !c) return null;

  const sameCity =
    !!viewerCity?.trim() &&
    !!c &&
    viewerCity.trim().toLowerCase() === c.toLowerCase();

  if (d && sameCity) return `📍 ${d} · nearby`;
  if (d && c) return `📍 ${d}, ${c}`;
  if (d) return `📍 ${d}`;
  return `📍 ${c}`;
}

/** Fixed prompt set — only filled profile fields become cards. */
function buildPromptCards(user: FeedUser): PromptCard[] {
  const cards: PromptCard[] = [];

  const idealDate = user.first_date_expectation?.trim() ?? '';
  if (idealDate) {
    cards.push({ id: 'ideal_date', title: 'My ideal date', answer: idealDate });
  }

  const about = user.bio?.trim() ?? '';
  if (about) {
    cards.push({ id: 'about', title: 'A little about me', answer: about });
  }

  const spot = formatFavoriteSpots(user.favorite_spots);
  if (spot) {
    cards.push({ id: 'spot', title: 'My go-to spot', answer: spot });
  }

  const hangout = user.district?.trim() ?? '';
  if (hangout && !isBogusLocationToken(hangout)) {
    cards.push({ id: 'hangout', title: 'Where I hang out', answer: hangout });
  }

  return cards;
}

function InfoLine({ icon, text }: { icon?: string; text: string }) {
  return (
    <View style={styles.infoLine}>
      {icon ? <Text style={styles.infoLineIcon}>{icon}</Text> : null}
      <ThemedText style={styles.infoLineText}>{text}</ThemedText>
    </View>
  );
}

function LifestyleChip({ label }: { label: string }) {
  return (
    <View style={styles.lifestyleChip}>
      <ThemedText style={styles.lifestyleChipText}>{label}</ThemedText>
    </View>
  );
}

function PromptBlock({ title, answer }: { title: string; answer: string }) {
  return (
    <View style={styles.promptCard}>
      <ThemedText style={styles.promptTitle}>{title}</ThemedText>
      <ThemedText style={styles.promptAnswer}>{answer}</ThemedText>
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();

  const [profileState, setProfileState] = useState<ProfileSetupState | null>(null);
  const [checking, setChecking] = useState(true);
  const [activeMatch, setActiveMatch] = useState<ActiveMatch | null>(null);
  const [feedUsers, setFeedUsers] = useState<FeedUser[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [myCity, setMyCity] = useState<string | null>(null);
  const [dailyViews, setDailyViews] = useState<DailyViewsState | null>(null);

  const hasLoadedFeedRef = useRef(false);
  const feedResetAtRef = useRef<string | null>(null);

  const passOverlayOpacity = useSharedValue(0);
  const likeOverlayOpacity = useSharedValue(0);

  const passOverlayStyle = useAnimatedStyle(() => ({
    opacity: passOverlayOpacity.value,
  }));

  const likeOverlayStyle = useAnimatedStyle(() => ({
    opacity: likeOverlayOpacity.value,
  }));

  const refreshProfileState = useCallback(async (): Promise<ProfileSetupState | null> => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setProfileState(null);
      setChecking(false);
      return null;
    }
    const state = await getProfileSetupState(user.id);
    if (state === 'setup1') router.replace('/profile-setup/step1');
    else if (state === 'setup2') router.replace('/profile-setup/step2');
    else if (state === 'setup3') router.replace('/profile-setup/step3');
    else if (state === 'setup4') router.replace('/profile-setup/step4');
    setProfileState(state);
    setChecking(false);
    return state;
  }, [router]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setProfileState(null);
        setChecking(false);
        return;
      }
      void refreshProfileState();
    });
    return () => subscription.unsubscribe();
  }, [refreshProfileState]);

  const loadFeed = useCallback(async (userId: string): Promise<FeedUser[]> => {
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_top_matches', {
      p_user_id: userId,
      p_limit: 10,
    });

    if (rpcError || !rpcData || !Array.isArray(rpcData) || rpcData.length === 0) {
      return [];
    }

    const rows = rpcData as TopMatchRow[];
    const userIds = rows.map((r) => r.user_id);

    const { data: intentRows } = await supabase
      .from('onboarding_answers')
      .select('user_id, intent')
      .in('user_id', userIds);

    const intentMap = new Map(
      (intentRows ?? []).map((row: { user_id: string; intent: string | null }) => [
        row.user_id,
        row.intent,
      ]),
    );

    const mapped: FeedUser[] = await Promise.all(
      rows.map(async (row) => {
        const photoUrls =
          row.photos && row.photos.length > 0
            ? await Promise.all(
                row.photos.map(async (path, i) => {
                  const url = await resolveProfilePhotoUrl(path, 3600);
                  return url ?? `https://i.pravatar.cc/300?u=${row.user_id}&n=${i}`;
                }),
              )
            : [`https://i.pravatar.cc/300?u=${row.user_id}`];

        return {
          user_id: row.user_id,
          first_name: row.first_name,
          date_of_birth: row.date_of_birth,
          district: row.district,
          city: row.city,
          match_percentage: row.match_percentage,
          intent: intentMap.get(row.user_id) ?? null,
          availability_days: row.availability_days,
          drinking: row.drinking,
          smoking: row.smoking,
          languages: null,
          hobbies: row.hobbies,
          favorite_music: row.favorite_music,
          favorite_movie: row.favorite_movie,
          favorite_book: row.favorite_book,
          bio: null,
          first_date_expectation: null,
          favorite_spots: null,
          photoUrls,
        };
      }),
    );

    const { data: profileRows, error: profileError } = await supabase
      .from('profiles')
      .select('id, languages, bio, first_date_expectation, favorite_spots')
      .in('id', userIds);

    type ProfileExtraRow = {
      id: string;
      languages: string[] | null;
      bio: string | null;
      first_date_expectation: string | null;
      favorite_spots: Record<string, string> | null;
    };

    let extras: ProfileExtraRow[] = [];

    if (!profileError && profileRows) {
      extras = profileRows as ProfileExtraRow[];
    } else {
      const { data: langRows } = await supabase
        .from('profiles')
        .select('id, languages')
        .in('id', userIds);
      extras = (langRows ?? []).map((row: { id: string; languages: string[] | null }) => ({
        id: row.id,
        languages: row.languages,
        bio: null,
        first_date_expectation: null,
        favorite_spots: null,
      }));
    }

    const profileMap = new Map(extras.map((row) => [row.id, row]));

    return mapped.map((u) => {
      const extra = profileMap.get(u.user_id);
      const spots = extra?.favorite_spots;
      const favoriteSpots =
        spots && typeof spots === 'object' && !Array.isArray(spots)
          ? (spots as Record<string, string>)
          : null;
      return {
        ...u,
        languages: extra?.languages ?? null,
        bio: extra?.bio ?? null,
        first_date_expectation: extra?.first_date_expectation ?? null,
        favorite_spots: favoriteSpots,
      };
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      (async () => {
        const state = await refreshProfileState();
        if (!mounted) return;

        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || state !== 'complete') return;

        setAuthUserId(user.id);

        const [{ data: meRow }, viewsState] = await Promise.all([
          supabase.from('profiles').select('city').eq('id', user.id).maybeSingle(),
          getDailyViewsState(user.id),
        ]);
        if (!mounted) return;
        setMyCity(typeof meRow?.city === 'string' ? meRow.city : null);
        setDailyViews(viewsState);

        const { data: accepted } = await supabase
          .from('matches')
          .select(
            'id, status, user_a_id, user_b_id, user_a_accepted, user_b_accepted, user_a_intro_answers, user_b_intro_answers, profiles!matches_user_b_id_fkey (first_name)',
          )
          .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
          .eq('status', 'accepted')
          .limit(1)
          .single();

        if (!mounted) return;

        if (accepted) {
          const isUserA = accepted.user_a_id === user.id;
          const otherProfile = accepted.profiles as { first_name?: string } | null;
          setActiveMatch({
            matchId: accepted.id,
            firstName: otherProfile?.first_name ?? 'Someone',
            status: 'accepted',
            isUserA,
            introAnswers: isUserA ? accepted.user_a_intro_answers : accepted.user_b_intro_answers,
          });
        } else {
          const { data: pending } = await supabase
            .from('matches')
            .select(
              'id, status, user_a_id, user_b_id, user_a_accepted, user_b_accepted, profiles!matches_user_b_id_fkey (first_name)',
            )
            .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
            .eq('status', 'pending')
            .eq('user_a_accepted', true)
            .limit(1)
            .single();

          if (!mounted) return;
          if (pending) {
            const isUserA = pending.user_a_id === user.id;
            const otherProfile = pending.profiles as { first_name?: string } | null;
            setActiveMatch({
              matchId: pending.id,
              firstName: otherProfile?.first_name ?? 'Someone',
              status: 'pending',
              isUserA,
              introAnswers: null,
            });
          } else {
            setActiveMatch(null);
          }
        }

        if (viewsState?.limitReached) {
          setFeedLoading(false);
          return;
        }

        const resetKey = viewsState?.resetAt ?? null;
        const dailyWindowChanged =
          feedResetAtRef.current !== null &&
          resetKey !== null &&
          feedResetAtRef.current !== resetKey;
        const shouldLoadFeed = !hasLoadedFeedRef.current || dailyWindowChanged;

        if (!shouldLoadFeed) return;

        setFeedLoading(true);
        const nextUsers = await loadFeed(user.id);
        if (!mounted) return;

        setFeedUsers(nextUsers);
        setCurrentIndex(0);
        setFeedLoading(false);
        hasLoadedFeedRef.current = true;
        feedResetAtRef.current = resetKey;
      })();
      return () => {
        mounted = false;
      };
    }, [refreshProfileState, loadFeed]),
  );

  const advanceIndex = useCallback(() => {
    setCurrentIndex((i) => i + 1);
    setAnimating(false);
    passOverlayOpacity.value = 0;
    likeOverlayOpacity.value = 0;
  }, [likeOverlayOpacity, passOverlayOpacity]);

  const completePass = useCallback(() => {
    advanceIndex();
  }, [advanceIndex]);

  const completeLike = useCallback(() => {
    void (async () => {
      if (authUserId) {
        const nextViews = await incrementDailyViews(authUserId);
        if (nextViews) setDailyViews(nextViews);
      }
      advanceIndex();
    })();
  }, [advanceIndex, authUserId]);

  const handlePass = useCallback(
    (userId: string) => {
      void userId;
      setAnimating(true);
      passOverlayOpacity.value = withSequence(
        withTiming(1, { duration: 300 }),
        withDelay(
          800,
          withTiming(0, { duration: 200 }, (finished) => {
            if (finished) runOnJS(completePass)();
          }),
        ),
      );
    },
    [completePass, passOverlayOpacity],
  );

  const handleLike = useCallback(
    (userId: string) => {
      void userId;
      setAnimating(true);
      likeOverlayOpacity.value = withSequence(
        withTiming(1, { duration: 300 }),
        withDelay(
          800,
          withTiming(0, { duration: 200 }, (finished) => {
            if (finished) runOnJS(completeLike)();
          }),
        ),
      );
    },
    [completeLike, likeOverlayOpacity],
  );

  const currentUser = feedUsers[currentIndex] ?? null;
  const likesLeft = remainingDailyViews(dailyViews);
  const likesLeftLabel = `${likesLeft} ${likesLeft === 1 ? 'like' : 'likes'} left today`;
  const prompts = currentUser ? buildPromptCards(currentUser) : [];
  const intentLabel = currentUser ? formatIntentLabel(currentUser.intent) : null;
  const availabilityLabel = currentUser
    ? formatAvailabilityLabel(currentUser.availability_days)
    : null;
  const drinkingLabel = currentUser ? formatDrinkingLabel(currentUser.drinking) : null;
  const smokingLabel = currentUser ? formatSmokingLabel(currentUser.smoking) : null;
  const locationLabel = currentUser
    ? formatFeedLocation(currentUser.district, currentUser.city, myCity)
    : null;
  const lifestyleChips = [availabilityLabel, drinkingLabel, smokingLabel].filter(
    (x): x is string => !!x,
  );
  const hasThingsInCommon = currentUser
    ? (currentUser.hobbies ?? []).length > 0 ||
      !!currentUser.favorite_music ||
      !!currentUser.favorite_movie ||
      !!currentUser.favorite_book
    : false;
  const extraPhotos = currentUser ? currentUser.photoUrls.slice(1) : [];
  const interleavedBlocks: { type: 'prompt' | 'photo'; key: string; prompt?: PromptCard; uri?: string }[] =
    [];
  if (currentUser) {
    const pairCount = Math.max(prompts.length, extraPhotos.length);
    for (let i = 0; i < pairCount; i += 1) {
      if (prompts[i]) {
        interleavedBlocks.push({
          type: 'prompt',
          key: `prompt-${prompts[i].id}`,
          prompt: prompts[i],
        });
      }
      if (extraPhotos[i]) {
        interleavedBlocks.push({
          type: 'photo',
          key: `photo-${i + 1}`,
          uri: extraPhotos[i],
        });
      }
    }
  }

  if (checking) {
    return (
      <View style={styles.loadingFeed}>
        <ActivityIndicator color={ACCENT} size="large" />
      </View>
    );
  }

  if (profileState === null) {
    return (
      <ScreenContainer style={styles.container}>
        <View style={styles.landingWrap}>
          <View style={styles.centerWrap}>
            <ThemedText type="title" style={styles.title}>
              Dating App
            </ThemedText>
            <ThemedText style={styles.subtitle}>Fewer swipes. Real meetups.</ThemedText>
          </View>

          <View style={styles.landingActions}>
            <TouchableOpacity
              style={styles.loginBtn}
              activeOpacity={0.85}
              onPress={() => router.push('/(auth)/login' as Parameters<typeof router.push>[0])}>
              <ThemedText style={styles.loginBtnText}>Log In</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.signUpBtn}
              activeOpacity={0.85}
              onPress={() => router.push('/(auth)/register' as Parameters<typeof router.push>[0])}>
              <ThemedText style={styles.signUpBtnText}>Sign Up</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </ScreenContainer>
    );
  }

  if (profileState !== 'complete') {
    return null;
  }

  return (
    <View style={styles.feedRoot}>
      {dailyViews?.limitReached ? (
        <DailyLimitEmptyState resetAt={dailyViews.resetAt} />
      ) : feedLoading && feedUsers.length === 0 ? (
        <View style={styles.loadingFeed}>
          <ActivityIndicator color={ACCENT} size="large" />
        </View>
      ) : !currentUser ? (
        <View style={styles.noMoreWrap}>
          <ThemedText style={styles.noMoreTitle}>That&apos;s everyone for today 🌙</ThemedText>
          <ThemedText style={styles.noMoreSubtitle}>Come back tomorrow for new faces</ThemedText>
        </View>
      ) : (
        <>
          <View style={styles.likesLeftBar}>
            <ThemedText style={styles.likesLeftText}>{likesLeftLabel}</ThemedText>
          </View>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}>
            {/* 1. Hero photo + name / intent */}
            <View style={styles.photo1Wrap}>
              <Image
                source={{ uri: currentUser.photoUrls[0] }}
                style={styles.photo1}
                contentFit="cover"
              />
              <View style={styles.nameOverlay}>
                <ThemedText style={styles.overlayName}>
                  {currentUser.first_name ?? 'Someone'}
                  {safeAge(currentUser.date_of_birth) > 0
                    ? `, ${safeAge(currentUser.date_of_birth)}`
                    : ''}
                </ThemedText>
                {intentLabel ? (
                  <ThemedText style={styles.intentHero}>{intentLabel}</ThemedText>
                ) : null}
              </View>
              <View style={styles.matchBadge}>
                <ThemedText style={styles.matchBadgeText}>
                  %{currentUser.match_percentage}
                </ThemedText>
              </View>
            </View>

            {/* 2. Things in common — top */}
            {hasThingsInCommon ? (
              <View style={styles.simCard}>
                <ThemedText style={styles.simCardTitle}>Things in common 🤝</ThemedText>
                {(currentUser.hobbies ?? []).length > 0 ? (
                  <View style={styles.chipRow}>
                    {(currentUser.hobbies ?? []).map((hobby) => (
                      <View key={hobby} style={styles.hobbyChip}>
                        <ThemedText style={styles.hobbyChipText}>{hobby}</ThemedText>
                      </View>
                    ))}
                  </View>
                ) : null}
                {currentUser.favorite_music ? (
                  <InfoLine icon="🎵" text={currentUser.favorite_music} />
                ) : null}
                {currentUser.favorite_movie ? (
                  <InfoLine icon="🎬" text={currentUser.favorite_movie} />
                ) : null}
                {currentUser.favorite_book ? (
                  <InfoLine icon="📚" text={currentUser.favorite_book} />
                ) : null}
              </View>
            ) : null}

            {/* 3. Lifestyle + location */}
            {lifestyleChips.length > 0 || locationLabel ? (
              <View style={styles.infoCard}>
                {lifestyleChips.length > 0 ? (
                  <View style={styles.chipRow}>
                    {lifestyleChips.map((label) => (
                      <LifestyleChip key={label} label={label} />
                    ))}
                  </View>
                ) : null}
                {locationLabel ? (
                  <ThemedText style={styles.locationText}>{locationLabel}</ThemedText>
                ) : null}
              </View>
            ) : null}

            {/* Actions */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.passBtn}
                activeOpacity={0.85}
                disabled={animating}
                onPress={() => handlePass(currentUser.user_id)}>
                <Text style={styles.passIcon}>✕</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.likeBtn}
                activeOpacity={0.85}
                disabled={animating}
                onPress={() => handleLike(currentUser.user_id)}>
                <Text style={styles.likeIcon}>❤️</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.starBtn} activeOpacity={0.85} disabled={animating}>
                <Text style={styles.starIcon}>⭐</Text>
              </TouchableOpacity>
            </View>

            {/* 4+. Prompt ↔ photo interleave */}
            {interleavedBlocks.map((block) =>
              block.type === 'prompt' && block.prompt ? (
                <PromptBlock
                  key={block.key}
                  title={block.prompt.title}
                  answer={block.prompt.answer}
                />
              ) : block.uri ? (
                <Image
                  key={block.key}
                  source={{ uri: block.uri }}
                  style={styles.inlinePhoto}
                  contentFit="cover"
                />
              ) : null,
            )}
          </ScrollView>

          {/* Pass animasyon overlay */}
          <Animated.View style={[styles.passOverlay, passOverlayStyle]} pointerEvents="none">
            <Text style={styles.passOverlayIcon}>✕</Text>
          </Animated.View>

          {/* Like animasyon overlay */}
          <Animated.View style={[styles.likeOverlay, likeOverlayStyle]} pointerEvents="none">
            <Text style={styles.likeOverlayIcon}>❤️</Text>
          </Animated.View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: 'flex-start' },
  feedRoot: { flex: 1, backgroundColor: '#FAFAFA' },
  likesLeftBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8E8E8',
  },
  likesLeftText: {
    fontSize: 14,
    fontWeight: '600',
    color: ACCENT,
    textAlign: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 120 },

  landingWrap: { flex: 1, justifyContent: 'space-between' },
  landingActions: { paddingHorizontal: 24, paddingBottom: 40, gap: 12 },
  loginBtn: {
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  loginBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  signUpBtn: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: ACCENT,
    paddingVertical: 14,
    alignItems: 'center',
  },
  signUpBtnText: { color: ACCENT, fontSize: 16, fontWeight: '600' },

  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  title: { fontSize: 28, fontWeight: '700', color: ACCENT, textAlign: 'center' },
  subtitle: { fontSize: 15, color: '#666', textAlign: 'center' },

  loadingFeed: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },

  photo1Wrap: {
    width: '100%',
    height: PHOTO1_HEIGHT,
    backgroundColor: '#DDDDDD',
    position: 'relative',
  },
  photo1: { width: '100%', height: '100%' },
  nameOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 6,
  },
  overlayName: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  intentHero: {
    color: ACCENT,
    fontSize: 17,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  matchBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: ACCENT,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  matchBadgeText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },

  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginHorizontal: 14,
    marginTop: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  lifestyleChip: {
    backgroundColor: '#F7F3EB',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  lifestyleChipText: { fontSize: 13, color: colors.textPrimary, fontWeight: '500' },
  locationText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    lineHeight: 22,
  },
  infoLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  infoLineIcon: { fontSize: 16, width: 24 },
  infoLineText: { flex: 1, fontSize: 14, color: colors.textPrimary, lineHeight: 20 },

  promptCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 14,
    marginTop: 14,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  promptTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888888',
    letterSpacing: 0.2,
  },
  promptAnswer: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    lineHeight: 26,
  },

  simCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 12,
    marginTop: 12,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  simCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  hobbyChip: {
    borderWidth: 1,
    borderColor: ACCENT,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  hobbyChipText: { color: ACCENT, fontSize: 13 },

  actionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
    paddingVertical: 18,
    marginHorizontal: 12,
  },
  passBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E8E8E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  passIcon: { fontSize: 28, color: '#888888' },
  likeBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  likeIcon: { fontSize: 32 },
  starBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E8E8E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  starIcon: { fontSize: 26 },

  inlinePhoto: {
    width: '100%',
    height: 300,
    marginTop: 14,
    backgroundColor: '#DDDDDD',
  },

  passOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  passOverlayIcon: { fontSize: 120, color: '#CCCCCC' },

  likeOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  likeOverlayIcon: { fontSize: 120 },

  noMoreWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  noMoreTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '600' },
  noMoreSubtitle: { color: '#999999', fontSize: 14, marginTop: 6, textAlign: 'center' },
});
