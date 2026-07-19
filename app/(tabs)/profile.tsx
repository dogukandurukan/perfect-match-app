// Screen: Profil sekmesi | Status: stable | Last updated: Mayıs 2026
import type { IntentKey } from '@/lib/onboardingIntent';
import { useCallback, useState } from 'react';
import {
  Alert,
  Dimensions,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { HomeTopIcon } from '@/components/ui/HomeTopIcon';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { supabase } from '@/lib/supabaseClient';
import { resolveProfilePhotoUrl } from '@/lib/userPhotosStorage';

const ACCENT = '#B8860B';
const PHOTO_HEIGHT = 420;
const screenWidth = Dimensions.get('window').width;

const INTENT_LABELS: Record<IntentKey, string> = {
  just_friends: '👋 Just friends',
  keeping_it_casual: '✨ Something casual',
  open_to_relationship: '❤️ Open to something real',
  not_sure_yet: '🤔 Figuring it out',
};

const MEETING_PREF_LABELS: Record<string, string> = {
  Men: '👨 Men',
  Women: '👩 Women',
  'Non-binary': '🏳️‍🌈 Non-binary',
  Everyone: '💫 Everyone',
};

const ZODIAC_EMOJI: Record<string, string> = {
  Aries: '♈',
  Taurus: '♉',
  Gemini: '♊',
  Cancer: '♋',
  Leo: '♌',
  Virgo: '♍',
  Libra: '♎',
  Scorpio: '♏',
  Sagittarius: '♐',
  Capricorn: '♑',
  Aquarius: '♒',
  Pisces: '♓',
};

type Profile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  city: string | null;
  district: string | null;
  gender: string | null;
  languages: string[] | null;
  meeting_preferences: string[] | null;
  photos: string[] | null;
  bio: string | null;
  morning_night: string | null;
  recharge_style: string | null;
  hobbies: string[] | null;
  drinking: string | null;
  smoking: string | null;
  education: string | null;
  education_detail: string | null;
  religion: string | null;
  availability_days: string[] | null;
  availability_hours: string[] | null;
  meeting_environment: string[] | null;
  favorite_spots: Record<string, string> | null;
  first_date_expectation: string | null;
  preferred_locations: string[] | null;
  favorite_music: string | null;
  favorite_movie: string | null;
  favorite_book: string | null;
  favorite_activity: string | null;
  zodiac_sign: string | null;
  core_value: string | null;
  impressed_by: string | null;
  dealbreaker: string | null;
  setup_completed: boolean | null;
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

function intentLabel(intent: string | null): string | null {
  if (!intent) return null;
  return INTENT_LABELS[intent as IntentKey] ?? intent;
}

function meetingPrefLabel(pref: string): string {
  return MEETING_PREF_LABELS[pref] ?? pref;
}

function formatLocation(district: string | null, city: string | null): string | null {
  const parts = [district, city].filter(Boolean);
  if (parts.length === 0) return null;
  return parts.join(' • ');
}

function formatEducationDisplay(education: string | null, detail: string | null): string | null {
  if (detail?.trim()) return detail.trim();
  if (education) return education;
  return null;
}

function zodiacLine(sign: string | null): InfoLine | null {
  if (!sign) return null;
  return {
    emoji: ZODIAC_EMOJI[sign] ?? '♑',
    label: 'Zodiac',
    value: sign,
  };
}

function formatDrinkSmoke(drinking: string | null, smoking: string | null): string | null {
  if (!drinking && !smoking) return null;
  const parts: string[] = [];
  if (drinking) parts.push(drinking);
  if (smoking) parts.push(smoking);
  return parts.join(' • ');
}

function parseCommaField(val: string | null): string[] {
  if (!val?.trim()) return [];
  return val
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

type InfoLine = { emoji: string; label: string; value: string };

function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function SectionHeading({ title }: { title: string }) {
  return <ThemedText style={styles.sectionHeading}>{title}</ThemedText>;
}

function InfoDividerRow({ emoji, label, value, isLast }: InfoLine & { isLast?: boolean }) {
  return (
    <View style={[styles.infoLine, isLast && styles.infoLineLast]}>
      <ThemedText style={styles.infoLineLabel}>
        {emoji} {label}
      </ThemedText>
      <ThemedText style={styles.infoLineValue}>{value}</ThemedText>
    </View>
  );
}

function IntentChip({ label }: { label: string }) {
  return (
    <View style={styles.intentChip}>
      <ThemedText style={styles.intentChipText}>{label}</ThemedText>
    </View>
  );
}

function InterestChip({ label }: { label: string }) {
  return (
    <View style={styles.interestChip}>
      <ThemedText style={styles.interestChipText}>{label}</ThemedText>
    </View>
  );
}

function AvailChip({ label }: { label: string }) {
  return (
    <View style={styles.availChip}>
      <ThemedText style={styles.availChipText}>{label}</ThemedText>
    </View>
  );
}

const PROFILE_SELECT = `
  id, first_name, last_name, date_of_birth, city, district,
  gender, meeting_preferences, languages, photos, bio,
  morning_night, recharge_style, hobbies, drinking, smoking,
  education, education_detail, religion,
  availability_days, availability_hours, meeting_environment,
  favorite_spots, first_date_expectation, preferred_locations,
  favorite_music, favorite_movie, favorite_book, favorite_activity,
  zodiac_sign, core_value, impressed_by, dealbreaker, setup_completed
`;

export default function ProfileTab() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [intent, setIntent] = useState<string | null>(null);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      (async () => {
        setLoading(true);
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || !mounted) {
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from('profiles')
          .select(PROFILE_SELECT)
          .eq('id', user.id)
          .single();

        if (!mounted) return;
        if (error || !data) {
          console.warn('[ProfileTab] profiles fetch failed', error);
          setLoading(false);
          return;
        }

        setProfile(data as Profile);

        const { data: intentData } = await supabase
          .from('onboarding_answers')
          .select('intent')
          .eq('user_id', user.id)
          .single();
        if (mounted) setIntent(intentData?.intent ?? null);

        try {
          if (data.photos && data.photos.length > 0) {
            const urls = await Promise.all(
              data.photos.map(async (path: string) => {
                const signed = await resolveProfilePhotoUrl(path, 3600);
                return signed ?? null;
              }),
            );
            if (mounted) setPhotoUrls(urls.filter((u): u is string => !!u));
          } else if (mounted) {
            setPhotoUrls([]);
          }
        } catch (photoErr) {
          console.warn('[ProfileTab] photo URL resolve failed', photoErr);
          if (mounted) setPhotoUrls([]);
        }

        if (mounted) {
          setLoading(false);
        }
      })();
      return () => {
        mounted = false;
      };
    }, []),
  );

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace('/(auth)/login');
  }

  if (loading) {
    return (
      <ScreenContainer style={styles.screenFlush}>
        <View style={styles.topIconWrap}>
          <HomeTopIcon />
        </View>
      </ScreenContainer>
    );
  }

  const age = safeAge(profile?.date_of_birth ?? null);
  const displayName = [profile?.first_name, age > 0 ? String(age) : null].filter(Boolean).join(', ');
  const locationLine = formatLocation(profile?.district ?? null, profile?.city ?? null);
  const intentText = intentLabel(intent);

  const heroPhoto = photoUrls[0] ?? null;
  const inlinePhoto1 = photoUrls[1] ?? null;
  const inlinePhoto2 = photoUrls[2] ?? null;

  const infoLines: InfoLine[] = [];
  const zodiac = zodiacLine(profile?.zodiac_sign ?? null);
  if (zodiac) infoLines.push(zodiac);
  const eduVal = formatEducationDisplay(profile?.education ?? null, profile?.education_detail ?? null);
  if (eduVal) infoLines.push({ emoji: '🎓', label: 'Education', value: eduVal });
  if (profile?.religion) infoLines.push({ emoji: '✨', label: 'Beliefs', value: profile.religion });
  if (profile?.morning_night)
    infoLines.push({ emoji: '⏰', label: 'Schedule', value: profile.morning_night });
  if (profile?.recharge_style)
    infoLines.push({ emoji: '⚡', label: 'Recharge', value: profile.recharge_style });
  const drinkSmoke = formatDrinkSmoke(profile?.drinking ?? null, profile?.smoking ?? null);
  if (drinkSmoke) infoLines.push({ emoji: '🍺', label: 'Drinking & Smoking', value: drinkSmoke });
  if (profile?.languages?.length)
    infoLines.push({ emoji: '🌍', label: 'Languages', value: profile.languages.join(', ') });

  const aboutMeLines: InfoLine[] = [];
  if (profile?.core_value?.trim())
    aboutMeLines.push({ emoji: '❤️', label: 'What matters most', value: profile.core_value.trim() });
  if (profile?.impressed_by?.trim())
    aboutMeLines.push({ emoji: '✨', label: "I'm impressed by", value: profile.impressed_by.trim() });
  if (profile?.dealbreaker?.trim())
    aboutMeLines.push({ emoji: '🚫', label: 'Dealbreaker', value: profile.dealbreaker.trim() });
  const hasAboutMe = aboutMeLines.length > 0;

  const hobbyChips = [
    ...(profile?.hobbies ?? []),
    ...parseCommaField(profile?.favorite_activity ?? null),
  ].filter((item, idx, arr) => arr.indexOf(item) === idx);

  const tasteLines: InfoLine[] = [];
  if (profile?.favorite_music?.trim())
    tasteLines.push({ emoji: '🎵', label: 'Music', value: profile.favorite_music.trim() });
  if (profile?.favorite_movie?.trim())
    tasteLines.push({ emoji: '🎬', label: 'Movies & Shows', value: profile.favorite_movie.trim() });
  if (profile?.favorite_book?.trim())
    tasteLines.push({ emoji: '📚', label: 'Books', value: profile.favorite_book.trim() });

  const hasInterestsSection = hobbyChips.length > 0 || tasteLines.length > 0;

  const hasAvailability =
    (profile?.availability_days?.length ?? 0) > 0 ||
    (profile?.availability_hours?.length ?? 0) > 0 ||
    (profile?.preferred_locations?.length ?? 0) > 0 ||
    !!profile?.first_date_expectation;

  const showIntentSection =
    !!intentText || (profile?.meeting_preferences?.length ?? 0) > 0;

  return (
    <ScreenContainer style={styles.screenFlush}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Hero — photos[0] */}
        <View style={styles.photoSection}>
          <View style={styles.topIconWrap}>
            <HomeTopIcon />
          </View>

          {heroPhoto ? (
            <Image source={{ uri: heroPhoto }} style={styles.photo} contentFit="cover" />
          ) : (
            <View style={styles.photoPlaceholder} />
          )}

          <View pointerEvents="none" style={styles.photoOverlayText}>
            <ThemedText style={[styles.photoName, styles.photoTextShadow]}>
              {displayName || 'Profile'}
            </ThemedText>
            {locationLine ? (
              <View style={styles.photoLocationRow}>
                <Ionicons name="location-sharp" size={12} color="#FFFFFF" />
                <ThemedText style={[styles.photoLocation, styles.photoTextShadow]}>
                  {locationLine}
                </ThemedText>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.body}>
          {/* Intent + meeting chips */}
          {showIntentSection ? (
            <Card>
              <View style={styles.intentRow}>
                {intentText ? <IntentChip label={intentText} /> : null}
                {profile?.meeting_preferences?.map((pref) => (
                  <IntentChip key={pref} label={meetingPrefLabel(pref)} />
                ))}
              </View>
            </Card>
          ) : null}

          {/* Bio */}
          {profile?.bio ? (
            <Card>
              <ThemedText style={styles.bioText}>{profile.bio}</ThemedText>
            </Card>
          ) : null}

          {/* Bilgi satırları */}
          {infoLines.length > 0 ? (
            <Card style={styles.infoCard}>
              {infoLines.map((line, idx) => (
                <InfoDividerRow
                  key={`${line.label}-${idx}`}
                  {...line}
                  isLast={idx === infoLines.length - 1}
                />
              ))}
            </Card>
          ) : null}

          {/* photos[1] */}
          {inlinePhoto1 ? (
            <Image source={{ uri: inlinePhoto1 }} style={styles.inlinePhoto} contentFit="cover" />
          ) : null}

          {/* About Me */}
          {hasAboutMe ? (
            <View style={styles.sectionBlock}>
              <SectionHeading title="About Me" />
              <Card style={styles.infoCard}>
                {aboutMeLines.map((line, idx) => (
                  <InfoDividerRow
                    key={`${line.label}-${idx}`}
                    {...line}
                    isLast={idx === aboutMeLines.length - 1}
                  />
                ))}
              </Card>
            </View>
          ) : null}

          {/* photos[2] */}
          {inlinePhoto2 ? (
            <Image source={{ uri: inlinePhoto2 }} style={styles.inlinePhoto} contentFit="cover" />
          ) : null}

          {/* Interests & Taste */}
          {hasInterestsSection ? (
            <View style={styles.sectionBlock}>
              <SectionHeading title="Interests & Taste" />
              <Card>
                {hobbyChips.length > 0 ? (
                  <View style={styles.chipsWrap}>
                    {hobbyChips.map((h) => (
                      <InterestChip key={h} label={h} />
                    ))}
                  </View>
                ) : null}
                {tasteLines.length > 0 ? (
                  <View style={[styles.tasteLines, hobbyChips.length > 0 && styles.tasteLinesSpaced]}>
                    {tasteLines.map((line, idx) => (
                      <InfoDividerRow
                        key={`${line.label}-${idx}`}
                        {...line}
                        isLast={idx === tasteLines.length - 1}
                      />
                    ))}
                  </View>
                ) : null}
              </Card>
            </View>
          ) : null}

          {/* Availability */}
          {hasAvailability ? (
            <View style={styles.sectionBlock}>
              <SectionHeading title="Availability" />
              <Card style={styles.availCard}>
                {profile?.availability_days && profile.availability_days.length > 0 ? (
                  <View style={styles.availGroup}>
                    <ThemedText style={styles.availSubLabel}>Days</ThemedText>
                    <View style={styles.chipsWrap}>
                      {profile.availability_days.map((d) => (
                        <AvailChip key={d} label={d} />
                      ))}
                    </View>
                  </View>
                ) : null}

                {profile?.availability_hours && profile.availability_hours.length > 0 ? (
                  <View style={styles.availGroup}>
                    <ThemedText style={styles.availSubLabel}>Hours</ThemedText>
                    <View style={styles.chipsWrap}>
                      {profile.availability_hours.map((h) => (
                        <AvailChip key={h} label={h} />
                      ))}
                    </View>
                  </View>
                ) : null}

                {profile?.preferred_locations && profile.preferred_locations.length > 0 ? (
                  <View style={styles.availGroup}>
                    <ThemedText style={styles.availSubLabel}>Preferred Areas</ThemedText>
                    <View style={styles.chipsWrap}>
                      {profile.preferred_locations.map((loc) => (
                        <AvailChip key={loc} label={loc} />
                      ))}
                    </View>
                  </View>
                ) : null}

                {profile?.first_date_expectation ? (
                  <View style={[styles.availGroup, styles.availGroupLast]}>
                    <ThemedText style={styles.availSubLabel}>First meeting</ThemedText>
                    <ThemedText style={styles.expectationText}>
                      {profile.first_date_expectation}
                    </ThemedText>
                  </View>
                ) : null}
              </Card>
            </View>
          ) : null}

          {/* Hesap */}
          <View style={styles.accountBlock}>
            <TouchableOpacity
              style={styles.editBtn}
              activeOpacity={0.85}
              onPress={() => router.push('/profile-edit' as any)}>
              <ThemedText style={styles.editBtnText}>Edit Profile</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.signOutBtn}
              activeOpacity={0.85}
              onPress={() =>
                Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Sign Out', style: 'destructive', onPress: handleLogout },
                ])
              }>
              <ThemedText style={styles.signOutBtnText}>Sign Out</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const cardShadow = {
  shadowColor: '#000',
  shadowOpacity: 0.06,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
};

