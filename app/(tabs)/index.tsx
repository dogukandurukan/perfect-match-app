// Screen: Ana sayfa sekmesi | Status: stable | Last updated: Mayıs 2026
import { DailyLimitEmptyState } from '@/components/DailyLimitEmptyState';
import { ErrorState } from '@/components/ErrorState';
import { HingeProfileCard, type NoteTarget } from '@/components/profile/HingeProfileCard';
import { ThemedText } from '@/components/themed-text';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { colors } from '@/lib/designTokens';
import { supabase } from '@/lib/supabaseClient';
import { getProfileSetupState, type ProfileSetupState } from '@/lib/profileCompletion';
import {
  DAILY_VIEW_LIMIT,
  getDailyViewsState,
  incrementDailyViews,
  remainingDailyViews,
  type DailyViewsState,
} from '@/lib/dailyViews';
import { parseFavoriteSpots, type HingeProfilePerson } from '@/lib/hingeProfile';
import { resolveProfilePhotoUrl } from '@/lib/userPhotosStorage';
import { Image } from 'expo-image';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_DISTANCE_THRESHOLD = SCREEN_WIDTH * 0.28;
const SWIPE_VELOCITY_THRESHOLD = 800;

const ACCENT = '#1A1A1A';

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

type FeedUser = HingeProfilePerson & {
  user_id: string;
  languages: string[] | null;
};

