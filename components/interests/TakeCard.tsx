// The conversation starter card (D87–D93, mockup "From Interest to Profile"):
// subject chip ("Running · Activity"), the short question and the member's
// own answer. Read-only — likes / comments on it are a later package. Never
// claims anything shared ("You both…") — no commonality is computed yet.
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';

import { TAKE_KIND_ICON, TAKE_KIND_LABEL, takeQuestionText } from '@/lib/interests/takes';
import { obColors, obFonts, obSpacing } from '@/lib/onboardingV2/theme';
import type { PublicTake } from '@/lib/onboardingV2/yourProfile';

export function TakeCard({ take, style }: { take: PublicTake; style?: StyleProp<ViewStyle> }) {
  const question = takeQuestionText(take.questionId) ?? '';
  return (
    <View
      style={[styles.card, style]}
      accessible
      accessibilityLabel={`Conversation starter. ${take.subjectTitle}, ${TAKE_KIND_LABEL[take.kind]}. ${question} ${take.answer}`}>
      <View style={styles.chip}>
        <Ionicons name={TAKE_KIND_ICON[take.kind] as keyof typeof Ionicons.glyphMap} size={16} color={obColors.cta} importantForAccessibility="no" />
        <Text style={styles.chipText} numberOfLines={2} maxFontSizeMultiplier={1.6}>
          {take.subjectTitle}
          <Text style={styles.chipKind}>{` · ${TAKE_KIND_LABEL[take.kind]}`}</Text>
        </Text>
      </View>
      <Text style={styles.question} maxFontSizeMultiplier={1.6}>{question}</Text>
      <Text style={styles.answer} maxFontSizeMultiplier={1.6}>{take.answer}</Text>
    </View>
  );
}

/** Own profile only: the natural empty state (never shown to others). */
export function AddTakeCard({ onPress, style }: { onPress: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={[styles.empty, style]} accessibilityRole="button" accessibilityHint="Opens Interests & conversation starter">
      <Ionicons name="chatbubble-ellipses-outline" size={22} color={obColors.cta} importantForAccessibility="no" />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.emptyTitle} maxFontSizeMultiplier={1.6}>Add a conversation starter</Text>
        <Text style={styles.emptyText} maxFontSizeMultiplier={1.6}>One small detail about something you love.</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={obColors.textSecondary} importantForAccessibility="no" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { gap: obSpacing.sm, padding: obSpacing.lg, borderRadius: 16, backgroundColor: '#FFFDF8', borderWidth: 1, borderColor: '#E4DCCB' },
  chip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '100%',
    paddingHorizontal: obSpacing.md,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: obColors.selectedFill,
  },
  chipText: { flexShrink: 1, fontFamily: obFonts.bodyMedium, fontSize: 14, lineHeight: 19, color: obColors.textPrimary },
  chipKind: { fontFamily: obFonts.body, color: obColors.textSecondary },
  question: { fontFamily: obFonts.bodySemiBold, fontSize: 16, lineHeight: 22, color: obColors.textPrimary },
  answer: { fontFamily: obFonts.heading, fontSize: 20, lineHeight: 28, color: obColors.textPrimary },
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
    backgroundColor: '#FFFDF8',
  },
  emptyTitle: { fontFamily: obFonts.bodySemiBold, fontSize: 16, lineHeight: 22, color: obColors.textPrimary },
  emptyText: { fontFamily: obFonts.body, fontSize: 14, lineHeight: 19, color: obColors.textSecondary },
});
