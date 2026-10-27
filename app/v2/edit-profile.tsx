// Profile → Edit profile (D105 Package 1 + D106 layout, owner 2026-10-27).
// One page, three parts — Photos / Answers / Details; the tabs at the top
// scroll to the part. Every detail shows its real visibility (Public = on the
// profile others see via get_profile_v2; Private = never shown) and whether it
// can be changed now:
//   • Photos: the current photos (main first). "Change order" opens the
//     existing order / main-photo editor; adding or removing photos isn't
//     available (no button for it). "Recently" (book / song) sits here too.
//   • Answers: the saved prompt answers (locked) and the conversation
//     starters (existing Interests editor).
//   • Details: the Package 1 sections + locked details.
// Reloads on every focus, so a saved change shows here at once.
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OnboardingPrimaryButton } from '@/components/onboarding-v2/OnboardingPrimaryButton';
import { RecentlyRows } from '@/components/profile/RecentlyRows';
import { loadMyInterests } from '@/lib/interests/interestsV2';
import { ACTIVITIES } from '@/lib/interests/takes';
import { GENDER_OPTIONS, INTERESTED_IN_OPTIONS } from '@/lib/onboardingV2/basics';
import { VALUE_OPTIONS } from '@/lib/onboardingV2/compatibility';
import { obColors, obFonts, obSpacing } from '@/lib/onboardingV2/theme';
import { promptLabel } from '@/lib/onboardingV2/yourProfile';
import { INTERESTS } from '@/lib/onboardingV2/yourWorld';
import { loadMemberProfile, type MemberProfileLoad } from '@/lib/profile/memberProfile';
import { ageFromIso, sectionSummary, type SectionId } from '@/lib/profile/memberProfileCore';
import { loadMyRecently } from '@/lib/profile/recently';
import { recentlyForDisplay, type PublicRecently } from '@/lib/profile/recentlyCore';
import { resolveProfilePhotoUrl } from '@/lib/resolveProfilePhotoUrl';
import { supabase } from '@/lib/supabaseClient';

// One short note per part / section; locked rows only carry a lock icon.
const LOCKED_NOTE = 'Details with a lock can’t be changed yet.';
type Part = 'photos' | 'answers' | 'details';
const SCROLL_TOP = obSpacing.md; // the scroll content's top padding
const TITLE_GAP = obSpacing.sm; // space kept above a part's title after a jump
const PARTS: { key: Part; label: string }[] = [
  { key: 'photos', label: 'Photos' },
  { key: 'answers', label: 'Answers' },
  { key: 'details', label: 'Details' },
];

type Row = {
  key: string;
  label: string;
  value: string;
  visibility: 'Public' | 'Private';
  /** A route to open, or null when the detail is locked. */
  to: string | null;
};

type Ready = {
  userId: string;
  profile: Extract<MemberProfileLoad, { ok: true }>;
  photoUrls: (string | null)[];
  recently: PublicRecently | null;
  starters: number | null;
};
type Load = { kind: 'loading' } | { kind: 'error'; text: string } | ({ kind: 'ready' } & Ready);

const titleOf = (v: unknown): string => (v && typeof v === 'object' && typeof (v as { title?: unknown }).title === 'string' ? (v as { title: string }).title : '');
const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
/** The member's real choices as labels, in their order (unknown keys left out). */
const labels = (keys: unknown, catalog: { key: string; label: string }[]): string[] =>
  (Array.isArray(keys) ? keys : []).map((k) => catalog.find((c) => c.key === k)?.label).filter((x): x is string => !!x);

function detailSections(r: Ready): { title: string; rows: Row[] }[] {
  const p = r.profile;
  const d = (p.bundle.draft ?? {}) as Record<string, unknown>;
  const f = p.fields;
  const edit = (s: SectionId) => `/v2/edit-profile-section?section=${s}`;
  const interests = [...labels(d.interests, INTERESTS), ...labels(d.activities, ACTIVITIES)].join(', ');
  const values = labels(d.core_values, VALUE_OPTIONS).join(', ');
  const age = ageFromIso(d.date_of_birth);
  const interestedIn = (Array.isArray(d.interested_in) ? d.interested_in : [])
    .map((k) => INTERESTED_IN_OPTIONS.find((o) => o.key === k)?.label)
    .filter(Boolean)
    .join(', ');
  return [
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
        { key: 'jobTitle', label: 'Job title', value: p.jobTitle || '—', visibility: 'Public', to: null },
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
      title: 'Interests & values',
      rows: [
        { key: 'interests', label: 'Interests & activities', value: interests || 'None yet', visibility: 'Public', to: '/v2/edit-interests' },
        { key: 'values', label: 'What matters most', value: values || '—', visibility: 'Public', to: null },
      ],
    },
  ];
}

