// One Edit profile section (Package 1): Looking for, Height, Work, Lifestyle
// or First dates. Same behaviour as Photos / Interests:
//   • changes stay a local draft until Save; Save sends only what changed plus
//     the values this screen loaded (update_member_profile_v2);
//   • nothing looks saved until the server said so; a failure keeps the draft
//     for a retry; a change made elsewhere → "Reload" (asks first when the
//     draft has unsaved changes), never a silent overwrite;
//   • leaving with unsaved changes asks "Discard changes?".
// Uses the onboarding answer components; private preferences are not touched.
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HeightFields } from '@/components/onboarding-v2/basics/BasicsFields';
import { SingleChoiceFields } from '@/components/onboarding-v2/compatibility/CompatibilityFields';
import { OnboardingOptionCard } from '@/components/onboarding-v2/OnboardingOptionCard';
import { OnboardingPrimaryButton } from '@/components/onboarding-v2/OnboardingPrimaryButton';
import { DateTypesFields, DaysTimeFields } from '@/components/onboarding-v2/yourDates/YourDatesFields';
import { LifeQuestionFields } from '@/components/onboarding-v2/yourLife/YourLifeFields';
import { EMPTY_BASICS_DRAFT, parseHeightCm } from '@/lib/onboardingV2/basics';
import { EMPTY_COMPAT_DRAFT, SINGLE_QUESTIONS } from '@/lib/onboardingV2/compatibility';
import { obColors, obFonts, obSpacing } from '@/lib/onboardingV2/theme';
import { DATES_SCREENS } from '@/lib/onboardingV2/yourDates';
import { LIFE_QUESTIONS, type LifeDraft } from '@/lib/onboardingV2/yourLife';
import { WORK_OPTIONS } from '@/lib/onboardingV2/yourWorld';
import { loadMemberProfile, saveMemberProfile } from '@/lib/profile/memberProfile';
import {
  changesFor,
  isDirty,
  isSectionId,
  normalise,
  SECTION_TITLES,
  sectionProblem,
  type MemberFields,
  type SectionId,
} from '@/lib/profile/memberProfileCore';

type Load = { kind: 'loading' } | { kind: 'error'; text: string } | { kind: 'ready' };
type Banner = { kind: 'error'; text: string; changed: boolean } | { kind: 'saved' } | null;

const intentQuestion = SINGLE_QUESTIONS.find((q) => q.id === 'intent')!;

