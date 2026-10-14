// Conversation starters on a profile (D87–D97): ONE compact section with 0–3
// rows — subject line ("Running · Activity"), the short question and the
// member's own answer in regular body text. Read-only: likes / comments are a
// later package. Never claims anything shared ("You both…") — no commonality
// is computed yet. Nothing is rendered for an empty list.
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';

import { TAKE_KIND_ICON, TAKE_KIND_LABEL, takeQuestionText } from '@/lib/interests/takes';
import { obColors, obFonts, obSpacing } from '@/lib/onboardingV2/theme';
import type { PublicTake } from '@/lib/onboardingV2/yourProfile';

const SURFACE = '#FFFDF8';
const BORDER = '#E4DCCB';

/** One take: subject line, question, answer (also used in the edit screen). */
export function TakeRow({ take }: { take: PublicTake }) {
  const question = takeQuestionText(take.questionId, take.subjectId) ?? '';
  return (
    <View style={styles.row} accessible accessibilityLabel={`${take.subjectTitle}, ${TAKE_KIND_LABEL[take.kind]}. ${question} ${take.answer}`}>
      <View style={styles.subject}>
        <Ionicons name={TAKE_KIND_ICON[take.kind] as keyof typeof Ionicons.glyphMap} size={15} color={obColors.cta} importantForAccessibility="no" />
        <Text style={styles.subjectText} numberOfLines={2} maxFontSizeMultiplier={1.6}>
          {take.subjectTitle}
          <Text style={styles.kind}>{` · ${TAKE_KIND_LABEL[take.kind]}`}</Text>
        </Text>
      </View>
      <Text style={styles.question} maxFontSizeMultiplier={1.6}>{question}</Text>
      <Text style={styles.answer} maxFontSizeMultiplier={1.6}>{take.answer}</Text>
    </View>
  );
}

export function TakesSection({ takes, style }: { takes: PublicTake[]; style?: StyleProp<ViewStyle> }) {
  if (takes.length === 0) return null;
  return (
    <View style={[styles.card, style]}>
      <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.6}>Conversation starters</Text>
      {takes.map((t, i) => (
        <View key={`${t.kind}:${t.subjectId}`} style={i > 0 ? styles.divided : undefined}>
          <TakeRow take={t} />
        </View>
      ))}
    </View>
  );
}

/** Own profile only: the natural empty state (never shown to others). */
export function AddTakeCard({ onPress, style }: { onPress: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={[styles.empty, style]} accessibilityRole="button" accessibilityHint="Opens Your interests">
      <Ionicons name="chatbubble-ellipses-outline" size={22} color={obColors.cta} importantForAccessibility="no" />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.emptyTitle} maxFontSizeMultiplier={1.6}>Add a conversation starter</Text>
        <Text style={styles.emptyText} maxFontSizeMultiplier={1.6}>A small detail about something you love.</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={obColors.textSecondary} importantForAccessibility="no" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { paddingHorizontal: obSpacing.lg, paddingVertical: obSpacing.md, borderRadius: 16, backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER },
  title: { fontFamily: obFonts.bodySemiBold, fontSize: 13, lineHeight: 18, color: obColors.textSecondary, marginBottom: obSpacing.xs },
  divided: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: BORDER },
  row: { gap: 3, paddingVertical: obSpacing.sm },
  subject: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  subjectText: { flexShrink: 1, fontFamily: obFonts.bodyMedium, fontSize: 14, lineHeight: 19, color: obColors.cta },
  kind: { fontFamily: obFonts.body, color: obColors.textSecondary },
  question: { fontFamily: obFonts.bodyMedium, fontSize: 15, lineHeight: 20, color: obColors.textPrimary },
  answer: { fontFamily: obFonts.body, fontSize: 16, lineHeight: 22, color: obColors.textPrimary },
  empty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: obSpacing.md,
    minHeight: 64,
    padding: obSpacing.lg,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: obColors.border,
    backgroundColor: SURFACE,
  },
  emptyTitle: { fontFamily: obFonts.bodySemiBold, fontSize: 16, lineHeight: 22, color: obColors.textPrimary },
  emptyText: { fontFamily: obFonts.body, fontSize: 14, lineHeight: 19, color: obColors.textSecondary },
});
