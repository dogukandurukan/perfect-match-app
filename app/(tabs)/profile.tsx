// Screen: Profile tab | Status: stable | Last updated: Ağustos 2026
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';

import { ErrorState } from '@/components/ErrorState';
import { ThemedText } from '@/components/themed-text';
import { HingeProfileCard } from '@/components/profile/HingeProfileCard';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { colors } from '@/lib/designTokens';
import type { HingeProfilePerson } from '@/lib/hingeProfile';
import { supabase } from '@/lib/supabaseClient';
import { resolveProfilePhotoUrl } from '@/lib/userPhotosStorage';

type Profile = {
  id: string;
  first_name: string | null;
  date_of_birth: string | null;
  city: string | null;
  district: string | null;
  gender: string | null;
  languages: string[] | null;
  photos: string[] | null;
  bio: string | null;
  morning_night: string | null;
  hobbies: string[] | null;
  drinking: string | null;
  smoking: string | null;
  education: string | null;
  religion: string | null;
  pets: string | null;
  vibe: string | null;
  photo_verified: boolean | null;
  availability_days: string[] | null;
  favorite_spots: Record<string, string> | null;
  first_date_expectation: string | null;
  favorite_music: string | null;
  favorite_movie: string | null;
  favorite_book: string | null;
  favorite_activity: string | null;
  zodiac_sign: string | null;
  core_value: string | null;
  impressed_by: string | null;
};

// Bumble-style "Complete Profile X%" badge (user reference screenshots,
// 2026-09-10) — a real, computed score instead of a decorative number.
// 8 equal-weight checks; deliberately doesn't include every profile field
// (that'd basically require 100% onboarding completion to ever hit 100),
// just the ones that meaningfully affect what a match sees.
function computeProfileCompletion(profile: Profile | null, photoCount: number): number {
  if (!profile) return 0;
  const checks = [
    photoCount >= 1,
    photoCount >= 3,
    !!profile.bio?.trim(),
    (profile.hobbies ?? []).length > 0,
    !!(
      profile.favorite_book?.trim() ||
      profile.favorite_movie?.trim() ||
      profile.favorite_music?.trim() ||
      profile.core_value?.trim() ||
      profile.first_date_expectation?.trim() ||
      profile.favorite_activity?.trim()
    ),
    (profile.availability_days ?? []).length > 0,
    (profile.languages ?? []).length > 0,
    profile.photo_verified === true,
  ];
  const done = checks.filter(Boolean).length;
  return Math.round((done / checks.length) * 100);
}

const PROFILE_SELECT = `
  id, first_name, date_of_birth, city, district,
  gender, languages, photos, bio,
  morning_night, hobbies, drinking, smoking,
  education, religion, pets, vibe, photo_verified,
  availability_days, favorite_spots, first_date_expectation,
  favorite_music, favorite_movie, favorite_book, favorite_activity,
  zodiac_sign, core_value, impressed_by
`;