const styles = StyleSheet.create({
  screenFlush: {
    justifyContent: 'flex-start',
    paddingHorizontal: 0,
    paddingVertical: 0,
    backgroundColor: '#FAFAFA',
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  topIconWrap: {
    position: 'absolute',
    top: 8,
    left: 16,
    zIndex: 20,
  },
  body: {
    gap: 12,
    paddingTop: 12,
  },
  photoSection: {
    width: screenWidth,
    height: PHOTO_HEIGHT,
    backgroundColor: '#D8D8D8',
    position: 'relative',
  },
  photo: {
    width: screenWidth,
    height: PHOTO_HEIGHT,
  },
  photoPlaceholder: {
    width: screenWidth,
    height: PHOTO_HEIGHT,
    backgroundColor: '#D8D8D8',
  },
  photoOverlayText: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  photoTextShadow: {
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  photoName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  photoLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  photoLocation: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
  },
  inlinePhoto: {
    width: screenWidth - 32,
    height: 300,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#D8D8D8',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: 16,
    padding: 16,
    marginBottom: 0,
    ...cardShadow,
  },
  infoCard: {
    paddingVertical: 4,
  },
  sectionBlock: {
    marginBottom: 0,
  },
  sectionHeading: {
    color: ACCENT,
    fontWeight: '700',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  intentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  intentChip: {
    backgroundColor: '#F5F0E8',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  intentChipText: {
    color: ACCENT,
    fontWeight: '600',
    fontSize: 13,
  },
  bioText: {
    fontSize: 15,
    color: '#333333',
    lineHeight: 22,
  },
  infoLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5E5',
    gap: 12,
  },
  infoLineLast: {
    borderBottomWidth: 0,
  },
  infoLineLabel: {
    color: '#888888',
    fontSize: 13,
    flex: 1,
  },
  infoLineValue: {
    color: '#222222',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestChip: {
    borderWidth: 1,
    borderColor: ACCENT,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  interestChipText: {
    color: ACCENT,
    fontSize: 13,
  },
  tasteLines: {
    marginTop: 0,
  },
  tasteLinesSpaced: {
    marginTop: 12,
    paddingTop: 4,
    borderTopWidth: 0.5,
    borderTopColor: '#E5E5E5',
  },
  availCard: {
    gap: 14,
  },
  availGroup: {
    gap: 8,
  },
  availGroupLast: {
    marginBottom: 0,
  },
  availSubLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888888',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  availChip: {
    backgroundColor: '#F5F0E8',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  availChipText: {
    color: ACCENT,
    fontSize: 12,
    fontWeight: '500',
  },
  expectationText: {
    fontSize: 14,
    color: '#222222',
    fontWeight: '500',
    lineHeight: 20,
  },
  accountBlock: {
    marginHorizontal: 16,
    gap: 10,
    marginTop: 4,
    marginBottom: 8,
  },
  editBtn: {
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    ...cardShadow,
  },
  editBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  signOutBtn: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingVertical: 14,
    alignItems: 'center',
  },
  signOutBtnText: {
    color: '#999999',
    fontSize: 15,
    fontWeight: '500',
  },
});
