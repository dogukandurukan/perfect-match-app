// Screen: Kullanıcı profili (karşı taraf) | Status: stable | Last updated: Mayıs 2026
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { ChipGrid, SectionCard } from '@/components/profile/HingeProfileCard';
import { ThemedText } from '@/components/themed-text';
import { ErrorState } from '@/components/ErrorState';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { colors } from '@/lib/designTokens';
import {
  buildAboutMeChips,
  buildAvailabilityChip,
  buildInterestChips,
  buildLanguageChips,
  buildLookingForChips,
  type ChipIcon,
  type HingeProfilePerson,
  type ProfileChip,
} from '@/lib/hingeProfile';
import { supabase } from '@/lib/supabaseClient';
import { resolveProfilePhotoUrl } from '@/lib/userPhotosStorage';

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
function firstParam(val: string | string[] | undefined): string {
  if (Array.isArray(val)) return val[0] ?? '';
  return val ?? '';
}

type UserProfile = {
  first_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  zodiac_sign: string | null;
  city: string | null;
  district: string | null;
  gender: string | null;
  languages: string[] | null;
  meeting_preferences: string[] | null;
  photos: string[] | null;
  morning_night: string | null;
  recharge_style: string | null;
  hobbies: string[] | null;
  drinking: string | null;
  smoking: string | null;
  intent: string | null;
  education: string | null;
  religion: string | null;
  availability_days: string[] | null;
  availability_hours: string[] | null;
  meeting_environment: string[] | null;
  first_date_expectation: string | null;
  bio: string | null;
  favorite_music: string | null;
  favorite_movie: string | null;
  favorite_book: string | null;
  favorite_activity: string | null;
  core_value: string | null;
  impressed_by: string | null;
  dealbreaker: string | null;
  pets: string | null;
  vibe: string | null;
  photo_verified: boolean | null;
};

/** Ekranın tek geri-dönüş yolu — headerShown:false, başka bir nav kontrolü
 * yok (eskiden HomeTopIcon buradaydı ama Home'a değil "geri"ye gitmiyordu;
 * kaldırılınca ekranda hiç kontrol kalmasın diye gerçek bir geri ok eklendi,
 * 2026-09-04). */
function TopBackButton() {
  const router = useRouter();
  return (
    <TouchableOpacity
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
      style={styles.topBackBtn}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Back">
      <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
    </TouchableOpacity>
  );
}

/** Tek satır ikon+cümle kart (dealbreaker gibi tek-değerli alanlar). */
function IconNote({ icon, text }: { icon: ChipIcon; text: string }) {
  return (
    <View style={styles.iconNote}>
      <Ionicons name={icon} size={16} color={colors.textPrimary} />
      <ThemedText style={styles.iconNoteText}>{text}</ThemedText>
    </View>
  );
}

