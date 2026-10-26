// Profile → Edit profile (Package 1, owner 2026-10-27): one list of every
// profile detail with its real visibility (Public = shown on the profile
// others see via get_profile_v2; Private = never shown) and whether it can be
// changed now. Editable rows open a section editor (edit-profile-section) or
// the existing Photos / Interests screens; locked rows say so and lead
// nowhere (no support link exists yet). Reloads on every focus, so a saved
// section shows its new value here at once.
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OnboardingPrimaryButton } from '@/components/onboarding-v2/OnboardingPrimaryButton';
import { GENDER_OPTIONS, INTERESTED_IN_OPTIONS } from '@/lib/onboardingV2/basics';
import { obColors, obFonts, obSpacing } from '@/lib/onboardingV2/theme';
import { loadMemberProfile, type MemberProfileLoad } from '@/lib/profile/memberProfile';
import { sectionSummary, type SectionId } from '@/lib/profile/memberProfileCore';

const LOCKED = 'This detail can’t be changed yet';

type Row = {
  key: string;
  label: string;
  value: string;
  visibility: 'Public' | 'Private';
  /** A route to open, or null when the detail is locked. */
  to: string | null;
};

const ageFrom = (iso: unknown): number | null => {
  if (typeof iso !== 'string') return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) a -= 1;
  return a;
};
const titleOf = (v: unknown): string => (v && typeof v === 'object' && typeof (v as { title?: unknown }).title === 'string' ? (v as { title: string }).title : '');
const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function buildSections(r: Extract<MemberProfileLoad, { ok: true }>): { title: string; rows: Row[] }[] {
  const d = (r.bundle.draft ?? {}) as Record<string, unknown>;
  const f = r.fields;
  const edit = (s: SectionId) => `/v2/edit-profile-section?section=${s}`;
  const interests = Array.isArray(d.interests) ? d.interests.length : 0;
  const prompts = r.bundle.prompts.filter((p) => p.answer?.trim()).length;
  const values = Array.isArray(d.core_values) ? d.core_values.length : 0;
  const age = ageFrom(d.date_of_birth);
  const interestedIn = (Array.isArray(d.interested_in) ? d.interested_in : [])
    .map((k) => INTERESTED_IN_OPTIONS.find((o) => o.key === k)?.label)
    .filter(Boolean)
    .join(', ');
  return [
    {
      title: 'Photos & interests',
      rows: [
        { key: 'photos', label: 'Photos', value: `${count(r.bundle.photos.length, 'photo', 'photos')} · order and main photo`, visibility: 'Public', to: '/v2/edit-photos' },
        { key: 'interests', label: 'Interests & conversation starters', value: count(interests, 'interest', 'interests'), visibility: 'Public', to: '/v2/edit-interests' },
      ],
    },
    {
      title: 'Looking for',
      rows: [{ key: 'lookingFor', label: 'Looking for', value: sectionSummary('lookingFor', f), visibility: 'Public', to: edit('lookingFor') }],
    },
    {
      title: 'About you',
      rows: [
        { key: 'name', label: 'First name', value: String(d.first_name ?? '').trim() || '—', visibility: 'Public', to: null },
        { key: 'age', label: 'Age', value: age !== null ? String(age) : '—', visibility: 'Public', to: null },
        { key: 'gender', label: 'Gender', value: GENDER_OPTIONS.find((o) => o.key === d.gender)?.label ?? '—', visibility: 'Private', to: null },
        { key: 'interestedIn', label: 'Interested in', value: interestedIn || '—', visibility: 'Private', to: null },
        { key: 'city', label: 'City', value: String(d.location_city ?? '').trim() || '—', visibility: 'Public', to: null },
        { key: 'height', label: 'Height', value: sectionSummary('height', f), visibility: 'Public', to: edit('height') },
      ],
    },
    {
      title: 'Work & education',
      rows: [
        { key: 'work', label: 'Work', value: sectionSummary('work', f), visibility: 'Public', to: edit('work') },
        { key: 'jobTitle', label: 'Job title', value: r.jobTitle || '—', visibility: 'Public', to: null },
        { key: 'school', label: 'School', value: titleOf(d.school) || '—', visibility: 'Public', to: null },
        { key: 'hometown', label: 'Hometown', value: titleOf(d.hometown) || '—', visibility: 'Public', to: null },
      ],
    },
    {
      title: 'Lifestyle',
      rows: [{ key: 'lifestyle', label: 'Smoking, drinking, pets, activity', value: sectionSummary('lifestyle', f), visibility: 'Public', to: edit('lifestyle') }],
    },
    {
      title: 'First dates',
      rows: [
        { key: 'dates', label: 'Date ideas, days and time', value: sectionSummary('dates', f), visibility: 'Public', to: edit('dates') },
        { key: 'spot', label: 'Favorite spot', value: String(d.favorite_spot ?? '').trim() || '—', visibility: 'Public', to: null },
      ],
    },
    {
      title: 'Prompts & values',
      rows: [
        { key: 'prompts', label: 'Prompts', value: count(prompts, 'answer', 'answers'), visibility: 'Public', to: null },
        { key: 'values', label: 'What matters most', value: count(values, 'value', 'values'), visibility: 'Public', to: null },
      ],
    },
  ];
}