export default function EditProfileSectionScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ section?: string }>();
  const section: SectionId | null = isSectionId(params.section) ? params.section : null;

  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [reload, setReload] = useState(0);
  const [saved, setSaved] = useState<MemberFields | null>(null); // what the server has (as loaded / saved)
  const [draft, setDraft] = useState<MemberFields | null>(null);
  const [jobTitle, setJobTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<Banner>(null);
  const busy = useRef(false);
  const dirty = !!section && !!saved && !!draft && isDirty(section, saved, draft);
  const problem = section && draft ? sectionProblem(section, normalise(draft)) : null;

  useEffect(() => {
    let live = true;
    void (async () => {
      setLoad({ kind: 'loading' });
      const r = await loadMemberProfile();
      if (!live) return;
      if (!r.ok) return setLoad({ kind: 'error', text: r.text });
      setSaved(r.fields);
      setDraft(r.fields);
      setJobTitle(r.jobTitle);
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
      Alert.alert('Discard changes?', 'Your changes haven’t been saved.', [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(e.data.action as never) },
      ]);
    });
    return unsub;
  }, [navigation, dirty]);

  const save = useCallback(async () => {
    if (busy.current || !section || !saved || !draft || !dirty || problem) return;
    busy.current = true;
    setSaving(true);
    setBanner(null);
    const { changes, expected } = changesFor(section, saved, draft);
    const r = await saveMemberProfile(changes, expected);
    busy.current = false;
    setSaving(false);
    if (r.ok) {
      setSaved(r.fields);
      setDraft(r.fields);
      setBanner({ kind: 'saved' });
      return;
    }
    // Keep the draft on screen for a retry.
    setBanner({ kind: 'error', text: r.text, changed: r.changed });
  }, [section, saved, draft, dirty, problem]);

  const reloadLatest = () => {
    if (!dirty) return setReload((n) => n + 1);
    Alert.alert('Reload your profile?', 'Your unsaved changes will be replaced by the saved details.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reload', onPress: () => setReload((n) => n + 1) },
    ]);
  };

  const patch = (p: Partial<MemberFields>) => {
    setBanner(null);
    setDraft((d) => (d ? { ...d, ...p } : d));
  };

  const header = (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back" style={styles.iconBtn}>
        <Ionicons name="chevron-back" size={24} color={obColors.textPrimary} />
      </TouchableOpacity>
      <Text style={styles.title} accessibilityRole="header" numberOfLines={1} maxFontSizeMultiplier={1.4}>
        {section ? SECTION_TITLES[section] : 'Edit profile'}
      </Text>
      <View style={styles.iconBtn} />
    </View>
  );

  if (!section || load.kind !== 'ready' || !draft) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        {header}
        <View style={styles.center}>
          {!section ? (
            <Text style={styles.body}>This section isn’t available.</Text>
          ) : load.kind === 'error' ? (
            <>
              <Text style={styles.body}>{load.text}</Text>
              <OnboardingPrimaryButton label="Try again" variant="outline" onPress={() => setReload((n) => n + 1)} />
            </>
          ) : (
            <ActivityIndicator color={obColors.cta} />
          )}
        </View>
      </View>
    );
  }

  const life: LifeDraft = { smoking: draft.smoking, drinking: draft.drinking, pets: draft.pets, activity: draft.activity, petKind: draft.petKind };
  const dates = { dateTypes: draft.dateTypes, spotText: '', days: draft.days as never, time: draft.time as never };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {header}
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 160 }]} keyboardShouldPersistTaps="handled">
        {section === 'lookingFor' ? (
          <>
            <Text style={styles.hint} maxFontSizeMultiplier={1.6}>
              Shown on your profile as “Looking for”. Optional. Your private preferences aren’t changed here.
            </Text>
            <SingleChoiceFields question={intentQuestion} draft={{ ...EMPTY_COMPAT_DRAFT, intent: draft.intent }} update={(p) => patch({ intent: p.intent ?? null })} />
            {draft.intent ? (
              <TouchableOpacity onPress={() => patch({ intent: null })} disabled={saving} hitSlop={8} accessibilityRole="button" style={styles.textBtn}>
                <Text style={styles.link}>Don’t show this on my profile</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.hint} maxFontSizeMultiplier={1.6}>
                Nothing selected — “Looking for” isn’t shown on your profile.
              </Text>
            )}
          </>
        ) : null}

        {section === 'height' ? (
          <>
            <Text style={styles.hint} maxFontSizeMultiplier={1.6}>
              Shown on your profile.
            </Text>
            <HeightFields
              draft={{ ...EMPTY_BASICS_DRAFT, heightCm: draft.heightCm ? String(draft.heightCm) : '' }}
              update={(p) => (p.heightCm !== undefined ? patch({ heightCm: parseHeightCm(p.heightCm) }) : undefined)}
              onSubmit={() => {}}
            />
          </>
        ) : null}

        {section === 'work' ? (
          <>
            <Text style={styles.hint} maxFontSizeMultiplier={1.6}>
              {jobTitle
                ? `Your profile shows your job title (“${jobTitle}”) instead of this. Your job title isn’t changed here.`
                : 'Shown on your profile. Optional — tap your choice again to remove it.'}
            </Text>
            <View style={styles.options} accessibilityRole="radiogroup">
              {WORK_OPTIONS.map((o) => (
                <OnboardingOptionCard
                  key={o.key}
                  label={o.title}
                  mode="single"
                  selected={draft.workStatus === o.key}
                  onPress={() => patch({ workStatus: draft.workStatus === o.key ? null : o.key })}
                />
              ))}
            </View>
          </>
        ) : null}

        {section === 'lifestyle' ? (
          <>
            <Text style={styles.hint} maxFontSizeMultiplier={1.6}>
              Shown on your profile.
            </Text>
            {LIFE_QUESTIONS.map((q) => (
              <View key={q.id} style={styles.group}>
                <Text style={styles.groupTitle} accessibilityRole="header" maxFontSizeMultiplier={1.5}>
                  {q.title}
                </Text>
                <LifeQuestionFields
                  question={q}
                  draft={life}
                  update={(p) => patch({ ...(p as Partial<MemberFields>) })}
                />
              </View>
            ))}
          </>
        ) : null}

        {section === 'dates' ? (
          <>
            <Text style={styles.hint} maxFontSizeMultiplier={1.6}>
              Shown on your profile. Your favorite spot isn’t changed here.
            </Text>
            <View style={styles.group}>
              <Text style={styles.groupTitle} accessibilityRole="header" maxFontSizeMultiplier={1.5}>
                {DATES_SCREENS[0].title}
              </Text>
              <DateTypesFields hideSpot draft={dates} update={(p) => (p.dateTypes ? patch({ dateTypes: p.dateTypes }) : undefined)} />
            </View>
            <View style={styles.group}>
              <Text style={styles.groupTitle} accessibilityRole="header" maxFontSizeMultiplier={1.5}>
                {DATES_SCREENS[1].title}
              </Text>
              <DaysTimeFields
                draft={dates}
                update={(p) => patch({ ...(p.days !== undefined ? { days: p.days } : {}), ...(p.time !== undefined ? { time: p.time } : {}) })}
              />
            </View>
          </>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, obSpacing.md) }]}>
        {banner?.kind === 'error' ? (
          <View style={styles.bannerRow}>
            <Text style={styles.error} accessibilityLiveRegion="polite">
              {banner.text}
            </Text>
            {banner.changed ? (
              <TouchableOpacity onPress={reloadLatest} hitSlop={8} accessibilityRole="button" accessibilityLabel="Reload your profile">
                <Text style={styles.link}>Reload</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : banner?.kind === 'saved' && !dirty ? (
          <Text style={styles.saved} accessibilityLiveRegion="polite">
            Saved
          </Text>
        ) : dirty && problem ? (
          <Text style={styles.problem} accessibilityLiveRegion="polite">
            {problem}
          </Text>
        ) : null}
        <OnboardingPrimaryButton label={saving ? 'Saving…' : 'Save'} onPress={() => void save()} disabled={saving || !dirty || !!problem} />
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
  scroll: { paddingHorizontal: obSpacing.gutter, paddingTop: obSpacing.sm, gap: obSpacing.lg },
  hint: { fontFamily: obFonts.body, fontSize: 14, lineHeight: 20, color: obColors.textSecondary },
  options: { gap: obSpacing.md },
  group: { gap: obSpacing.md },
  groupTitle: { fontFamily: obFonts.bodySemiBold, fontSize: 17, lineHeight: 23, color: obColors.textPrimary },
  textBtn: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: obSpacing.gutter, paddingTop: obSpacing.sm, gap: obSpacing.sm, backgroundColor: obColors.background, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E4DCCB' },
  bannerRow: { flexDirection: 'row', alignItems: 'center', gap: obSpacing.sm, flexWrap: 'wrap' },
  error: { flex: 1, fontFamily: obFonts.body, fontSize: 14, lineHeight: 19, color: obColors.error },
  problem: { fontFamily: obFonts.body, fontSize: 14, lineHeight: 19, color: obColors.error, textAlign: 'center' },
  link: { fontFamily: obFonts.bodySemiBold, fontSize: 14, lineHeight: 19, color: obColors.cta, textDecorationLine: 'underline' },
  saved: { fontFamily: obFonts.bodyMedium, fontSize: 14, lineHeight: 19, color: obColors.cta, textAlign: 'center' },
});