export default function HomeScreen() {
  const router = useRouter();

  const [profileState, setProfileState] = useState<ProfileSetupState | null>(null);
  const [checking, setChecking] = useState(true);
  const [activeMatch, setActiveMatch] = useState<ActiveMatch | null>(null);
  const [feedUsers, setFeedUsers] = useState<FeedUser[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedError, setFeedError] = useState(false);
  const [feedReloadKey, setFeedReloadKey] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [myCity, setMyCity] = useState<string | null>(null);
  const [dailyViews, setDailyViews] = useState<DailyViewsState | null>(null);
  // Bağlamlı beğeni (Bumble "Note") — UI-1 skeleton; DB yazımı Faz B'de `likes` tablosuna.
  const [noteTarget, setNoteTarget] = useState<NoteTarget | null>(null);
  const [noteText, setNoteText] = useState('');
  const [noteBanner, setNoteBanner] = useState<string | null>(null);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportReason, setReportReason] = useState('');

  const hasLoadedFeedRef = useRef(false);
  const feedResetAtRef = useRef<string | null>(null);

  // Swipe-to-decide (every dating app has this — user request, 2026-09-08).
  // Was buttons-only before.
  const cardTranslateX = useSharedValue(0);

  const cardSwipeStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: cardTranslateX.value },
      { rotate: `${cardTranslateX.value / 20}deg` },
    ],
  }));

  // Bumble-style decision stamp — derived straight from the drag distance
  // instead of a separate timed animation, so it appears mid-drag (not just
  // after release) and rides along with the card as it flies off, with the
  // next card's photo already visible underneath instead of a blank white
  // frame (previous full-screen white overlay covered everything including
  // the next card — user feedback with Bumble screenshots, 2026-09-07).
  const passStampStyle = useAnimatedStyle(() => {
    const progress = interpolate(cardTranslateX.value, [-SWIPE_DISTANCE_THRESHOLD, 0], [1, 0], Extrapolation.CLAMP);
    return {
      opacity: progress,
      transform: [{ translateX: (1 - progress) * 90 }, { scale: 0.5 + progress * 0.5 }],
    };
  });

  const likeStampStyle = useAnimatedStyle(() => {
    const progress = interpolate(cardTranslateX.value, [0, SWIPE_DISTANCE_THRESHOLD], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: progress,
      transform: [{ translateX: (1 - progress) * 90 }, { scale: 0.5 + progress * 0.5 }],
    };
  });

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

    if (rpcError) {
      throw rpcError;
    }

    if (!rpcData || !Array.isArray(rpcData) || rpcData.length === 0) {
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
          education: null,
          education_detail: null,
          occupation: null,
          zodiac_sign: null,
          gender: null,
          pets: null,
          religion: null,
          morning_night: null,
          core_value: null,
          impressed_by: null,
          favorite_activity: null,
          vibe: null,
          photo_verified: null,
          photoUrls,
        };
      }),
    );

    const { data: profileRows, error: profileError } = await supabase
      .from('profiles')
      .select(
        'id, languages, bio, first_date_expectation, favorite_spots, education, education_detail, occupation, zodiac_sign, gender, pets, religion, morning_night, core_value, impressed_by, favorite_activity, vibe, photo_verified',
      )
      .in('id', userIds);

    type ProfileExtraRow = {
      id: string;
      languages: string[] | null;
      bio: string | null;
      first_date_expectation: string | null;
      favorite_spots: Record<string, string> | null;
      education: string | null;
      education_detail: string | null;
      occupation: string | null;
      zodiac_sign: string | null;
      gender: string | null;
      pets: string | null;
      religion: string | null;
      morning_night: string | null;
      core_value: string | null;
      impressed_by: string | null;
      favorite_activity: string | null;
      vibe: string | null;
      photo_verified: boolean | null;
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
        education: null,
        education_detail: null,
        occupation: null,
        zodiac_sign: null,
        gender: null,
        pets: null,
        religion: null,
        morning_night: null,
        core_value: null,
        impressed_by: null,
        favorite_activity: null,
        vibe: null,
        photo_verified: null,
      }));
    }

    const profileMap = new Map(extras.map((row) => [row.id, row]));

    return mapped.map((u) => {
      const extra = profileMap.get(u.user_id);
      return {
        ...u,
        languages: extra?.languages ?? null,
        bio: extra?.bio ?? null,
        first_date_expectation: extra?.first_date_expectation ?? null,
        favorite_spots: parseFavoriteSpots(extra?.favorite_spots),
        education: extra?.education ?? null,
        education_detail: extra?.education_detail ?? null,
        occupation: extra?.occupation ?? null,
        zodiac_sign: extra?.zodiac_sign ?? null,
        gender: extra?.gender ?? null,
        pets: extra?.pets ?? null,
        religion: extra?.religion ?? null,
        morning_night: extra?.morning_night ?? null,
        core_value: extra?.core_value ?? null,
        impressed_by: extra?.impressed_by ?? null,
        favorite_activity: extra?.favorite_activity ?? null,
        vibe: extra?.vibe ?? null,
        photo_verified: extra?.photo_verified ?? null,
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
        setFeedError(false);
        try {
          const nextUsers = await loadFeed(user.id);
          if (!mounted) return;

          setFeedUsers(nextUsers);
          setCurrentIndex(0);
          setFeedLoading(false);
          hasLoadedFeedRef.current = true;
          feedResetAtRef.current = resetKey;
        } catch {
          if (!mounted) return;
          setFeedError(true);
          setFeedLoading(false);
        }
      })();
      return () => {
        mounted = false;
      };
    }, [refreshProfileState, loadFeed, feedReloadKey]),
  );

  const retryFeed = useCallback(() => {
    hasLoadedFeedRef.current = false;
    setFeedError(false);
    setFeedReloadKey((k) => k + 1);
  }, []);

  const advanceIndex = useCallback(() => {
    setCurrentIndex((i) => i + 1);
    setAnimating(false);
    cardTranslateX.value = 0;
  }, [cardTranslateX]);

  // Tek beğeni modeli — ❤ (profil) ve foto/prompt Note aynı `likes` satırını besler (§3/§5).
  // Kişi başına tek satır: upsert onConflict(liker_id,likee_id) → Note, ❤'in satırına hedef+not yazar.
  const recordLike = useCallback(
    async (
      likeeId: string,
      target: { type: 'photo' | 'prompt' | 'profile'; key: string | null; note?: string | null },
    ): Promise<boolean> => {
      if (!authUserId || !likeeId) return false;
      const { error } = await supabase.from('likes').upsert(
        {
          liker_id: authUserId,
          likee_id: likeeId,
          target_type: target.type,
          target_key: target.key,
          note: target.note?.trim() ? target.note.trim() : null,
          status: 'sent',
        },
        { onConflict: 'liker_id,likee_id' },
      );
      if (error) {
        console.warn('recordLike failed', error.message);
        return false;
      }
      return true;
    },
    [authUserId],
  );

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
      // Card has already flown off-screen by the time this runs (either the
      // gesture's own release animation or flyOffAndDecide for a button
      // tap) — advance straight away instead of a separate timed overlay.
      completePass();
    },
    [completePass],
  );

  const handleLike = useCallback(
    (userId: string) => {
      setAnimating(true);
      // Wait for the write before advancing — the card is already off-screen
      // visually, but a failed like shouldn't silently drop the profile from
      // the feed with no retry.
      void (async () => {
        const ok = await recordLike(userId, { type: 'profile', key: null });
        if (!ok) {
          Alert.alert('Could not send like', 'Please try again.');
          cardTranslateX.value = withSpring(0, { damping: 15 });
          setAnimating(false);
          return;
        }
        completeLike();
      })();
    },
    [cardTranslateX, completeLike, recordLike],
  );

  // Shared by both the swipe gesture's release and the ❤/✕ buttons — flies
  // the card off-screen (driving the stamp opacity via cardTranslateX along
  // the way) and only then runs the actual decision, so tapping a button
  // gets the same motion as a full swipe instead of an instant hard-cut.
  const flyOffAndDecide = useCallback(
    (direction: 1 | -1, userId: string) => {
      setAnimating(true);
      cardTranslateX.value = withTiming(
        direction * SCREEN_WIDTH * 1.5,
        { duration: 220 },
        (finished) => {
          if (!finished) return;
          if (direction > 0) runOnJS(handleLike)(userId);
          else runOnJS(handlePass)(userId);
        },
      );
    },
    [cardTranslateX, handleLike, handlePass],
  );

  const currentUser = feedUsers[currentIndex] ?? null;
  // Rendered as a static backdrop behind the swiping card so dragging/flying
  // the top card away reveals the next profile instead of blank white
  // (Bumble reference — user feedback, 2026-09-07).
  const nextUser = feedUsers[currentIndex + 1] ?? null;
  const likesLeft = remainingDailyViews(dailyViews);
  const likesLeftLabel = `${likesLeft} ${likesLeft === 1 ? 'like' : 'likes'} left today`;
  // Bumble-style horizontal progress bar instead of text (user request,
  // 2026-09-10) — fills as the daily like allowance gets used up.
  const likesUsedPct = Math.min(
    100,
    Math.max(0, ((dailyViews?.count ?? 0) / DAILY_VIEW_LIMIT) * 100),
  );

  // activeOffsetX/failOffsetY: only claim the gesture once movement is
  // clearly horizontal, otherwise fail immediately and let the ScrollView
  // (vertical scroll through About-me etc.) handle it — the standard
  // pattern for a swipeable card that also has scrollable content inside.
  const swipeGesture = Gesture.Pan()
    .enabled(!animating && !!currentUser)
    .activeOffsetX([-10, 10])
    .failOffsetY([-15, 15])
    .onUpdate((e) => {
      cardTranslateX.value = e.translationX;
    })
    .onEnd((e) => {
      const passedThreshold =
        Math.abs(e.translationX) > SWIPE_DISTANCE_THRESHOLD ||
        Math.abs(e.velocityX) > SWIPE_VELOCITY_THRESHOLD;
      if (!passedThreshold || !currentUser) {
        cardTranslateX.value = withSpring(0, { damping: 15 });
        return;
      }
      const direction = e.translationX > 0 ? 1 : -1;
      runOnJS(flyOffAndDecide)(direction, currentUser.user_id);
    });

  const handleOpenNote = useCallback((target: NoteTarget) => {
    setNoteText('');
    setNoteTarget(target);
  }, []);

  const handleSendNote = useCallback(() => {
    const target = noteTarget;
    const likeeId = currentUser?.user_id;
    const text = noteText;
    setNoteTarget(null);
    setNoteText('');
    if (!target || !likeeId) return;
    void (async () => {
      const ok = await recordLike(likeeId, { type: target.type, key: target.key, note: text });
      setNoteBanner(ok ? 'Like sent ✨' : 'Couldn’t send your like — try again');
      setTimeout(() => setNoteBanner(null), 2600);
      // completeLike() (kota düşür + feed ilerlet) sadece yazma başarılıysa —
      // önceden koşulsuz çağrılıyordu, başarısız Note kotayı boşuna düşürüp
      // kartı ilerletiyordu, tekrar deneme şansı olmadan (2026-08-31).
      if (ok) completeLike();
    })();
  }, [noteTarget, currentUser, noteText, recordLike, completeLike]);

  const handleBlockCurrentUser = useCallback(() => {
    if (!authUserId || !currentUser) return;
    const targetId = currentUser.user_id;
    const targetName = currentUser.first_name ?? 'this person';
    Alert.alert('Block', `Block ${targetName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Block',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase
            .from('blocks')
            .insert({ blocker_id: authUserId, blocked_id: targetId });
          if (error) {
            Alert.alert('Could not block', 'Please try again.');
            return;
          }
          advanceIndex();
        },
      },
    ]);
  }, [authUserId, currentUser, advanceIndex]);

  const handleSubmitReport = useCallback(() => {
    const targetId = currentUser?.user_id;
    const reason = reportReason.trim();
    if (!authUserId || !targetId || !reason) return;
    void (async () => {
      const { error } = await supabase
        .from('reports')
        .insert({ reporter_id: authUserId, reported_id: targetId, reason });
      setReportModalVisible(false);
      setReportReason('');
      if (error) {
        Alert.alert('Could not send report', 'Please try again.');
        return;
      }
      Alert.alert('Report sent', 'Thanks for letting us know.');
    })();
  }, [authUserId, currentUser, reportReason]);

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
      ) : feedError && feedUsers.length === 0 ? (
        <ErrorState onRetry={retryFeed} />
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
          {/* Sıradaki kişi — kart sürüklenip uçarken arkada gerçek bir foto
              görünsün diye (boş beyaz ekran yerine, Bumble referansı). */}
          {nextUser?.photoUrls[0] ? (
            <View style={styles.nextCardPeek} pointerEvents="none">
              <Image
                source={{ uri: nextUser.photoUrls[0] }}
                style={styles.nextCardPeekImage}
                contentFit="cover"
                contentPosition="top"
              />
            </View>
          ) : null}

          <View
            style={styles.likesLeftBar}
            accessibilityRole="progressbar"
            accessibilityLabel={likesLeftLabel}
            accessibilityValue={{ min: 0, max: DAILY_VIEW_LIMIT, now: dailyViews?.count ?? 0 }}>
            <View style={styles.likesLeftTrack}>
              <View style={[styles.likesLeftFill, { width: `${likesUsedPct}%` }]} />
            </View>
          </View>
          <GestureDetector gesture={swipeGesture}>
            <Animated.View style={[styles.swipeCard, cardSwipeStyle]}>
              {/* Bumble tarzı karar damgası — tam ekran beyaz overlay yerine
                  kartın kendisine binen, sürükleme mesafesiyle beliren rozet. */}
              <Animated.View style={[styles.decisionStamp, passStampStyle]} pointerEvents="none">
                <View style={styles.stampCircle}>
                  <Ionicons name="close" size={38} color="#1A1A1A" />
                </View>
              </Animated.View>
              <Animated.View style={[styles.decisionStamp, likeStampStyle]} pointerEvents="none">
                <View style={styles.stampCircle}>
                  <Ionicons name="heart" size={34} color="#FF3B5C" />
                </View>
              </Animated.View>
              <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}>
                <HingeProfileCard
                  person={currentUser}
                  viewerCity={myCity}
                  onNoteTarget={handleOpenNote}
                  heroFullScreen
                  footer={
                <View style={styles.footerActions}>
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={styles.passBtn}
                      activeOpacity={0.85}
                      disabled={animating}
                      accessibilityRole="button"
                      accessibilityLabel="Pass"
                      onPress={() => flyOffAndDecide(-1, currentUser.user_id)}>
                      <Text style={styles.passIcon}>✕</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.likeBtn}
                      activeOpacity={0.85}
                      disabled={animating}
                      accessibilityRole="button"
                      accessibilityLabel="Like"
                      onPress={() => flyOffAndDecide(1, currentUser.user_id)}>
                      <Text style={styles.likeIcon}>❤️</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    style={styles.blockLink}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Block this person"
                    onPress={handleBlockCurrentUser}>
                    <ThemedText style={styles.blockLinkText}>Block</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.reportLink}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Report this person"
                    onPress={() => setReportModalVisible(true)}>
                    <ThemedText style={styles.reportLinkText}>Report</ThemedText>
                  </TouchableOpacity>
                </View>
              }
                />
              </ScrollView>
            </Animated.View>
          </GestureDetector>

          {/* Bağlamlı beğeni (Note) skeleton toast */}
          {noteBanner ? (
            <View style={styles.noteToast} pointerEvents="none">
              <ThemedText style={styles.noteToastText}>{noteBanner}</ThemedText>
            </View>
          ) : null}
        </>
      )}

      {/* Note composer — foto/prompt beğen + opsiyonel yorum (Bumble like-with-comment) */}
      <Modal
        visible={noteTarget !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setNoteTarget(null)}>
        <KeyboardAvoidingView
          style={styles.noteBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.noteSheet}>
            <View style={styles.noteHandle} />
            <ThemedText style={styles.noteHeading}>
              {noteTarget?.type === 'prompt'
                ? `Note on “${noteTarget.label}”`
                : `Note on ${currentUser?.first_name ?? 'this profile'}’s photo`}
            </ThemedText>
            <ThemedText style={styles.noteSub}>
              Like it and say what caught your eye — the note’s optional.
            </ThemedText>
            <TextInput
              style={styles.noteInput}
              value={noteText}
              onChangeText={setNoteText}
              placeholder="Add a note…"
              placeholderTextColor="#9A9A9A"
              multiline
              maxLength={240}
              autoFocus
            />
            <ThemedText style={styles.noteCount}>{noteText.length}/240</ThemedText>
            <View style={styles.noteActions}>
              <TouchableOpacity
                style={styles.noteCancel}
                onPress={() => setNoteTarget(null)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Cancel note">
                <ThemedText style={styles.noteCancelText}>Cancel</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.noteSend}
                onPress={handleSendNote}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Send like with note">
                <Ionicons name="heart" size={18} color="#FFFFFF" />
                <ThemedText style={styles.noteSendText}>Send like</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Report modal — Home discovery kartından direkt (user-profile.tsx ile aynı desen) */}
      <Modal
        visible={reportModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setReportModalVisible(false)}>
        <KeyboardAvoidingView
          style={styles.noteBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.noteSheet}>
            <View style={styles.noteHandle} />
            <ThemedText style={styles.noteHeading}>Why are you reporting?</ThemedText>
            <TextInput
              style={styles.noteInput}
              value={reportReason}
              onChangeText={setReportReason}
              placeholder="Tell us briefly what happened…"
              placeholderTextColor="#9A9A9A"
              multiline
              autoFocus
            />
            <View style={styles.noteActions}>
              <TouchableOpacity
                style={styles.noteCancel}
                onPress={() => setReportModalVisible(false)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Cancel report">
                <ThemedText style={styles.noteCancelText}>Cancel</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.noteSend, !reportReason.trim() && styles.noteSendDisabled]}
                onPress={handleSubmitReport}
                disabled={!reportReason.trim()}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Send report">
                <ThemedText style={styles.noteSendText}>Send</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: 'flex-start' },
  feedRoot: { flex: 1, backgroundColor: '#FAFAFA' },
  likesLeftBar: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8E8E8',
  },
  likesLeftTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E8E8E8',
    overflow: 'hidden',
  },
  likesLeftFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: ACCENT,
  },
  // Opaque bg required — without it, a shorter profile (fewer chips/photos,
  // ScrollView content ending above the viewport bottom) let the
  // nextCardPeek backdrop bleed through the empty gap at rest, not just
  // during the horizontal swipe-away translation it's meant for (user
  // screenshot, 2026-09-09 — someone else's photo showing through under the
  // real X/❤/Block/Report footer). Matches feedRoot's own background so the
  // seam is invisible.
  swipeCard: { flex: 1, backgroundColor: '#FAFAFA' },
  scroll: { flex: 1 },
  // Was 120 — footerActions below (Block/Report) already adds its own
  // paddingBottom:24, so the two stacked left ~144px of dead space after
  // Report (user feedback, 2026-09-03).
  scrollContent: { paddingBottom: 24 },

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

  footerActions: {
    alignItems: 'center',
    paddingBottom: 24,
  },
  blockLink: { paddingVertical: 10 },
  blockLinkText: { fontSize: 14, fontWeight: '500', color: '#8A8A8A' },
  reportLink: { paddingVertical: 6 },
  reportLinkText: { fontSize: 14, fontWeight: '600', color: '#C0392B' },

  nextCardPeek: { ...StyleSheet.absoluteFillObject, backgroundColor: '#DDDDDD' },
  nextCardPeekImage: { width: '100%', height: SCREEN_HEIGHT * 0.7 },

  // Dead-center of the whole swipeable area (not pinned near the top) — a
  // fixed high offset kept landing on eyes/nose on portrait-framed photos
  // (user screenshot, 2026-09-08); vertical middle of the card is far more
  // likely to fall on neck/chest/background regardless of how the photo is
  // framed.
  decisionStamp: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  // Faint/glassy translucent circle (Bumble reference, 2026-09-08) — was an
  // opaque white pill with a hard 3px border, looked like a heavy sticker
  // instead of a soft, barely-there badge.
  stampCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.5)',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },

  noMoreWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  noMoreTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '600' },
  noMoreSubtitle: { color: '#999999', fontSize: 14, marginTop: 6, textAlign: 'center' },

  // Note composer (bağlamlı beğeni)
  noteBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  noteSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
    gap: 8,
  },
  noteHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E0E0E0',
    marginBottom: 8,
  },
  noteHeading: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  noteSub: { fontSize: 14, color: '#8A8A8A', lineHeight: 20 },
  noteInput: {
    marginTop: 8,
    minHeight: 88,
    borderRadius: 14,
    backgroundColor: '#F6F6F6',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.textPrimary,
    textAlignVertical: 'top',
  },
  noteCount: { alignSelf: 'flex-end', fontSize: 12, color: '#B0B0B0' },
  noteActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  noteCancel: {
    flex: 1,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F2F2',
  },
  noteCancelText: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  noteSend: {
    flex: 2,
    height: 50,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: ACCENT,
  },
  noteSendText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  noteSendDisabled: { opacity: 0.4 },
  noteToast: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 32,
    backgroundColor: 'rgba(30,30,30,0.92)',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
    alignItems: 'center',
    zIndex: 200,
  },
  noteToastText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600', textAlign: 'center' },
});