function RowList({ rows, onOpen }: { rows: Row[]; onOpen: (to: string) => void }) {
  return (
    <View style={styles.card}>
      {rows.map((row, i) => {
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
              <Text style={styles.value} maxFontSizeMultiplier={1.6}>
                {row.value}
              </Text>
            </View>
            <Ionicons name={row.to ? 'chevron-forward' : 'lock-closed-outline'} size={18} color={obColors.textSecondary} importantForAccessibility="no" />
          </>
        );
        const rowStyle = [styles.row, i > 0 && styles.rowDivider];
        return row.to ? (
          <TouchableOpacity
            key={row.key}
            onPress={() => onOpen(row.to as string)}
            accessibilityRole="button"
            accessibilityLabel={`${row.label}, ${row.value}, ${row.visibility}`}
            accessibilityHint="Opens the editor"
            style={rowStyle}>
            {body}
          </TouchableOpacity>
        ) : (
          <View key={row.key} style={rowStyle} accessible accessibilityLabel={`${row.label}, ${row.value}, ${row.visibility}. Locked`}>
            {body}
          </View>
        );
      })}
    </View>
  );
}

export default function EditProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [reload, setReload] = useState(0);
  const [active, setActive] = useState<Part>('photos');
  const scrollRef = useRef<ScrollView>(null);
  // Parts sit in one wrapper (the scroll content without its top padding);
  // their layout positions only drive the active tab while scrolling.
  const partRef = useRef<Record<Part, View | null>>({ photos: null, answers: null, details: null });
  const partY = useRef<Record<Part, number>>({ photos: 0, answers: 0, details: 0 });
  const jumping = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The visible scroll area (right under the fixed header + tabs) and the
  // current offset: a jump compares real on-screen positions, so it doesn't
  // depend on any assumed header, padding or layout height.
  const viewportRef = useRef<View>(null);
  const offset = useRef(0);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      void (async () => {
        const [{ data: s }, profile, rec, ints] = await Promise.all([supabase.auth.getSession(), loadMemberProfile(), loadMyRecently(), loadMyInterests()]);
        if (!live) return;
        const userId = s.session?.user?.id;
        if (!userId) return setLoad({ kind: 'error', text: 'Not signed in.' });
        if (!profile.ok) return setLoad({ kind: 'error', text: profile.text });
        if (!rec.ok) return setLoad({ kind: 'error', text: rec.text });
        const photos = [...profile.bundle.photos].sort((a, b) => a.position - b.position);
        const photoUrls = await Promise.all(photos.map((ph) => resolveProfilePhotoUrl(ph.path)));
        if (!live) return;
        setLoad({
          kind: 'ready',
          userId,
          profile,
          photoUrls,
          recently: recentlyForDisplay(rec.draft),
          starters: ints.kind === 'ok' ? ints.value.takes.length : null,
        });
      })();
      return () => {
        live = false;
      };
    }, [reload]),
  );

  const at = (part: Part) => (e: LayoutChangeEvent) => {
    partY.current[part] = e.nativeEvent.layout.y;
  };
  const setPartRef = (part: Part) => (v: View | null) => {
    partRef.current[part] = v;
  };
  // The part's title is its first child: scrolling to the part's top puts the
  // whole title right under the fixed header + tabs (they sit outside the
  // scroll view), with a small gap.
  const scrollToOffset = (y: number) => {
    if (jumping.current) clearTimeout(jumping.current);
    jumping.current = setTimeout(() => (jumping.current = null), 600);
    scrollRef.current?.scrollTo({ y: Math.max(0, y), animated: true });
  };
  // Fallback when on-screen measuring isn't available: layout position.
  const scrollToLayoutY = (y: number) => scrollToOffset(SCROLL_TOP + y - TITLE_GAP);
  const goTo = (part: Part) => {
    setActive(part);
    const node = partRef.current[part];
    const viewport = viewportRef.current;
    if (!node || !viewport) return scrollToLayoutY(partY.current[part]);
    // Where the part's title (its first child) is on screen now vs. the top
    // of the visible scroll area → move by exactly that, keeping a small gap.
    node.measureInWindow((_x, titleTop) =>
      viewport.measureInWindow((_vx, viewTop) => scrollToOffset(offset.current + (titleTop - viewTop) - TITLE_GAP)),
    );
  };
  const onScroll = (y: number) => {
    offset.current = y;
    if (jumping.current) return; // a tab jump in progress decides the tab
    const top = y - SCROLL_TOP + TITLE_GAP + 1;
    const p: Part = top >= partY.current.details ? 'details' : top >= partY.current.answers ? 'answers' : 'photos';
    if (p !== active) setActive(p);
  };

  const header = (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back" style={styles.iconBtn}>
        <Ionicons name="chevron-back" size={24} color={obColors.textPrimary} />
      </TouchableOpacity>
      <Text style={styles.title} accessibilityRole="header" numberOfLines={1} maxFontSizeMultiplier={1.4}>
        Edit profile
      </Text>
      {load.kind === 'ready' ? (
        <TouchableOpacity
          onPress={() => router.push(`/v2/profile?userId=${load.userId}&own=1` as never)}
          accessibilityRole="button"
          accessibilityLabel="Preview your profile"
          hitSlop={6}
          style={styles.previewBtn}>
          <Text style={styles.previewText} maxFontSizeMultiplier={1.3}>
            Preview
          </Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.iconBtn} />
      )}
    </View>
  );

  if (load.kind !== 'ready') {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        {header}
        <View style={styles.center}>
          {load.kind === 'loading' ? (
            <ActivityIndicator color={obColors.cta} accessibilityLabel="Loading your profile" />
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

  const prompts = [...load.profile.bundle.prompts].filter((p) => p.answer?.trim()).sort((a, b) => a.slot - b.slot);
  const open = (to: string) => router.push(to as never);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {header}
      <View style={styles.tabs} accessibilityRole="tablist">
        {PARTS.map((p) => (
          <TouchableOpacity
            key={p.key}
            onPress={() => goTo(p.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active === p.key }}
            style={[styles.tab, active === p.key && styles.tabOn]}>
            <Text style={[styles.tabText, active === p.key && styles.tabTextOn]} maxFontSizeMultiplier={1.4}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View ref={viewportRef} collapsable={false} style={styles.viewport}>
      <ScrollView
        ref={scrollRef}
        onScroll={(e) => onScroll(e.nativeEvent.contentOffset.y)}
        scrollEventThrottle={64}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + obSpacing.xxl * 3 }]}>
        <View style={styles.parts}>
        <View ref={setPartRef('photos')} collapsable={false} onLayout={at('photos')} style={styles.part}>
          <View style={styles.partHead}>
            <Text style={styles.partTitle} accessibilityRole="header" maxFontSizeMultiplier={1.4}>
              Photos
            </Text>
            <TouchableOpacity onPress={() => open('/v2/edit-photos')} accessibilityRole="button" accessibilityLabel="Change photo order and main photo" hitSlop={8}>
              <Text style={styles.link}>Change order</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.grid}>
            {load.photoUrls.map((url, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => open('/v2/edit-photos')}
                accessibilityRole="button"
                accessibilityLabel={i === 0 ? 'Main photo. Change order' : `Photo ${i + 1}. Change order`}
                style={styles.cell}>
                {url ? <Image source={{ uri: url }} style={styles.photo} contentFit="cover" /> : <View style={[styles.photo, styles.photoEmpty]} />}
                {i === 0 ? (
                  <View style={styles.mainBadge}>
                    <Text style={styles.mainText}>Main</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.note} maxFontSizeMultiplier={1.6}>
            You can change the order and your main photo. Adding or removing photos isn’t available yet.
          </Text>
          <View style={styles.recently}>
            <RecentlyRows recently={load.recently} onEdit={() => open('/v2/edit-recently')} hint="Optional · Stays until you change it." />
          </View>
        </View>

        <View ref={setPartRef('answers')} collapsable={false} onLayout={at('answers')} style={styles.part}>
          <Text style={styles.partTitle} accessibilityRole="header" maxFontSizeMultiplier={1.4}>
            Your answers
          </Text>
          {prompts.length ? (
            <Text style={styles.note} maxFontSizeMultiplier={1.6}>
              Prompt answers can’t be changed yet. Conversation starters can.
            </Text>
          ) : null}
          {prompts.map((p) => (
            <View key={p.slot} style={styles.answer} accessible accessibilityLabel={`${promptLabel(p.prompt_id as never)}. ${p.answer}. Locked`}>
              <View style={styles.answerHead}>
                <Text style={styles.answerLabel} maxFontSizeMultiplier={1.5}>
                  {promptLabel(p.prompt_id as never)}
                </Text>
                <Ionicons name="lock-closed-outline" size={16} color={obColors.textSecondary} importantForAccessibility="no" />
              </View>
              <Text style={styles.answerText} maxFontSizeMultiplier={1.6}>
                {p.answer}
              </Text>
            </View>
          ))}
          <RowList
            onOpen={open}
            rows={[
              {
                key: 'starters',
                label: 'Conversation starters',
                value: load.starters === null ? 'Open to see them' : count(load.starters, 'starter', 'starters'),
                visibility: 'Public',
                to: '/v2/edit-interests',
              },
            ]}
          />
        </View>

        <View ref={setPartRef('details')} collapsable={false} onLayout={at('details')} style={styles.part}>
          <Text style={styles.partTitle} accessibilityRole="header" maxFontSizeMultiplier={1.4}>
            Details
          </Text>
          <Text style={styles.note} maxFontSizeMultiplier={1.6}>
            Public details are shown on your profile. Private details are never shown.
          </Text>
          {detailSections(load).map((s) => (
            <View key={s.title} style={styles.section}>
              <Text style={styles.sectionTitle} accessibilityRole="header" maxFontSizeMultiplier={1.5}>
                {s.title}
              </Text>
              {s.rows.some((r) => !r.to) ? (
                <Text style={styles.sectionNote} maxFontSizeMultiplier={1.6}>
                  {LOCKED_NOTE}
                </Text>
              ) : null}
              <RowList rows={s.rows} onOpen={open} />
            </View>
          ))}
        </View>
        </View>
      </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: obColors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: obSpacing.sm, minHeight: 52, backgroundColor: obColors.background },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontFamily: obFonts.heading, fontSize: 22, lineHeight: 29, color: obColors.textPrimary },
  previewBtn: { minHeight: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: obColors.cta, alignItems: 'center', justifyContent: 'center', marginRight: obSpacing.xs },
  previewText: { fontFamily: obFonts.bodySemiBold, fontSize: 14, lineHeight: 19, color: obColors.cta },
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E4DCCB', paddingHorizontal: obSpacing.gutter },
  tab: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabOn: { borderBottomColor: obColors.cta },
  tabText: { fontFamily: obFonts.bodyMedium, fontSize: 15, lineHeight: 20, color: obColors.textSecondary },
  tabTextOn: { color: obColors.cta, fontFamily: obFonts.bodySemiBold },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: obSpacing.md, paddingHorizontal: obSpacing.gutter },
  body: { fontFamily: obFonts.body, fontSize: 16, lineHeight: 22, color: obColors.textPrimary, textAlign: 'center' },
  scroll: { paddingHorizontal: obSpacing.gutter, paddingTop: SCROLL_TOP },
  parts: { gap: obSpacing.xxl },
  viewport: { flex: 1 },
  part: { gap: obSpacing.md },
  partHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  partTitle: { fontFamily: obFonts.heading, fontSize: 20, lineHeight: 26, color: obColors.textPrimary },
  link: { fontFamily: obFonts.bodySemiBold, fontSize: 14, lineHeight: 19, color: obColors.cta, textDecorationLine: 'underline' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: obSpacing.sm },
  cell: { width: '31.5%', aspectRatio: 4 / 5, borderRadius: 10, overflow: 'hidden' },
  photo: { width: '100%', height: '100%', backgroundColor: obColors.notice },
  photoEmpty: { backgroundColor: obColors.notice },
  mainBadge: { position: 'absolute', left: 6, bottom: 6, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.55)' },
  mainText: { fontFamily: obFonts.bodySemiBold, fontSize: 12, lineHeight: 16, color: '#FFFFFF' },
  note: { fontFamily: obFonts.body, fontSize: 13, lineHeight: 18, color: obColors.textSecondary },
  recently: { paddingTop: obSpacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E4DCCB' },
  answer: { gap: 4, padding: obSpacing.lg, borderRadius: 14, backgroundColor: obColors.selectedFill },
  answerHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: obSpacing.sm },
  answerLabel: { flexShrink: 1, fontFamily: obFonts.bodyMedium, fontSize: 14, lineHeight: 19, color: obColors.textSecondary },
  answerText: { fontFamily: obFonts.body, fontSize: 16, lineHeight: 22, color: obColors.textPrimary },
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
  sectionNote: { fontFamily: obFonts.body, fontSize: 13, lineHeight: 18, color: obColors.textSecondary },
});
