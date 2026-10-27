// Profile tab for an approved V2 member (D106 layout, owner 2026-10-27):
// a compact row (main photo, first name + age, city), "Recently" (book /
// song — own add / edit access), then Edit profile and Preview. Preview opens
// the shared public profile view (get_profile_v2 — exactly what others see,
// with no like / comment actions). Editing after approval goes through Edit
// profile (Photos order / main, Interests & conversation starters, the
// Package 1 details, Recently); everything else stays locked and it never
// routes to the V1 editor. DEV design previews live under Settings (DEV only).
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { OnboardingPrimaryButton } from '@/components/onboarding-v2/OnboardingPrimaryButton';
import { RecentlyRows } from '@/components/profile/RecentlyRows';
import { loadMyOnboarding } from '@/lib/onboardingV2/remote';
import { obColors, obFonts, obSpacing } from '@/lib/onboardingV2/theme';
import { ageFromIso } from '@/lib/profile/memberProfileCore';
import { loadMyRecently } from '@/lib/profile/recently';
import { recentlyForDisplay, type PublicRecently } from '@/lib/profile/recentlyCore';
import { resolveProfilePhotoUrl } from '@/lib/resolveProfilePhotoUrl';
import { supabase } from '@/lib/supabaseClient';

type Data = { userId: string; name: string; age: number | null; city: string; photoUrl: string | null; recently: PublicRecently | null };

export function V2ProfileHome() {
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      void (async () => {
        setError(null);
        const { data: s } = await supabase.auth.getSession();
        const userId = s.session?.user?.id;
        const [r, rec] = await Promise.all([loadMyOnboarding(), loadMyRecently()]);
        if (!live) return;
        if (!userId || !r.ok) return setError(r.ok ? 'Not signed in.' : r.message);
        if (!rec.ok) return setError(rec.text);
        const photos = [...r.value.photos].sort((a, b) => a.position - b.position);
        const photoUrl = photos[0] ? await resolveProfilePhotoUrl(photos[0].path) : null;
        if (!live) return;
        const d = r.value.draft ?? {};
        setData({
          userId,
          name: (d.first_name ?? '').trim(),
          age: ageFromIso(d.date_of_birth),
          city: (d.location_city ?? '').trim(),
          photoUrl,
          recently: recentlyForDisplay(rec.draft),
        });
      })();
      return () => {
        live = false;
      };
    }, [reload]),
  );

  const signOut = () =>
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace('/');
        },
      },
    ]);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.body} accessibilityLiveRegion="polite">{error}</Text>
        <TouchableOpacity onPress={() => setReload((n) => n + 1)} accessibilityRole="button" hitSlop={10}>
          <Text style={styles.link}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }
  if (!data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={obColors.cta} accessibilityLabel="Loading your profile" />
      </View>
    );
  }
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.identity}>
        {data.photoUrl ? (
          <Image source={{ uri: data.photoUrl }} style={styles.avatar} contentFit="cover" accessibilityLabel="Main photo" />
        ) : (
          <View style={[styles.avatar, styles.avatarEmpty]}>
            <Text style={styles.initial}>{(data.name[0] ?? '?').toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.identityText}>
          <Text style={styles.name} accessibilityRole="header" numberOfLines={2} maxFontSizeMultiplier={1.4}>
            {data.name || 'Your profile'}
            {data.age !== null ? `, ${data.age}` : ''}
          </Text>
          {data.city ? (
            <Text style={styles.city} numberOfLines={1} maxFontSizeMultiplier={1.5}>
              {data.city}
            </Text>
          ) : null}
        </View>
      </View>

      <RecentlyRows recently={data.recently} onEdit={() => router.push('/v2/edit-recently' as never)} />

      <View style={styles.actions}>
        <View style={styles.action}>
          <OnboardingPrimaryButton label="Edit profile" onPress={() => router.push('/v2/edit-profile' as never)} />
        </View>
        <View style={styles.action}>
          <OnboardingPrimaryButton
            label="Preview"
            variant="outline"
            onPress={() => router.push(`/v2/profile?userId=${data.userId}&own=1` as never)}
          />
        </View>
      </View>

      <TouchableOpacity onPress={signOut} accessibilityRole="button" hitSlop={10} style={styles.signOut}>
        <Text style={styles.link}>Sign out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: obColors.background },
  content: { paddingHorizontal: obSpacing.gutter, paddingTop: obSpacing.lg, paddingBottom: obSpacing.xl, gap: obSpacing.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: obSpacing.md, backgroundColor: obColors.background, padding: obSpacing.gutter },
  identity: { flexDirection: 'row', alignItems: 'center', gap: obSpacing.lg },
  identityText: { flex: 1, minWidth: 0, gap: 2 },
  avatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: obColors.selectedFill },
  avatarEmpty: { alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: obFonts.heading, fontSize: 30, lineHeight: 36, color: obColors.cta },
  name: { fontFamily: obFonts.heading, fontSize: 26, lineHeight: 32, color: obColors.textPrimary },
  city: { fontFamily: obFonts.body, fontSize: 16, lineHeight: 22, color: obColors.textSecondary },
  actions: { flexDirection: 'row', gap: obSpacing.md },
  action: { flex: 1 },
  body: { fontFamily: obFonts.body, fontSize: 16, lineHeight: 22, color: obColors.textPrimary, textAlign: 'center' },
  link: { fontFamily: obFonts.bodySemiBold, fontSize: 16, lineHeight: 22, color: obColors.cta, textDecorationLine: 'underline' },
  signOut: { alignSelf: 'center', minHeight: 44, justifyContent: 'center' },
});
