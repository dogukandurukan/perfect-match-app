// Edit profile → Conversation starters (2026-10-27): the member's saved
// starters (up to 3, unchanged rule) with Edit / Change topic / Remove, and
// "Add a conversation starter". Adding / editing opens its own editor
// (conversation-starter.tsx, one Save). Reads the server copy on every focus,
// so a saved starter shows here as soon as the editor closes.
// Topics come from the member's SAVED interests selections (activities,
// books, films / series, artists), edited on "Your interests".
// Remove asks first and the starter leaves the list only after the server
// confirmed (delete_take_v2); a failure keeps it and says so.
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TakeRow } from '@/components/interests/TakeCard';
import { shownTake } from '@/components/interests/TakesEditor';
import { OnboardingPrimaryButton } from '@/components/onboarding-v2/OnboardingPrimaryButton';
import { deleteTake, loadMyInterests } from '@/lib/interests/interestsV2';
import { MAX_TAKES, canAddTake, orderedTakes, subjectOptions, type Subject, type Take } from '@/lib/interests/takes';
import { obColors, obFonts, obSpacing } from '@/lib/onboardingV2/theme';
import { takeScreenNotice } from '@/lib/profile/screenNotice';

type Load =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'unavailable'; message: string }
  | { kind: 'ready'; takes: Take[]; options: Subject[] };
type Banner = { kind: 'ok' | 'error'; text: string } | null;

