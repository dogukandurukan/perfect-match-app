// Screen: Profile tab | Status: stable | Last updated: Ağustos 2026
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { HingeProfileCard } from '@/components/profile/HingeProfileCard';
import { HomeTopIcon } from '@/components/ui/HomeTopIcon';
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
        <HomeTopIcon />
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

  return (
    <ScreenContainer style={styles.screenFlush}>
      <HomeTopIcon />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
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
  screenFlush: {
    justifyContent: 'flex-start',
    paddingHorizontal: 0,
    paddingVertical: 0,
    backgroundColor: '#FAFAFA',
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
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
