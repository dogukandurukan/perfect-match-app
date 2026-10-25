// "What you're looking for" — intention, priorities and connection style,
// shown inside the live first-submit screen (D104b). Presentational only;
// PreviewFlow owns the stage, the server-confirmed answers, local edits and
// saving. Existing onboarding tokens and option cards; no new theme.
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, type ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { OnboardingOptionCard } from '@/components/onboarding-v2/OnboardingOptionCard';
import { useRevealInScroll } from '@/components/onboarding-v2/OnboardingScrollContext';
import {
  ALSO_OPEN_KEYS,
  CONNECTION_COPY,
  CONNECTION_OPTIONS,
  connectionStyleSummary,
  IMPORTANCE_LABEL,
  INTENTS,
  intentSummary,
  MAX_CONNECTION,
  MAX_PRIORITIES,
  MAX_SHARED_INTERESTS,
  NOT_SURE,
  PRIORITY_TOPICS,
  prioritiesSummary,
  type ConnectionAnswers,
  type Importance,
  type IntentKey,
  type Priorities,
  type PriorityTopicKey,
} from '@/lib/onboardingV2/connection';
import { obColors, obFonts, obRadius, obSpacing } from '@/lib/onboardingV2/theme';
import { INTERESTS } from '@/lib/onboardingV2/yourWorld';

type IconName = keyof typeof Ionicons.glyphMap;
const interestLabel = (k: string) => INTERESTS.find((i) => i.key === k)?.label;

function PrivacyNote({ short = false }: { short?: boolean }) {
  return (
    <View style={styles.privacy} accessible accessibilityLabel={CONNECTION_COPY.privacy}>
      <Ionicons name="lock-closed-outline" size={16} color={obColors.textSecondary} importantForAccessibility="no" />
      <Text style={styles.privacyText} maxFontSizeMultiplier={1.6}>
        {short ? CONNECTION_COPY.privacyShort : CONNECTION_COPY.privacy}
      </Text>
    </View>
  );
}

function Notice({ text }: { text: string | null }) {
  return text ? (
    <Text style={styles.notice} accessibilityLiveRegion="polite" maxFontSizeMultiplier={1.6}>
      {text}
    </Text>
  ) : null;
}

function ClearLink({ onPress, busy }: { onPress: () => void; busy: boolean }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={busy}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={CONNECTION_COPY.clearAnswer}
      accessibilityState={{ disabled: busy }}
      style={styles.clear}>
      <Text style={styles.clearText}>{CONNECTION_COPY.clearAnswer}</Text>
    </TouchableOpacity>
  );
}

