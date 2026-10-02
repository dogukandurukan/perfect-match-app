// Profile tab for an approved V2 member: name, main photo, the real saved
// counts, and two actions. No completion percentage (the old one read V1
// columns and showed an approved profile as 25%). "View profile" opens the
// approved V2 profile view (get_profile_v2 — exactly what others see).
// Editing after approval is not decided yet (the server locks answers once an
// application is sent), so "Edit profile" never routes to the V1 editor.
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { OnboardingPrimaryButton } from '@/components/onboarding-v2/OnboardingPrimaryButton';
import { loadMyOnboarding } from '@/lib/onboardingV2/remote';
import { obColors, obFonts, obSpacing } from '@/lib/onboardingV2/theme';
import { MAX_PHOTOS, PROMPT_SLOTS } from '@/lib/onboardingV2/yourProfile';
import { resolveProfilePhotoUrl } from '@/lib/resolveProfilePhotoUrl';
import { supabase } from '@/lib/supabaseClient';

type Data = { userId: string; name: string; photoUrl: string | null; photos: number; prompts: number };

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
        const r = await loadMyOnboarding();
        if (!live) return;
        if (!userId || !r.ok) return setError(r.ok ? 'Not signed in.' : r.message);
        const photos = [...r.value.photos].sort((a, b) => a.position - b.position);
        const photoUrl = photos[0] ? await resolveProfilePhotoUrl(photos[0].path) : null;
        if (!live) return;
        setData({
          userId,
          name: (r.value.draft?.first_name ?? '').trim(),
          photoUrl,
          photos: photos.length,
          prompts: r.value.prompts.filter((p) => p.answer?.trim()).length,
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
        <Text style={styles.name} accessibilityRole="header" numberOfLines={2} maxFontSizeMultiplier={1.4}>
          {data.name || 'Your profile'}
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.row}>
          <Ionicons name="images-outline" size={20} color={obColors.cta} importantForAccessibility="no" />
          <Text style={styles.rowText}>Photos</Text>
          <Text style={styles.rowValue}>{`${data.photos} of ${MAX_PHOTOS}`}</Text>
        </View>
        <View style={[styles.row, styles.rowDivider]}>
          <Ionicons name="chatbubble-ellipses-outline" size={20} color={obColors.cta} importantForAccessibility="no" />
          <Text style={styles.rowText}>Prompts</Text>
          <Text style={styles.rowValue}>{`${data.prompts} of ${PROMPT_SLOTS}`}</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <OnboardingPrimaryButton
          label="View profile"
          onPress={() => router.push(`/v2/profile?userId=${data.userId}` as never)}
        />
        <OnboardingPrimaryButton label="Edit profile" variant="outline" disabled onPress={() => {}} />
        <Text style={styles.caption} maxFontSizeMultiplier={1.6}>
          Editing after approval isn&apos;t available yet.
        </Text>
      </View>

      {__DEV__ ? (
        // DEV-only entry to the local Matches design preview (no real data).
        <TouchableOpacity
          onPress={() => router.push('/dev/matches-preview' as never)}
          accessibilityRole="button"
          hitSlop={10}
          style={styles.devEntry}>
          <Ionicons name="construct-outline" size={18} color={obColors.textSecondary} importantForAccessibility="no" />
          <Text style={styles.devEntryText}>Matches design preview (DEV)</Text>
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity onPress={signOut} accessibilityRole="button" hitSlop={10} style={styles.signOut}>
        <Text style={styles.link}>Sign out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: obColors.background },
  content: { padding: obSpacing.gutter, gap: obSpacing.xl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: obSpacing.md, backgroundColor: obColors.background, padding: obSpacing.gutter },
  identity: { alignItems: 'center', gap: obSpacing.md },
  avatar: { width: 112, height: 112, borderRadius: 56, backgroundColor: obColors.selectedFill },
  avatarEmpty: { alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: obFonts.heading, fontSize: 40, lineHeight: 48, color: obColors.cta },
  name: { fontFamily: obFonts.heading, fontSize: 30, lineHeight: 38, color: obColors.textPrimary, textAlign: 'center' },
  card: { backgroundColor: '#FFFDF8', borderRadius: 14, borderWidth: 1, borderColor: '#E4DCCB', paddingHorizontal: obSpacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: obSpacing.md, minHeight: 52 },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E4DCCB' },
  rowText: { flex: 1, fontFamily: obFonts.bodyMedium, fontSize: 16, lineHeight: 22, color: obColors.textPrimary },
  rowValue: { fontFamily: obFonts.body, fontSize: 16, lineHeight: 22, color: obColors.textSecondary },
  actions: { gap: obSpacing.md },
  caption: { fontFamily: obFonts.body, fontSize: 14, lineHeight: 20, color: obColors.textSecondary, textAlign: 'center' },
  body: { fontFamily: obFonts.body, fontSize: 16, lineHeight: 22, color: obColors.textPrimary, textAlign: 'center' },
  link: { fontFamily: obFonts.bodySemiBold, fontSize: 16, lineHeight: 22, color: obColors.cta, textDecorationLine: 'underline' },
  signOut: { alignSelf: 'center', minHeight: 44, justifyContent: 'center' },
  devEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: obSpacing.sm,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: obColors.border,
    backgroundColor: obColors.notice,
  },
  devEntryText: { fontFamily: obFonts.bodyMedium, fontSize: 15, lineHeight: 20, color: obColors.textSecondary },
});
