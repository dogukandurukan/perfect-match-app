// Approved member: reorder your existing photos and choose the main one
// (2026-10-21, narrow D90 exception). No adding, deleting or replacing.
// Changes stay a local draft until "Save"; leaving with unsaved changes asks
// first. The save sends the new order plus the order this screen loaded, so a
// change made elsewhere is reported (Reload) instead of overwritten. A failed
// save keeps the edited order for a retry.
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OnboardingPrimaryButton } from '@/components/onboarding-v2/OnboardingPrimaryButton';
import { loadMyOnboarding } from '@/lib/onboardingV2/remote';
import { obColors, obFonts, obSpacing } from '@/lib/onboardingV2/theme';
import { saveMemberPhotoOrder } from '@/lib/profile/memberPhotos';
import { makeMain, moveDown, moveUp, sameOrder, sortByPosition } from '@/lib/profile/photoOrder';
import { resolveProfilePhotoUrl } from '@/lib/resolveProfilePhotoUrl';

type Photo = { id: string; path: string; url: string | null };
type Load = { kind: 'loading' } | { kind: 'error'; text: string } | { kind: 'ready' };
type Banner = { kind: 'error'; text: string; changed: boolean } | { kind: 'saved' } | null;

export default function EditPhotosScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [reload, setReload] = useState(0);
  const [photos, setPhotos] = useState<Record<string, Photo>>({});
  const [saved, setSaved] = useState<string[]>([]); // the server order this screen knows
  const [draft, setDraft] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<Banner>(null);
  const busy = useRef(false);
  const dirty = !sameOrder(draft, saved);

  useEffect(() => {
    let live = true;
    void (async () => {
      setLoad({ kind: 'loading' });
      const r = await loadMyOnboarding();
      if (!live) return;
      if (!r.ok) return setLoad({ kind: 'error', text: r.message });
      const ordered = sortByPosition(r.value.photos);
      const withUrls = await Promise.all(ordered.map(async (p) => ({ id: p.id, path: p.path, url: await resolveProfilePhotoUrl(p.path) })));
      if (!live) return;
      setPhotos(Object.fromEntries(withUrls.map((p) => [p.id, p])));
      const ids = ordered.map((p) => p.id);
      setSaved(ids);
      setDraft(ids);
      setBanner(null);
      setLoad({ kind: 'ready' });
    })();
    return () => {
      live = false;
    };
  }, [reload]);

  // Leaving with unsaved changes asks first (nothing is saved silently).
  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', (e: { preventDefault: () => void; data: { action: unknown } }) => {
      if (!dirty || busy.current) return;
      e.preventDefault();
      Alert.alert('Discard changes?', 'Your new photo order hasn’t been saved.', [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(e.data.action as never) },
      ]);
    });
    return unsub;
  }, [navigation, dirty]);

  const save = useCallback(async () => {
    if (busy.current || !dirty) return;
    busy.current = true;
    setSaving(true);
    setBanner(null);
    const order = draft;
    const r = await saveMemberPhotoOrder(order, saved);
    busy.current = false;
    setSaving(false);
    if (r.ok) {
      setSaved(order);
      setBanner({ kind: 'saved' });
      return;
    }
    // Keep the edited order on screen for a retry.
    setBanner({ kind: 'error', text: r.text, changed: r.changed });
  }, [draft, saved, dirty]);

  const reloadLatest = () => {
    if (!dirty) return setReload((n) => n + 1);
    Alert.alert('Reload photos?', 'Your unsaved order will be replaced by the saved one.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reload', onPress: () => setReload((n) => n + 1) },
    ]);
  };

  const header = (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back" style={styles.iconBtn}>
        <Ionicons name="chevron-back" size={24} color={obColors.textPrimary} />
      </TouchableOpacity>
      <Text style={styles.title} accessibilityRole="header" numberOfLines={1} maxFontSizeMultiplier={1.4}>
        Photos
      </Text>
      <View style={styles.iconBtn} />
    </View>
  );

  if (load.kind !== 'ready') {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        {header}
        <View style={styles.center}>
          {load.kind === 'loading' ? (
            <ActivityIndicator color={obColors.cta} />
          ) : (
            <>
              <Text style={styles.body}>{load.text}</Text>
              <OnboardingPrimaryButton label="Try again" variant="outline" onPress={() => setReload((n) => n + 1)} />
            </>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {header}
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 120 }]}>
        <Text style={styles.hint} maxFontSizeMultiplier={1.6}>
          Choose your main photo and the order others see. Adding or removing photos isn’t available after approval yet.
        </Text>
        {draft.map((id, i) => {
          const p = photos[id];
          const n = i + 1;
          const isMain = i === 0;
          return (
            <View key={id} style={[styles.row, isMain && styles.rowMain]} accessible={false}>
              {p?.url ? (
                <Image source={{ uri: p.url }} style={styles.thumb} contentFit="cover" accessible accessibilityLabel={isMain ? 'Main photo' : `Photo ${n}`} />
              ) : (
                <View style={[styles.thumb, styles.thumbEmpty]}>
                  <Ionicons name="image-outline" size={22} color={obColors.textSecondary} />
                </View>
              )}
              <View style={styles.rowText}>
                {isMain ? (
                  <View style={styles.mainBadge}>
                    <Ionicons name="star" size={13} color={obColors.onCta} importantForAccessibility="no" />
                    <Text style={styles.mainBadgeText}>Main photo</Text>
                  </View>
                ) : (
                  <Text style={styles.position}>{`Photo ${n}`}</Text>
                )}
                {!isMain ? (
                  <TouchableOpacity
                    onPress={() => setDraft((d) => makeMain(d, id))}
                    disabled={saving}
                    style={styles.makeMain}
                    accessibilityRole="button"
                    accessibilityLabel={`Make photo ${n} the main photo`}>
                    <Text style={styles.makeMainText}>Make main photo</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              <View style={styles.arrows}>
                <TouchableOpacity
                  onPress={() => setDraft((d) => moveUp(d, id))}
                  disabled={saving || i === 0}
                  style={[styles.arrowBtn, (saving || i === 0) && styles.arrowOff]}
                  accessibilityRole="button"
                  accessibilityLabel={`Move photo ${n} up`}
                  accessibilityState={{ disabled: saving || i === 0 }}>
                  <Ionicons name="chevron-up" size={22} color={obColors.textPrimary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setDraft((d) => moveDown(d, id))}
                  disabled={saving || i === draft.length - 1}
                  style={[styles.arrowBtn, (saving || i === draft.length - 1) && styles.arrowOff]}
                  accessibilityRole="button"
                  accessibilityLabel={`Move photo ${n} down`}
                  accessibilityState={{ disabled: saving || i === draft.length - 1 }}>
                  <Ionicons name="chevron-down" size={22} color={obColors.textPrimary} />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, obSpacing.md) }]}>
        {banner?.kind === 'error' ? (
          <View style={styles.bannerRow}>
            <Text style={styles.error} accessibilityLiveRegion="polite">
              {banner.text}
            </Text>
            {banner.changed ? (
              <TouchableOpacity onPress={reloadLatest} hitSlop={8} accessibilityRole="button" accessibilityLabel="Reload photos">
                <Text style={styles.link}>Reload</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : banner?.kind === 'saved' && !dirty ? (
          <Text style={styles.saved} accessibilityLiveRegion="polite">
            Saved
          </Text>
        ) : null}
        <OnboardingPrimaryButton label={saving ? 'Saving…' : 'Save'} onPress={() => void save()} disabled={saving || !dirty} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: obColors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: obSpacing.sm, minHeight: 52, backgroundColor: obColors.background },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontFamily: obFonts.heading, fontSize: 22, lineHeight: 29, color: obColors.textPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: obSpacing.md, paddingHorizontal: obSpacing.gutter },
  body: { fontFamily: obFonts.body, fontSize: 16, lineHeight: 22, color: obColors.textPrimary, textAlign: 'center' },
  scroll: { paddingHorizontal: obSpacing.gutter, paddingTop: obSpacing.sm, gap: obSpacing.sm },
  hint: { fontFamily: obFonts.body, fontSize: 14, lineHeight: 20, color: obColors.textSecondary, marginBottom: obSpacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: obSpacing.md, padding: obSpacing.sm, borderRadius: 14, backgroundColor: '#FFFDF8', borderWidth: 1, borderColor: '#E4DCCB' },
  rowMain: { borderColor: obColors.cta },
  thumb: { width: 64, height: 80, borderRadius: 10, backgroundColor: obColors.notice },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, minWidth: 0, gap: 6 },
  position: { fontFamily: obFonts.bodyMedium, fontSize: 15, lineHeight: 20, color: obColors.textPrimary },
  mainBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: obColors.cta },
  mainBadgeText: { fontFamily: obFonts.bodySemiBold, fontSize: 13, lineHeight: 17, color: obColors.onCta },
  makeMain: { alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center' },
  makeMainText: { fontFamily: obFonts.bodySemiBold, fontSize: 14, lineHeight: 19, color: obColors.cta, textDecorationLine: 'underline' },
  arrows: { gap: 2 },
  arrowBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  arrowOff: { opacity: 0.3 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: obSpacing.gutter, paddingTop: obSpacing.sm, gap: obSpacing.sm, backgroundColor: obColors.background, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E4DCCB' },
  bannerRow: { flexDirection: 'row', alignItems: 'center', gap: obSpacing.sm, flexWrap: 'wrap' },
  error: { flex: 1, fontFamily: obFonts.body, fontSize: 14, lineHeight: 19, color: obColors.error },
  link: { fontFamily: obFonts.bodySemiBold, fontSize: 14, lineHeight: 19, color: obColors.cta, textDecorationLine: 'underline' },
  saved: { fontFamily: obFonts.bodyMedium, fontSize: 14, lineHeight: 19, color: obColors.cta, textAlign: 'center' },
});