export default function EditProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [load, setLoad] = useState<MemberProfileLoad | null>(null);
  const [reload, setReload] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      void loadMemberProfile().then((r) => {
        if (live) setLoad(r);
      });
      return () => {
        live = false;
      };
    }, [reload]),
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back" style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={obColors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title} accessibilityRole="header" numberOfLines={1} maxFontSizeMultiplier={1.4}>
          Edit profile
        </Text>
        <View style={styles.iconBtn} />
      </View>
      {!load ? (
        <View style={styles.center}>
          <ActivityIndicator color={obColors.cta} accessibilityLabel="Loading your profile" />
        </View>
      ) : !load.ok ? (
        <View style={styles.center}>
          <Text style={styles.body}>{load.text}</Text>
          <OnboardingPrimaryButton label="Try again" variant="outline" onPress={() => setReload((n) => n + 1)} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + obSpacing.xl }]}>
          <Text style={styles.hint} maxFontSizeMultiplier={1.6}>
            Public details are shown on your profile. Private details are never shown.
          </Text>
          {buildSections(load).map((s) => (
            <View key={s.title} style={styles.section}>
              <Text style={styles.sectionTitle} accessibilityRole="header" maxFontSizeMultiplier={1.5}>
                {s.title}
              </Text>
              <View style={styles.card}>
                {s.rows.map((row, i) => {
                  const body = (
                    <>
                      <View style={styles.rowText}>
                        <View style={styles.labelRow}>
                          <Text style={styles.label} maxFontSizeMultiplier={1.5}>
                            {row.label}
                          </Text>
                          <Text style={[styles.tag, row.visibility === 'Private' && styles.tagPrivate]} maxFontSizeMultiplier={1.3}>
                            {row.visibility}
                          </Text>
                        </View>
                        <Text style={styles.value} numberOfLines={2} maxFontSizeMultiplier={1.6}>
                          {row.value}
                        </Text>
                        {row.to ? null : (
                          <Text style={styles.locked} maxFontSizeMultiplier={1.6}>
                            {LOCKED}
                          </Text>
                        )}
                      </View>
                      <Ionicons
                        name={row.to ? 'chevron-forward' : 'lock-closed-outline'}
                        size={18}
                        color={obColors.textSecondary}
                        importantForAccessibility="no"
                      />
                    </>
                  );
                  const rowStyle = [styles.row, i > 0 && styles.rowDivider];
                  return row.to ? (
                    <TouchableOpacity
                      key={row.key}
                      onPress={() => router.push(row.to as never)}
                      accessibilityRole="button"
                      accessibilityLabel={`${row.label}, ${row.value}, ${row.visibility}`}
                      accessibilityHint="Opens the editor"
                      style={rowStyle}>
                      {body}
                    </TouchableOpacity>
                  ) : (
                    <View key={row.key} style={rowStyle} accessible accessibilityLabel={`${row.label}, ${row.value}, ${row.visibility}. ${LOCKED}`}>
                      {body}
                    </View>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
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
  section: { gap: obSpacing.sm },
  sectionTitle: { fontFamily: obFonts.bodySemiBold, fontSize: 13, lineHeight: 18, letterSpacing: 0.4, textTransform: 'uppercase', color: obColors.textSecondary },
  card: { borderRadius: 14, backgroundColor: '#FFFDF8', borderWidth: 1, borderColor: '#E4DCCB' },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: obSpacing.md, paddingHorizontal: obSpacing.lg, paddingVertical: obSpacing.md },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E4DCCB' },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  labelRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: obSpacing.sm },
  label: { flexShrink: 1, fontFamily: obFonts.bodyMedium, fontSize: 16, lineHeight: 21, color: obColors.textPrimary },
  tag: { fontFamily: obFonts.bodyMedium, fontSize: 11, lineHeight: 15, color: obColors.cta, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8, backgroundColor: obColors.selectedFill, overflow: 'hidden' },
  tagPrivate: { color: obColors.textSecondary, backgroundColor: obColors.notice },
  value: { fontFamily: obFonts.body, fontSize: 15, lineHeight: 20, color: obColors.textSecondary },
  locked: { fontFamily: obFonts.body, fontSize: 13, lineHeight: 18, color: obColors.textSecondary, fontStyle: 'italic' },
});
