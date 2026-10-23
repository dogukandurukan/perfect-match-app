// "How do you like to connect?" — optional questions shown inside the live
// first-submit screen (D104). Presentational only; PreviewFlow owns the stage,
// the server-confirmed answers and saving. Existing onboarding tokens and
// option cards; no new theme.
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { OnboardingOptionCard } from '@/components/onboarding-v2/OnboardingOptionCard';
import { CONNECTION_COPY, connectionSummary, type ConnectionAnswers, type ConnectionQuestion } from '@/lib/onboardingV2/connection';
import { obColors, obFonts, obRadius, obSpacing } from '@/lib/onboardingV2/theme';

type IconName = keyof typeof Ionicons.glyphMap;

function PrivacyNote({ short = false }: { short?: boolean }) {
  const text = short ? CONNECTION_COPY.privacyShort : CONNECTION_COPY.privacy;
  return (
    <View style={styles.privacy} accessible accessibilityLabel={CONNECTION_COPY.privacy}>
      <Ionicons name="lock-closed-outline" size={16} color={obColors.textSecondary} importantForAccessibility="no" />
      <Text style={styles.privacyText} maxFontSizeMultiplier={1.6}>
        {text}
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

export function ConnectionInviteFields() {
  return (
    <View style={styles.wrap}>
      <View style={styles.art} importantForAccessibility="no-hide-descendants">
        <Ionicons name="chatbubble-outline" size={72} color={obColors.textSecondary} />
        <Ionicons name="chatbubble-outline" size={72} color={obColors.cta} style={styles.artSecond} />
      </View>
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
      <PrivacyNote />
    </View>
  );
}

export function ConnectionQuestionFields({
  question,
  selected,
  onPick,
  canClear,
  onClear,
  busy,
  notice,
}: {
  question: ConnectionQuestion;
  selected: string | undefined;
  onPick: (key: string) => void;
  /** Only when this question has a saved answer. */
  canClear: boolean;
  onClear: () => void;
  busy: boolean;
  notice: string | null;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.options} accessibilityRole="radiogroup">
        {question.options.map((o) => (
          <OnboardingOptionCard
            key={o.key}
            label={o.title}
            mode="single"
            selected={selected === o.key}
            selectedFill
            onPress={() => {
              if (!busy) onPick(o.key);
            }}
          />
        ))}
      </View>
      {canClear ? (
        <TouchableOpacity
          onPress={onClear}
          disabled={busy}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={CONNECTION_COPY.clearAnswer}
          accessibilityState={{ disabled: busy }}
          style={styles.clear}>
          <Text style={styles.clearText}>{CONNECTION_COPY.clearAnswer}</Text>
        </TouchableOpacity>
      ) : null}
      <PrivacyNote short />
      <Notice text={notice} />
    </View>
  );
}

export function ConnectionSummaryFields({ answers }: { answers: ConnectionAnswers }) {
  const rows = connectionSummary(answers);
  return (
    <View style={styles.wrap}>
      <View style={styles.rows}>
        {rows.map((r) => (
          <View key={r.id} style={styles.card} accessible accessibilityLabel={`${r.title}. ${r.text}`}>
            <Ionicons name={r.icon as IconName} size={26} color={obColors.cta} importantForAccessibility="no" />
            <View style={styles.cardText}>
              <Text style={styles.cardTitle} maxFontSizeMultiplier={1.5}>
                {r.title}
              </Text>
              <Text style={styles.cardBody} maxFontSizeMultiplier={1.6}>
                {r.text}
              </Text>
            </View>
          </View>
        ))}
      </View>
      <Text style={styles.footnote} maxFontSizeMultiplier={1.6}>
        {CONNECTION_COPY.summaryNote}
      </Text>
    </View>
  );
}

/** Submit screen: a way back to the summary (only when answers are saved). */
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
  rows: { gap: obSpacing.sm },
  art: { flexDirection: 'row', justifyContent: 'center', paddingVertical: obSpacing.md },
  artSecond: { marginLeft: -24, marginTop: 14 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: obSpacing.md,
    padding: obSpacing.lg,
    borderRadius: obRadius.button,
    backgroundColor: obColors.notice,
  },
  submitCard: { marginTop: obSpacing.lg },
  cardText: { flex: 1, gap: 2 },
  cardTitle: { fontFamily: obFonts.heading, fontSize: 17, lineHeight: 23, color: obColors.textPrimary },
  cardTitleSmall: { fontFamily: obFonts.bodyMedium, fontSize: 15, lineHeight: 20, color: obColors.textPrimary },
  cardBody: { fontFamily: obFonts.body, fontSize: 15, lineHeight: 21, color: obColors.textSecondary },
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