export default function ProfileTab() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [intent, setIntent] = useState<string | null>(null);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      (async () => {
        setLoading(true);
        setError(false);
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || !mounted) {
          setLoading(false);
          return;
        }

        const { data, error: fetchError } = await supabase
          .from('profiles')
          .select(PROFILE_SELECT)
          .eq('id', user.id)
          .single();

        if (!mounted) return;
        if (fetchError || !data) {
          console.warn('[ProfileTab] profiles fetch failed', fetchError);
          setError(true);
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
    }, [reloadKey]),
  );

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace('/(auth)/login');
  }

  if (loading) {
    return (
      <ScreenContainer style={styles.screenFlush}>
        <ActivityIndicator color={colors.accent} style={styles.loader} />
      </ScreenContainer>
    );
  }

  if (error) {
    return (
      <ScreenContainer style={styles.screenFlush}>
        <ErrorState onRetry={() => setReloadKey((k) => k + 1)} />
      </ScreenContainer>
    );
  }

  const person: HingeProfilePerson = {
    first_name: profile?.first_name ?? null,
    date_of_birth: profile?.date_of_birth ?? null,
    district: profile?.district ?? null,
    city: profile?.city ?? null,
    intent,
    availability_days: profile?.availability_days ?? null,
    drinking: profile?.drinking ?? null,
    smoking: profile?.smoking ?? null,
    hobbies: profile?.hobbies ?? null,
    favorite_music: profile?.favorite_music ?? null,
    favorite_movie: profile?.favorite_movie ?? null,
    favorite_book: profile?.favorite_book ?? null,
    bio: profile?.bio ?? null,
    first_date_expectation: profile?.first_date_expectation ?? null,
    favorite_spots: profile?.favorite_spots ?? null,
    education: profile?.education ?? null,
    zodiac_sign: profile?.zodiac_sign ?? null,
    gender: profile?.gender ?? null,
    pets: profile?.pets ?? null,
    religion: profile?.religion ?? null,
    morning_night: profile?.morning_night ?? null,
    core_value: profile?.core_value ?? null,
    impressed_by: profile?.impressed_by ?? null,
    favorite_activity: profile?.favorite_activity ?? null,
    vibe: profile?.vibe ?? null,
    languages: profile?.languages ?? null,
    photo_verified: profile?.photo_verified ?? null,
    photoUrls,
  };

  const completionPct = computeProfileCompletion(profile, photoUrls.length);
  const verified = profile?.photo_verified === true;

  return (
    <ScreenContainer style={styles.screenFlush}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          style={styles.identityRow}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Edit profile"
          onPress={() => router.push('/profile-edit' as any)}>
          <View style={styles.avatarWrap}>
            {photoUrls[0] ? (
              <Image source={{ uri: photoUrls[0] }} style={styles.avatarImg} contentFit="cover" />
            ) : (
              <View style={[styles.avatarImg, styles.avatarFallback]}>
                <ThemedText style={styles.avatarInitial}>
                  {(profile?.first_name?.trim()[0] ?? '?').toUpperCase()}
                </ThemedText>
              </View>
            )}
            <View style={styles.completionBadge}>
              <ThemedText style={styles.completionBadgeText}>{completionPct}%</ThemedText>
            </View>
          </View>
          <View style={styles.identityTextWrap}>
            <View style={styles.nameRow}>
              <ThemedText style={styles.identityName}>{profile?.first_name ?? 'You'}</ThemedText>
              {verified ? (
                <Ionicons name="checkmark-circle" size={18} color={colors.accent} />
              ) : null}
            </View>
            {completionPct < 100 ? (
              <View style={styles.completePill}>
                <ThemedText style={styles.completePillText}>Complete Profile</ThemedText>
              </View>
            ) : null}
          </View>
          <Ionicons name="chevron-forward" size={20} color="#B0B0B0" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.premiumBanner}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel="Explore Premium"
          onPress={() => router.push('/premium' as any)}>
          <View style={styles.premiumBannerText}>
            <ThemedText style={styles.premiumBannerTitle}>Go Premium ✨</ThemedText>
            <ThemedText style={styles.premiumBannerSubtitle}>
              See who likes you, more daily invites, and more.
            </ThemedText>
          </View>
          <View style={styles.premiumBannerCta}>
            <ThemedText style={styles.premiumBannerCtaText}>Explore</ThemedText>
          </View>
        </TouchableOpacity>
        <HingeProfileCard
          person={person}
          footer={
            <View style={styles.accountBlock}>
              <TouchableOpacity
                style={styles.editBtn}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Edit profile"
                onPress={() => router.push('/profile-edit' as any)}>
                <ThemedText style={styles.editBtnText}>Edit profile</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.signOutBtn}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Sign out"
                onPress={() =>
                  Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Sign Out', style: 'destructive', onPress: handleLogout },
                  ])
                }>
                <ThemedText style={styles.signOutBtnText}>Sign Out</ThemedText>
              </TouchableOpacity>
            </View>
          }
        />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: 60 },
  screenFlush: {
    justifyContent: 'flex-start',
    paddingHorizontal: 0,
    paddingVertical: 0,
    backgroundColor: '#FAFAFA',
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginHorizontal: 14,
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
  },
  avatarWrap: { position: 'relative' },
  avatarImg: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#DDD' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 24, fontWeight: '700', color: '#888' },
  completionBadge: {
    position: 'absolute',
    bottom: -4,
    left: -4,
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  completionBadgeText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  identityTextWrap: { flex: 1, gap: 6 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  identityName: { fontSize: 19, fontWeight: '700', color: colors.textPrimary },
  completePill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.bgSubtle,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  completePillText: { fontSize: 12, fontWeight: '600', color: colors.textPrimary },
  premiumBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.accent,
    borderRadius: 16,
    marginHorizontal: 14,
    marginTop: 12,
    paddingVertical: 16,
    paddingHorizontal: 18,
    gap: 12,
  },
  premiumBannerText: { flex: 1 },
  premiumBannerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  premiumBannerSubtitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    marginTop: 3,
  },
  premiumBannerCta: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  premiumBannerCtaText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  accountBlock: {
    marginHorizontal: 14,
    marginTop: 14,
    gap: 10,
  },
  editBtn: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
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