export default function ConversationStartersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [reload, setReload] = useState(0);
  const [banner, setBanner] = useState<Banner>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const busy = useRef(false);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      const notice = takeScreenNotice(); // set by the editor after a confirmed save
      if (notice) setBanner({ kind: 'ok', text: notice });
      void (async () => {
        const r = await loadMyInterests();
        if (!live) return;
        if (r.kind === 'unsupported') return setLoad({ kind: 'unavailable', message: 'Conversation starters aren’t available on this server yet.' });
        if (r.kind === 'error') return setLoad({ kind: 'error', message: r.message });
        if (!r.value.editable) return setLoad({ kind: 'unavailable', message: 'Your account can’t edit this right now.' });
        setLoad({ kind: 'ready', takes: orderedTakes(r.value.takes), options: subjectOptions(r.value) });
      })();
      return () => {
        live = false;
      };
    }, [reload]),
  );

  const open = (mode: 'new' | 'edit' | 'change', id?: string) => {
    setBanner(null);
    router.push(`/v2/conversation-starter?mode=${mode}${id ? `&id=${id}` : ''}` as never);
  };

  const remove = (t: Take) =>
    Alert.alert('Remove this conversation starter?', `Only your answer about ${t.subject_title} is removed. Your interests and other answers stay.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          if (busy.current) return;
          busy.current = true;
          setRemoving(t.id);
          setBanner(null);
          const r = await deleteTake(t.id);
          busy.current = false;
          setRemoving(null);
          if (r.kind === 'error') return setBanner({ kind: 'error', text: r.message });
          // Only now (server confirmed) does it leave the list — re-read the server copy.
          setBanner({ kind: 'ok', text: 'Conversation starter removed' });
          setReload((n) => n + 1);
        },
      },
    ]);

  const header = (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back" style={styles.iconBtn}>
        <Ionicons name="chevron-back" size={24} color={obColors.textPrimary} />
      </TouchableOpacity>
      <Text style={styles.title} accessibilityRole="header" numberOfLines={1} maxFontSizeMultiplier={1.4}>
        Conversation starters
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
            <ActivityIndicator color={obColors.cta} accessibilityLabel="Loading" />
          ) : (
            <>
              <Text style={styles.body}>{load.message}</Text>
              {load.kind === 'error' ? <OnboardingPrimaryButton label="Try again" variant="outline" onPress={() => setReload((n) => n + 1)} /> : null}
            </>
          )}
        </View>
      </View>
    );
  }

  const { takes, options } = load;
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {header}
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + obSpacing.xl }]}>
        <Text style={styles.hint} maxFontSizeMultiplier={1.6}>
          {`Short answers about an activity, book, film or artist you love. Up to ${MAX_TAKES}. Shown on your profile.`}
        </Text>
        {banner ? (
          <View style={[styles.banner, banner.kind === 'error' && styles.bannerError]} accessibilityLiveRegion="polite" accessibilityRole={banner.kind === 'error' ? 'alert' : undefined}>
            <Ionicons name={banner.kind === 'ok' ? 'checkmark-circle' : 'alert-circle-outline'} size={20} color={banner.kind === 'ok' ? obColors.cta : obColors.error} />
            <Text style={styles.bannerText}>{banner.text}</Text>
          </View>
        ) : null}
        <Text style={styles.count} maxFontSizeMultiplier={1.5}>{`${takes.length} of ${MAX_TAKES}`}</Text>
        {takes.map((t) => (
          <View key={t.id} style={styles.card}>
            <TakeRow take={shownTake(t)} />
            <View style={styles.actions}>
              <TouchableOpacity onPress={() => open('edit', t.id)} disabled={!!removing} style={styles.action} accessibilityRole="button" accessibilityLabel={`Edit answer about ${t.subject_title}`}>
                <Ionicons name="create-outline" size={17} color={obColors.textPrimary} />
                <Text style={styles.actionText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => open('change', t.id)} disabled={!!removing} style={styles.action} accessibilityRole="button" accessibilityLabel={`Change topic for the answer about ${t.subject_title}`}>
                <Ionicons name="swap-horizontal-outline" size={17} color={obColors.textPrimary} />
                <Text style={styles.actionText}>Change topic</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => remove(t)} disabled={!!removing} style={styles.action} accessibilityRole="button" accessibilityLabel={`Remove answer about ${t.subject_title}`}>
                {removing === t.id ? <ActivityIndicator size="small" color={obColors.error} /> : <Ionicons name="trash-outline" size={17} color={obColors.error} />}
                <Text style={[styles.actionText, styles.danger]}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
        {takes.length === 0 ? (
          <Text style={styles.hint} maxFontSizeMultiplier={1.6}>
            You haven’t added one yet.
          </Text>
        ) : null}
        {takes.length < MAX_TAKES ? (
          canAddTake(takes, options) ? (
            <TouchableOpacity onPress={() => open('new')} disabled={!!removing} style={styles.add} accessibilityRole="button">
              <Ionicons name="add" size={20} color={obColors.cta} />
              <Text style={styles.addText}>Add a conversation starter</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.noTopic}>
              <Text style={styles.hint} maxFontSizeMultiplier={1.6}>
                To add one, save an activity, book, film or artist in Your interests first.
              </Text>
              <TouchableOpacity onPress={() => router.push('/v2/edit-interests' as never)} accessibilityRole="button" hitSlop={8}>
                <Text style={styles.link}>Open Your interests</Text>
              </TouchableOpacity>
            </View>
          )
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: obColors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: obSpacing.sm, minHeight: 52, backgroundColor: obColors.background },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontFamily: obFonts.heading, fontSize: 22, lineHeight: 29, color: obColors.textPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: obSpacing.md, padding: obSpacing.gutter },
  body: { fontFamily: obFonts.body, fontSize: 16, lineHeight: 22, color: obColors.textPrimary, textAlign: 'center' },
  content: { padding: obSpacing.gutter, gap: obSpacing.md },
  hint: { fontFamily: obFonts.body, fontSize: 14, lineHeight: 20, color: obColors.textSecondary },
  count: { fontFamily: obFonts.bodyMedium, fontSize: 14, lineHeight: 19, color: obColors.textSecondary },
  link: { fontFamily: obFonts.bodySemiBold, fontSize: 15, lineHeight: 20, color: obColors.cta, textDecorationLine: 'underline' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: obSpacing.sm, padding: obSpacing.md, borderRadius: 12, backgroundColor: obColors.selectedFill },
  bannerError: { backgroundColor: obColors.notice },
  bannerText: { flex: 1, fontFamily: obFonts.bodyMedium, fontSize: 15, lineHeight: 20, color: obColors.textPrimary },
  card: { paddingHorizontal: obSpacing.lg, paddingVertical: obSpacing.xs, borderRadius: 14, backgroundColor: '#FFFDF8', borderWidth: 1, borderColor: '#E4DCCB' },
  actions: { flexDirection: 'row', gap: obSpacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E4DCCB' },
  action: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, minHeight: 44 },
  actionText: { fontFamily: obFonts.bodyMedium, fontSize: 14, lineHeight: 19, color: obColors.textPrimary },
  danger: { color: obColors.error },
  add: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: obSpacing.sm, minHeight: 48, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: obColors.border },
  addText: { fontFamily: obFonts.bodySemiBold, fontSize: 15, lineHeight: 20, color: obColors.cta },
  noTopic: { gap: obSpacing.sm },
});
