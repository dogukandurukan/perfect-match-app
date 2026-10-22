// Activity → Profile visits (owner decisions 2026-10-22, D103). One row per
// person: "Viewed your profile", or "Visited again" for a later separate
// visit — never an exact number. Identities follow the likes rule (D84):
// premium → people (tap opens their profile); otherwise only how many people
// visited, plus the premium offer. Visits create no like or match and are not
// part of the Activity badge.
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { minutesSince, timeAgoLong } from '@/lib/activity/copy';
import { obColors, obFonts, obSpacing } from '@/lib/onboardingV2/theme';
import { cachedProfilePhotoUrl, preloadProfilePhotoUrls } from '@/lib/resolveProfilePhotoUrl';
import { loadMyVisits, visitLabel, visitsCountLine, VISITS_INFO, type VisitsData } from '@/lib/visits/visits';

type Load = { kind: 'loading' } | { kind: 'error'; text: string } | { kind: 'ready'; data: VisitsData };

export default function ProfileVisitsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [reload, setReload] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      void (async () => {
        const r = await loadMyVisits();
        if (!live) return;
        // A failed refresh keeps what is already on screen.
        if (!r.ok) return setLoad((prev) => (prev.kind === 'ready' ? prev : { kind: 'error', text: r.message }));
        await preloadProfilePhotoUrls(r.value.visits.map((v) => v.photo_path));
        if (live) setLoad({ kind: 'ready', data: r.value });
      })();
      return () => {
        live = false;
      };
    }, [reload]),
  );

  const header = (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back" style={styles.iconBtn}>
        <Ionicons name="chevron-back" size={24} color={obColors.textPrimary} />
      </TouchableOpacity>
      <Text style={styles.title} accessibilityRole="header" numberOfLines={1} maxFontSizeMultiplier={1.4}>
        Profile visits
      </Text>
      <View style={styles.iconBtn} />
    </View>
  );

  let body;
  if (load.kind === 'loading') {
    body = (
      <View style={styles.center} accessibilityLiveRegion="polite">
        <ActivityIndicator color={obColors.cta} />
      </View>
    );
  } else if (load.kind === 'error') {
    body = (
      <View style={styles.center} accessibilityLiveRegion="polite">
        <Text style={styles.body}>{load.text}</Text>
        <TouchableOpacity
          onPress={() => {
            setLoad({ kind: 'loading' });
            setReload((n) => n + 1);
          }}
          style={styles.cta}
          accessibilityRole="button"
        >
          <Text style={styles.ctaText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  } else {
    const d = load.data;
    body = (
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + obSpacing.xl }]}>
        <View style={styles.info}>
          <Ionicons name="eye-outline" size={18} color={obColors.textSecondary} importantForAccessibility="no" />
          <Text style={styles.infoText} maxFontSizeMultiplier={1.6}>{VISITS_INFO}</Text>
        </View>
        {d.count === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle} accessibilityRole="header">No visits yet</Text>
            <Text style={styles.body}>When someone opens your full profile, they’ll show up here.</Text>
          </View>
        ) : !d.premium ? (
          <View style={styles.locked}>
            <Text style={styles.lockedTitle}>{visitsCountLine(d.count)}</Text>
            <TouchableOpacity onPress={() => router.push('/premium' as never)} style={styles.cta} accessibilityRole="button">
              <Text style={styles.ctaText}>See who visited</Text>
            </TouchableOpacity>
          </View>
        ) : (
          d.visits.map((v) => {
            const name = v.first_name?.trim() || 'Someone';
            const photo = cachedProfilePhotoUrl(v.photo_path);
            const when = timeAgoLong(minutesSince(v.last_visit_at));
            const label = visitLabel(v);
            return (
              <TouchableOpacity
                key={v.user_id}
                style={styles.row}
                onPress={() => router.push({ pathname: '/v2/profile', params: { userId: v.user_id } } as never)}
                accessibilityRole="button"
                accessibilityLabel={`${name}${v.age ? `, ${v.age}` : ''}. ${label}, ${when}. Open profile`}
              >
                {photo ? (
                  <Image source={{ uri: photo }} style={styles.avatar} contentFit="cover" />
                ) : (
                  <View style={[styles.avatar, styles.avatarEmpty]}>
                    <Text style={styles.initial}>{name.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
                <View style={styles.rowText}>
                  <Text style={styles.name} numberOfLines={1}>{v.age ? `${name}, ${v.age}` : name}</Text>
                  <Text style={styles.sub} numberOfLines={1}>{`${label} · ${when}`}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={obColors.textSecondary} importantForAccessibility="no" />
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {header}
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: obColors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: obSpacing.sm, minHeight: 52, backgroundColor: obColors.background },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontFamily: obFonts.heading, fontSize: 22, lineHeight: 29, color: obColors.textPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: obSpacing.md, paddingHorizontal: obSpacing.gutter },
  body: { fontFamily: obFonts.body, fontSize: 15, lineHeight: 21, color: obColors.textSecondary, textAlign: 'center' },
  scroll: { paddingHorizontal: obSpacing.gutter, paddingTop: obSpacing.sm, gap: obSpacing.sm },
  info: { flexDirection: 'row', gap: obSpacing.sm, alignItems: 'flex-start', marginBottom: obSpacing.xs },
  infoText: { flex: 1, fontFamily: obFonts.body, fontSize: 14, lineHeight: 20, color: obColors.textSecondary },
  empty: { alignItems: 'center', gap: obSpacing.sm, paddingVertical: obSpacing.xxl },
  emptyTitle: { fontFamily: obFonts.heading, fontSize: 22, lineHeight: 29, color: obColors.textPrimary, textAlign: 'center' },
  locked: { alignItems: 'center', gap: obSpacing.md, padding: obSpacing.lg, borderRadius: 16, backgroundColor: '#FFFDF8', borderWidth: 1, borderColor: '#E4DCCB' },
  lockedTitle: { fontFamily: obFonts.heading, fontSize: 21, lineHeight: 28, color: obColors.textPrimary, textAlign: 'center' },
  cta: { minHeight: 48, paddingHorizontal: obSpacing.xl, borderRadius: 14, backgroundColor: obColors.cta, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontFamily: obFonts.bodySemiBold, fontSize: 17, lineHeight: 22, color: obColors.onCta },
  row: { flexDirection: 'row', alignItems: 'center', gap: obSpacing.md, minHeight: 72, padding: obSpacing.sm, borderRadius: 14, backgroundColor: '#FFFDF8', borderWidth: 1, borderColor: '#E4DCCB' },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: obColors.notice },
  avatarEmpty: { alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: obFonts.heading, fontSize: 20, lineHeight: 26, color: obColors.textPrimary },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontFamily: obFonts.bodySemiBold, fontSize: 16, lineHeight: 21, color: obColors.textPrimary },
  sub: { fontFamily: obFonts.body, fontSize: 14, lineHeight: 19, color: obColors.textSecondary },
});