/** Compact checkbox (square) or radio (round) row used inside cards. */
function MarkRow({ label, selected, mode, disabled, onPress }: { label: string; selected: boolean; mode: 'multi' | 'single'; disabled?: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      accessibilityRole={mode === 'single' ? 'radio' : 'checkbox'}
      accessibilityLabel={label}
      accessibilityState={mode === 'single' ? { selected, disabled } : { checked: selected, disabled }}
      style={[styles.markRow, disabled && styles.dim]}>
      <View style={[mode === 'single' ? styles.radio : styles.box, selected && styles.markOn]}>
        {selected ? mode === 'single' ? <View style={styles.radioDot} /> : <Ionicons name="checkmark" size={14} color={obColors.onCta} /> : null}
      </View>
      <Text style={styles.markLabel} maxFontSizeMultiplier={1.6}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function ImportanceToggle({ value, label, onChange }: { value: Importance; label: string; onChange: (v: Importance) => void }) {
  return (
    <View style={styles.segment} accessibilityRole="radiogroup" accessibilityLabel={`How important: ${label}`}>
      {(['preference', 'must_have'] as Importance[]).map((v) => (
        <TouchableOpacity
          key={v}
          onPress={() => onChange(v)}
          accessibilityRole="radio"
          accessibilityLabel={`${IMPORTANCE_LABEL[v]}, ${label}`}
          accessibilityState={{ selected: value === v }}
          style={[styles.segmentItem, value === v && styles.segmentOn]}>
          <Text style={[styles.segmentText, value === v && styles.segmentTextOn]} maxFontSizeMultiplier={1.4}>
            {IMPORTANCE_LABEL[v]}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function Chip({ label, selected, disabled, onPress, removable }: { label: string; selected: boolean; disabled?: boolean; onPress: () => void; removable?: boolean }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected, disabled }}
      style={[styles.chip, selected && styles.chipOn, disabled && styles.dim]}>
      {selected && !removable ? <Ionicons name="checkmark" size={16} color={obColors.onCta} importantForAccessibility="no" /> : null}
      <Text style={[styles.chipText, selected && styles.chipTextOn]} maxFontSizeMultiplier={1.5}>
        {label}
      </Text>
      {selected && removable ? <Ionicons name="close" size={16} color={obColors.onCta} importantForAccessibility="no" /> : null}
    </TouchableOpacity>
  );
}

// ─── Invite ────────────────────────────────────────────────────────────────
export function ConnectionInviteFields({ intentRequired }: { intentRequired: boolean }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <Ionicons name="document-text-outline" size={26} color={obColors.cta} importantForAccessibility="no" />
        <View style={styles.cardText}>
          <Text style={styles.cardTitle} maxFontSizeMultiplier={1.5}>
            {CONNECTION_COPY.inviteCardTitle}
          </Text>
          <Text style={styles.cardBody} maxFontSizeMultiplier={1.6}>
            {CONNECTION_COPY.inviteCardBody}
          </Text>
        </View>
      </View>
      {intentRequired ? (
        <Text style={styles.body} maxFontSizeMultiplier={1.6}>
          {CONNECTION_COPY.inviteRequired}
        </Text>
      ) : null}
      <PrivacyNote />
    </View>
  );
}

// ─── 1 · Intention ─────────────────────────────────────────────────────────
export function IntentFields({
  intent,
  also,
  onPrimary,
  onToggleAlso,
  busy,
  notice,
}: {
  intent: IntentKey | undefined;
  also: IntentKey[];
  onPrimary: (k: IntentKey) => void;
  onToggleAlso: (k: IntentKey) => void;
  busy: boolean;
  notice: string | null;
}) {
  const alsoOptions = ALSO_OPEN_KEYS.filter((k) => k !== intent);
  return (
    <View style={styles.wrap}>
      <View style={styles.options} accessibilityRole="radiogroup">
        {INTENTS.map((o) => (
          <OnboardingOptionCard key={o.key} label={o.title} mode="single" selected={intent === o.key} selectedFill onPress={() => !busy && onPrimary(o.key)} />
        ))}
      </View>
      {intent ? (
        <View style={styles.group}>
          <Text style={styles.groupTitle} accessibilityRole="header" maxFontSizeMultiplier={1.5}>
            {CONNECTION_COPY.alsoOpen}
          </Text>
          <Text style={styles.groupHelper} maxFontSizeMultiplier={1.6}>
            {CONNECTION_COPY.alsoOpenHelper}
          </Text>
          <View style={styles.chips}>
            {alsoOptions.map((k) => (
              <Chip key={k} label={INTENTS.find((i) => i.key === k)!.title} selected={also.includes(k)} onPress={() => !busy && onToggleAlso(k)} />
            ))}
          </View>
        </View>
      ) : null}
      <PrivacyNote short />
      <Notice text={notice} />
    </View>
  );
}

// ─── 2 · Priorities ────────────────────────────────────────────────────────
export function PrioritiesFields({
  priorities,
  myInterests,
  onToggleTopic,
  onToggleDetail,
  onImportance,
  canClear,
  onClear,
  busy,
  notice,
  focus,
}: {
  priorities: Priorities;
  myInterests: string[];
  onToggleTopic: (k: PriorityTopicKey) => void;
  onToggleDetail: (k: PriorityTopicKey, d: string) => void;
  onImportance: (k: PriorityTopicKey, d: string, v: Importance) => void;
  canClear: boolean;
  onClear: () => void;
  busy: boolean;
  notice: string | null;
  /** Scrolls this topic's card into view (n changes on every request). */
  focus: { key: PriorityTopicKey; n: number } | null;
}) {
  const chosen = PRIORITY_TOPICS.filter((t) => !!priorities[t.key]);
  const full = chosen.length >= MAX_PRIORITIES;
  const interestKeys = myInterests.filter((k) => k !== 'other' && interestLabel(k));
  const reveal = useRevealInScroll();
  const cardRefs = useRef<Partial<Record<PriorityTopicKey, View | null>>>({});
  useEffect(() => {
    if (!focus) return;
    const node = cardRefs.current[focus.key];
    if (node) reveal({ current: node });
  }, [focus, reveal]);
  return (
    <View style={[styles.wrap, styles.tail]}>
      <Text style={styles.count} accessibilityLiveRegion="polite" maxFontSizeMultiplier={1.6}>
        {chosen.length} of {MAX_PRIORITIES} selected
      </Text>
      <View style={styles.chips}>
        {PRIORITY_TOPICS.map((t) => {
          const on = !!priorities[t.key];
          return <Chip key={t.key} label={t.title} selected={on} disabled={busy || (full && !on)} onPress={() => onToggleTopic(t.key)} />;
        })}
      </View>
      {chosen.map((t) => {
        const picked = priorities[t.key] ?? {};
        const pickedKeys = Object.keys(picked);
        const interestsFull = t.mode === 'interests' && pickedKeys.length >= MAX_SHARED_INTERESTS;
        return (
          <View
            key={t.key}
            ref={(n) => {
              cardRefs.current[t.key] = n;
            }}
            collapsable={false}
            style={styles.topicCard}>
            <Text style={styles.topicTitle} accessibilityRole="header" maxFontSizeMultiplier={1.5}>
              {t.title}
            </Text>
            {t.mode === 'interests' ? (
              <>
                <Text style={styles.groupHelper} maxFontSizeMultiplier={1.6}>
                  {CONNECTION_COPY.sharedInterestsHelper}
                </Text>
                <View style={styles.chips}>
                  {interestKeys.map((k) => {
                    const on = !!picked[k];
                    return <Chip key={k} label={interestLabel(k)!} selected={on} removable disabled={busy || (interestsFull && !on)} onPress={() => onToggleDetail(t.key, k)} />;
                  })}
                </View>
                {/* The chip above names the interest; its importance sits in one labelled group. */}
                {pickedKeys.map((k) => (
                  <View key={k} style={styles.detailGroup}>
                    <View style={styles.interestRow}>
                      <Text style={styles.interestName} numberOfLines={2} maxFontSizeMultiplier={1.5}>
                        {interestLabel(k) ?? k}
                      </Text>
                      <View style={styles.interestToggle}>
                        <ImportanceToggle value={picked[k]} label={interestLabel(k) ?? k} onChange={(v) => onImportance(t.key, k, v)} />
                      </View>
                    </View>
                  </View>
                ))}
              </>
            ) : (
              t.details.map((r) => {
                const on = !!picked[r.key];
                // Option and its Preference / Must-have in ONE group; the label is written once.
                return (
                  <View key={r.key} style={on ? styles.detailGroup : undefined}>
                    <MarkRow label={r.title} mode={t.mode === 'single' ? 'single' : 'multi'} selected={on} disabled={busy} onPress={() => onToggleDetail(t.key, r.key)} />
                    {on ? (
                      <View style={styles.detailToggle}>
                        <ImportanceToggle value={picked[r.key]} label={r.title} onChange={(v) => onImportance(t.key, r.key, v)} />
                      </View>
                    ) : null}
                  </View>
                );
              })
            )}
            {pickedKeys.length === 0 ? (
              <Text style={styles.hint} maxFontSizeMultiplier={1.6}>
                {CONNECTION_COPY.detailNeeded}
              </Text>
            ) : null}
          </View>
        );
      })}
      {canClear ? <ClearLink onPress={onClear} busy={busy} /> : null}
      <PrivacyNote short />
      <Notice text={notice} />
    </View>
  );
}

// ─── 3 · Connection style ──────────────────────────────────────────────────
export function ConnectionStyleFields({
  selected,
  onToggle,
  canClear,
  onClear,
  busy,
  notice,
}: {
  selected: string[];
  onToggle: (k: string) => void;
  canClear: boolean;
  onClear: () => void;
  busy: boolean;
  notice: string | null;
}) {
  const full = selected.filter((k) => k !== NOT_SURE).length >= MAX_CONNECTION;
  return (
    <View style={styles.wrap}>
      <View style={styles.options}>
        {CONNECTION_OPTIONS.map((o) => {
          const on = selected.includes(o.key);
          // Full: other options wait until one is deselected; "not sure" replaces the choices.
          const blocked = full && !on && o.key !== NOT_SURE;
          return (
            <View key={o.key} style={blocked ? styles.dim : undefined}>
              <OnboardingOptionCard label={o.title} mode="multi" selected={on} selectedFill onPress={() => !busy && !blocked && onToggle(o.key)} />
            </View>
          );
        })}
      </View>
      {canClear ? <ClearLink onPress={onClear} busy={busy} /> : null}
      <PrivacyNote short />
      <Notice text={notice} />
    </View>
  );
}

// ─── Summary ───────────────────────────────────────────────────────────────
function SummaryCard({ icon, title, children }: { icon: IconName; title: string; children: ReactNode }) {
  return (
    <View style={styles.summaryCard}>
      <View style={styles.summaryIcon}>
        <Ionicons name={icon} size={20} color={obColors.cta} importantForAccessibility="no" />
      </View>
      <View style={styles.cardText}>
        <Text style={styles.cardTitle} accessibilityRole="header" maxFontSizeMultiplier={1.5}>
          {title}
        </Text>
        {children}
      </View>
    </View>
  );
}

export function ConnectionSummaryFields({ answers }: { answers: ConnectionAnswers }) {
  const intent = intentSummary(answers);
  const matters = prioritiesSummary(answers, interestLabel);
  const style = connectionStyleSummary(answers);
  return (
    <View style={styles.wrap}>
      {intent ? (
        <SummaryCard icon="heart-outline" title={CONNECTION_COPY.summaryIntent}>
          <Text style={styles.cardBodyDark} maxFontSizeMultiplier={1.6}>
            {intent.main}
          </Text>
          {intent.also ? (
            <Text style={styles.cardBody} maxFontSizeMultiplier={1.6}>
              {intent.also}
            </Text>
          ) : null}
        </SummaryCard>
      ) : null}
      {matters ? (
        <SummaryCard icon="leaf-outline" title={CONNECTION_COPY.summaryMatters}>
          {matters === 'none' ? (
            <Text style={styles.cardBodyDark} maxFontSizeMultiplier={1.6}>
              {CONNECTION_COPY.noPreferences}.
            </Text>
          ) : (
            matters.map((row) => (
              <View key={row.topic} style={styles.summaryTopic}>
                <Text style={styles.summaryTopicTitle} maxFontSizeMultiplier={1.5}>
                  {row.topic}
                </Text>
                {row.details.map((d) => (
                  <View key={d.title} style={styles.summaryDetail} accessible accessibilityLabel={`${d.title}, ${d.importance}`}>
                    <Text style={styles.summaryDetailText} maxFontSizeMultiplier={1.6}>
                      {d.title}
                    </Text>
                    <View style={[styles.tag, d.importance === IMPORTANCE_LABEL.must_have && styles.tagStrong]}>
                      <Text style={[styles.tagText, d.importance === IMPORTANCE_LABEL.must_have && styles.tagTextStrong]} maxFontSizeMultiplier={1.4}>
                        {d.importance}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ))
          )}
        </SummaryCard>
      ) : null}
      {style ? (
        <SummaryCard icon="people-outline" title={CONNECTION_COPY.summaryStyle}>
          <Text style={styles.cardBodyDark} maxFontSizeMultiplier={1.6}>
            {style}
          </Text>
        </SummaryCard>
      ) : null}
      <Text style={styles.footnote} maxFontSizeMultiplier={1.6}>
        {CONNECTION_COPY.summaryNote}
      </Text>
    </View>
  );
}

/** Submit screen: back to the summary (only when answers are saved on the server). */
export function ConnectionSubmitCard({ onView }: { onView: () => void }) {
  return (
    <TouchableOpacity
      onPress={onView}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`${CONNECTION_COPY.cardTitle}. ${CONNECTION_COPY.cardStatus}. ${CONNECTION_COPY.view}`}
      style={[styles.card, styles.submitCard]}>
      <Ionicons name="document-text-outline" size={24} color={obColors.cta} importantForAccessibility="no" />
      <View style={styles.cardText}>
        <Text style={styles.cardTitleSmall} maxFontSizeMultiplier={1.5}>
          {CONNECTION_COPY.cardTitle}
        </Text>
        <View style={styles.statusRow}>
          <Ionicons name="lock-closed" size={12} color={obColors.textSecondary} importantForAccessibility="no" />
          <Text style={styles.status} maxFontSizeMultiplier={1.5}>
            {CONNECTION_COPY.cardStatus}
          </Text>
        </View>
      </View>
      <Text style={styles.view} maxFontSizeMultiplier={1.4}>
        {CONNECTION_COPY.view}
      </Text>
      <Ionicons name="chevron-forward" size={16} color={obColors.textPrimary} importantForAccessibility="no" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: obSpacing.lg },
  options: { gap: obSpacing.sm },
  group: { gap: obSpacing.sm },
  groupTitle: { fontFamily: obFonts.bodySemiBold, fontSize: 16, lineHeight: 22, color: obColors.textPrimary },
  groupHelper: { fontFamily: obFonts.body, fontSize: 14, lineHeight: 20, color: obColors.textSecondary },
  body: { fontFamily: obFonts.body, fontSize: 15, lineHeight: 21, color: obColors.textPrimary },
  count: { fontFamily: obFonts.body, fontSize: 14, lineHeight: 20, color: obColors.textSecondary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: obSpacing.sm },
  chip: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: obColors.border,
    borderRadius: 22,
  },
  chipOn: { backgroundColor: obColors.cta, borderColor: obColors.cta },
  chipText: { fontFamily: obFonts.bodyMedium, fontSize: 15, lineHeight: 20, color: obColors.textPrimary },
  chipTextOn: { color: obColors.onCta },
  dim: { opacity: 0.45 },
  topicCard: { gap: obSpacing.sm, padding: obSpacing.lg, borderRadius: obRadius.button, backgroundColor: obColors.selectedFill },
  topicTitle: { fontFamily: obFonts.bodySemiBold, fontSize: 16, lineHeight: 22, color: obColors.textPrimary },
  markRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: obSpacing.md },
  box: { width: 22, height: 22, borderRadius: 5, borderWidth: 1.5, borderColor: obColors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: obColors.background },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: obColors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: obColors.background },
  markOn: { borderColor: obColors.cta, backgroundColor: obColors.cta },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: obColors.onCta },
  markLabel: { flex: 1, fontFamily: obFonts.body, fontSize: 16, lineHeight: 22, color: obColors.textPrimary },
  detailGroup: { borderRadius: 12, padding: obSpacing.sm, backgroundColor: obColors.background, borderWidth: 1, borderColor: obColors.border },
  detailToggle: { paddingLeft: 22 + obSpacing.md, paddingBottom: obSpacing.xs },
  interestRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: obSpacing.sm },
  interestName: { minWidth: 72, flexShrink: 1, fontFamily: obFonts.bodyMedium, fontSize: 15, lineHeight: 20, color: obColors.textPrimary },
  interestToggle: { flexGrow: 1, minWidth: 200 },
  tail: { paddingBottom: obSpacing.lg },
  segment: { flexDirection: 'row', padding: 3, borderRadius: 12, backgroundColor: obColors.background, borderWidth: 1, borderColor: obColors.border },
  segmentItem: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 9 },
  segmentOn: { backgroundColor: obColors.cta },
  segmentText: { fontFamily: obFonts.bodyMedium, fontSize: 14, lineHeight: 19, color: obColors.textSecondary },
  segmentTextOn: { color: obColors.onCta },
  hint: { fontFamily: obFonts.body, fontSize: 14, lineHeight: 20, color: obColors.error },
  card: { flexDirection: 'row', alignItems: 'center', gap: obSpacing.md, padding: obSpacing.lg, borderRadius: obRadius.button, backgroundColor: obColors.notice },
  submitCard: { marginTop: obSpacing.lg },
  cardText: { flex: 1, gap: 4 },
  cardTitle: { fontFamily: obFonts.heading, fontSize: 17, lineHeight: 23, color: obColors.textPrimary },
  cardTitleSmall: { fontFamily: obFonts.bodyMedium, fontSize: 15, lineHeight: 20, color: obColors.textPrimary },
  cardBody: { fontFamily: obFonts.body, fontSize: 15, lineHeight: 21, color: obColors.textSecondary },
  cardBodyDark: { fontFamily: obFonts.body, fontSize: 15, lineHeight: 21, color: obColors.textPrimary },
  summaryCard: { flexDirection: 'row', alignItems: 'flex-start', gap: obSpacing.md, padding: obSpacing.lg, borderRadius: obRadius.button, backgroundColor: obColors.selectedFill },
  summaryIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: obColors.background },
  summaryTopic: { gap: 4, paddingTop: 2 },
  summaryTopicTitle: { fontFamily: obFonts.bodySemiBold, fontSize: 15, lineHeight: 21, color: obColors.textPrimary },
  summaryDetail: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: obSpacing.sm },
  summaryDetailText: { flexShrink: 1, fontFamily: obFonts.body, fontSize: 15, lineHeight: 21, color: obColors.textPrimary },
  tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, borderWidth: 1, borderColor: obColors.border, backgroundColor: obColors.background },
  tagStrong: { backgroundColor: obColors.cta, borderColor: obColors.cta },
  tagText: { fontFamily: obFonts.bodyMedium, fontSize: 12, lineHeight: 17, color: obColors.textSecondary },
  tagTextStrong: { color: obColors.onCta },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  status: { fontFamily: obFonts.body, fontSize: 13, lineHeight: 18, color: obColors.textSecondary },
  view: { fontFamily: obFonts.bodyMedium, fontSize: 14, lineHeight: 20, color: obColors.textPrimary },
  privacy: { flexDirection: 'row', gap: obSpacing.sm, alignItems: 'flex-start' },
  privacyText: { flex: 1, fontFamily: obFonts.body, fontSize: 14, lineHeight: 20, color: obColors.textSecondary },
  notice: { fontFamily: obFonts.body, fontSize: 14, lineHeight: 20, color: obColors.error },
  clear: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  clearText: { fontFamily: obFonts.bodyMedium, fontSize: 15, lineHeight: 20, color: obColors.textPrimary, textDecorationLine: 'underline' },
  footnote: { fontFamily: obFonts.body, fontSize: 13, lineHeight: 18, color: obColors.textSecondary, textAlign: 'center' },
});