export default function UserProfileScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const userId = firstParam(params.userId);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [blocked, setBlocked] = useState(false);
  const [matchStatus, setMatchStatus] = useState<'pending' | 'accepted' | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!userId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(false);

      try {
        const { data, error: profileError } = await supabase
          .from('profiles')
          .select(
            `
            first_name, last_name, date_of_birth, zodiac_sign,
            city, district, gender, languages, meeting_preferences, photos,
            morning_night, recharge_style, hobbies, drinking, smoking,
            education, religion, availability_days, availability_hours,
            meeting_environment, first_date_expectation, bio,
            favorite_music, favorite_movie, favorite_book, favorite_activity,
            core_value, impressed_by, dealbreaker, pets, vibe, photo_verified
          `,
          )
          .eq('id', userId)
          .single();

        if (!mounted) return;
        if (profileError || !data) {
          setError(true);
          setLoading(false);
          return;
        }

        // `intent` lives on onboarding_answers, not profiles (see index/profile screens)
        const { data: intentData } = await supabase
          .from('onboarding_answers')
          .select('intent')
          .eq('user_id', userId)
          .maybeSingle();

        if (!mounted) return;
        setProfile({ ...(data as UserProfile), intent: intentData?.intent ?? null });

        if (data.photos && data.photos.length > 0) {
          const urls = await Promise.all(
            data.photos.map(async (path: string) => {
              const signed = await resolveProfilePhotoUrl(path, 3600);
              return signed ?? `https://i.pravatar.cc/300?u=${userId}`;
            }),
          );
          if (mounted) setPhotoUrls(urls);
        } else {
          if (mounted) setPhotoUrls([`https://i.pravatar.cc/300?u=${userId}`]);
        }

        if (mounted) setLoading(false);
      } catch {
        if (mounted) {
          setError(true);
          setLoading(false);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [userId, reloadKey]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null);
    });
  }, []);

  useEffect(() => {
    if (!currentUserId || !userId) return;
    let mounted = true;
    (async () => {
      const { data: matchData } = await supabase
        .from('matches')
        .select('status')
        .or(
          `and(user_a_id.eq.${currentUserId},user_b_id.eq.${userId}),` +
            `and(user_a_id.eq.${userId},user_b_id.eq.${currentUserId})`,
        )
        .in('status', ['pending', 'accepted'])
        .maybeSingle();

      if (mounted) setMatchStatus((matchData?.status as 'pending' | 'accepted') ?? null);
    })();
    return () => {
      mounted = false;
    };
  }, [currentUserId, userId]);

  async function handleBlock() {
    if (!currentUserId || !userId) return;
    Alert.alert(
      'Block',
      `Block ${profile?.first_name ?? 'this person'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('blocks').insert({
              blocker_id: currentUserId,
              blocked_id: userId,
            });
            if (error) {
              Alert.alert('Could not block', 'Please try again.');
              return;
            }
            setBlocked(true);
            Alert.alert('Blocked', "You won't see this person anymore.");
          },
        },
      ],
    );
  }

  async function handleReport() {
    if (!currentUserId || !userId || !reportReason.trim()) return;
    const { error } = await supabase.from('reports').insert({
      reporter_id: currentUserId,
      reported_id: userId,
      reason: reportReason.trim(),
    });
    setReportModalVisible(false);
    setReportReason('');
    if (error) {
      Alert.alert('Could not send report', 'Please try again.');
      return;
    }
    Alert.alert('Report sent', 'Thanks for letting us know.');
  }

  if (loading) {
    return (
      <ScreenContainer style={styles.container}>
        <TopBackButton />
        <ActivityIndicator color={colors.accent} style={styles.loader} />
      </ScreenContainer>
    );
  }

  if (error || !profile) {
    return (
      <ScreenContainer style={styles.container}>
        <TopBackButton />
        <ErrorState onRetry={() => setReloadKey((k) => k + 1)} />
      </ScreenContainer>
    );
  }

  const age = safeAge(profile?.date_of_birth ?? null);

  // Home'daki (HingeProfileCard) aynı ikonlu chip sistemi — burada da tekrar kullanılıyor.
  const chipPerson: HingeProfilePerson = {
    first_name: profile.first_name,
    date_of_birth: profile.date_of_birth,
    district: profile.district,
    city: profile.city,
    intent: profile.intent,
    availability_days: profile.availability_days,
    drinking: profile.drinking,
    smoking: profile.smoking,
    hobbies: profile.hobbies,
    favorite_music: profile.favorite_music,
    favorite_movie: profile.favorite_movie,
    favorite_book: profile.favorite_book,
    bio: profile.bio,
    first_date_expectation: profile.first_date_expectation,
    favorite_spots: null,
    education: profile.education,
    zodiac_sign: profile.zodiac_sign,
    gender: profile.gender,
    pets: profile.pets,
    religion: profile.religion,
    morning_night: profile.morning_night,
    core_value: profile.core_value,
    impressed_by: profile.impressed_by,
    favorite_activity: profile.favorite_activity,
    vibe: profile.vibe,
    languages: profile.languages,
    photo_verified: profile.photo_verified,
    photoUrls,
  };
  const aboutMeChips: ProfileChip[] = [];
  const availabilityChip = buildAvailabilityChip(profile.availability_days);
  if (availabilityChip) aboutMeChips.push(availabilityChip);
  aboutMeChips.push(...buildAboutMeChips(chipPerson));
  const lookingForChips = buildLookingForChips(chipPerson);
  const interestChips = buildInterestChips(chipPerson);
  const languageChips = buildLanguageChips(profile.languages);
  const favoriteChips: ProfileChip[] = [];
  if (profile.favorite_music?.trim())
    favoriteChips.push({ key: 'music', icon: 'musical-notes-outline', label: profile.favorite_music.trim() });
  if (profile.favorite_movie?.trim())
    favoriteChips.push({ key: 'movie', icon: 'film-outline', label: profile.favorite_movie.trim() });
  if (profile.favorite_book?.trim())
    favoriteChips.push({ key: 'book', icon: 'book-outline', label: profile.favorite_book.trim() });
  const meetingChips: ProfileChip[] = (profile.meeting_environment ?? [])
    .map((m) => m?.trim())
    .filter((m): m is string => !!m)
    .map((m) => ({ key: `meet-${m}`, icon: 'cafe-outline' as ChipIcon, label: m }));

  return (
    <ScreenContainer style={styles.container}>
      <TopBackButton />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Fotoğraflar */}
        <View style={styles.photoWrap}>
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
            {photoUrls.map((url, idx) => (
              <Image key={idx} source={{ uri: url }} style={styles.photo} contentFit="cover" />
            ))}
          </ScrollView>
          {photoUrls.length > 1 && (
            <View style={styles.photoDots}>
              {photoUrls.map((_, idx) => (
                <View key={idx} style={styles.photoDot} />
              ))}
            </View>
          )}
        </View>

        {/* İsim + konum */}
        <View style={styles.headerWrap}>
          <ThemedText style={styles.name}>
            {profile?.first_name ?? ''} {profile?.last_name ?? ''}
            {age > 0 ? `, ${age}` : ''}
          </ThemedText>
          <ThemedText style={styles.location}>
            📍 {profile?.district ?? profile?.city ?? 'Unknown'}
          </ThemedText>
        </View>

        {/* Bio */}
        {profile?.bio ? (
          <View style={styles.bioWrap}>
            <ThemedText style={styles.bioText}>{profile.bio}</ThemedText>
          </View>
        ) : null}

        {aboutMeChips.length > 0 ? (
          <SectionCard title="About me">
            <ChipGrid chips={aboutMeChips} />
          </SectionCard>
        ) : null}

        {lookingForChips.length > 0 ? (
          <SectionCard title="I'm looking for">
            <ChipGrid chips={lookingForChips} />
          </SectionCard>
        ) : null}

        {interestChips.length > 0 ? (
          <SectionCard title="My interests">
            <ChipGrid chips={interestChips} />
          </SectionCard>
        ) : null}

        {languageChips.length > 0 ? (
          <SectionCard title="Languages">
            <ChipGrid chips={languageChips} />
          </SectionCard>
        ) : null}

        {favoriteChips.length > 0 ? (
          <SectionCard title="Favorites">
            <ChipGrid chips={favoriteChips} />
          </SectionCard>
        ) : null}

        {meetingChips.length > 0 ? (
          <SectionCard title="Meeting vibe">
            <ChipGrid chips={meetingChips} />
          </SectionCard>
        ) : null}

        {profile?.dealbreaker?.trim() ? (
          <SectionCard title="Dealbreaker">
            <IconNote icon="flag-outline" text={profile.dealbreaker.trim()} />
          </SectionCard>
        ) : null}

        {profile?.first_date_expectation ? (
          <SectionCard title="First meeting">
            <View style={styles.bioWrap}>
              <ThemedText style={styles.bioText}>{profile.first_date_expectation}</ThemedText>
            </View>
          </SectionCard>
        ) : null}
      </ScrollView>

      {!blocked && (matchStatus === 'accepted' || matchStatus === 'pending') && (
        <View style={styles.actionsWrap}>
          {matchStatus === 'accepted' ? (
            <TouchableOpacity
              style={styles.messageBtn}
              onPress={() =>
                router.push({
                  pathname: '/chat',
                  params: {
                    userId,
                    userName: profile?.first_name ?? '',
                  },
                })
              }
              accessibilityRole="button"
              accessibilityLabel="Send message">
              <Ionicons name="chatbubble-outline" size={16} color="#FFFFFF" />
              <ThemedText style={styles.messageBtnText}>Send message</ThemedText>
            </TouchableOpacity>
          ) : (
            <View style={styles.pendingRow}>
              <Ionicons name="time-outline" size={15} color={colors.textMuted} />
              <ThemedText style={styles.pendingText}>Invite sent</ThemedText>
            </View>
          )}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.reportBtn}
              onPress={() => setReportModalVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Report this person">
              <Ionicons name="warning-outline" size={15} color={colors.textPrimary} />
              <ThemedText style={styles.reportBtnText}>Report</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.blockBtn}
              onPress={handleBlock}
              accessibilityRole="button"
              accessibilityLabel="Block this person">
              <Ionicons name="ban-outline" size={15} color="#C0392B" />
              <ThemedText style={styles.blockBtnText}>Block</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <Modal
        visible={reportModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setReportModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ThemedText style={styles.modalTitle}>Why are you reporting?</ThemedText>
            <TextInput
              style={styles.modalInput}
              placeholder="Tell us briefly what happened…"
              placeholderTextColor="#AAA"
              value={reportReason}
              onChangeText={setReportReason}
              multiline
              numberOfLines={4}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setReportModalVisible(false)}>
                <ThemedText style={styles.modalCancelText}>Cancel</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSendBtn, !reportReason.trim() && { opacity: 0.4 }]}
                onPress={handleReport}
                disabled={!reportReason.trim()}>
                <ThemedText style={styles.modalSendText}>Send</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: 'flex-start' },
  topBackBtn: { marginBottom: 8, alignSelf: 'flex-start' },
  loader: { marginTop: 40 },
  content: { paddingBottom: 48, gap: 20 },

  photoWrap: {
    width: '100%',
    height: 320,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#DDD',
  },
  photo: { width: 350, height: 320 },
  photoDots: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  photoDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },

  headerWrap: { alignItems: 'center', gap: 4 },
  name: { fontSize: 24, fontWeight: '700', color: colors.textPrimary },
  location: { fontSize: 14, color: '#888' },

  bioWrap: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  bioText: { fontSize: 15, color: colors.textPrimary, lineHeight: 22 },

  iconNote: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconNoteText: { fontSize: 14, color: colors.textPrimary, flexShrink: 1 },

  actionsWrap: {
    gap: 8,
    paddingTop: 8,
    paddingBottom: 32,
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  pendingText: { color: '#888', fontSize: 14 },
  messageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
  },
  messageBtnText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 4,
  },
  reportBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#E8A000',
    borderRadius: 12,
    paddingVertical: 12,
  },
  reportBtnText: { color: colors.textPrimary, fontWeight: '600', fontSize: 14 },
  blockBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#E05555',
    borderRadius: 12,
    paddingVertical: 12,
  },
  blockBtnText: { color: '#C0392B', fontWeight: '600', fontSize: 14 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    gap: 16,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  modalInput: {
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: colors.textPrimary,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalCancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCancelText: { color: '#888', fontWeight: '600' },
  modalSendBtn: {
    flex: 1,
    backgroundColor: '#E05555',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalSendText: { color: '#FFF', fontWeight: '700' },
});
