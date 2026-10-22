// "How do you connect?" — optional questions shown inside the live first-submit
// screen (D104). Presentational only; PreviewFlow owns the stage and answers.
// Uses the existing onboarding option cards; no new theme.
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { OnboardingOptionCard } from '@/components/onboarding-v2/OnboardingOptionCard';
import { CONNECTION_COPY, type ConnectionQuestion } from '@/lib/onboardingV2/connection';
import { obColors, obFonts, obSpacing } from '@/lib/onboardingV2/theme';

function PrivacyNote() {
  return (
    <View style={styles.privacy} accessible accessibilityLabel={CONNECTION_COPY.privacy}>
      <Ionicons name="lock-closed-outline" size={16} color={obColors.textSecondary} importantForAccessibility="no" />
      <Text style={styles.privacyText} maxFontSizeMultiplier={1.6}>
        {CONNECTION_COPY.privacy}
      </Text>
    </View>
  );
}

export function ConnectionInviteFields({ notice }: { notice: string | null }) {
  return (
    <View style={styles.wrap}>
      <PrivacyNote />
      {notice ? <Text style={styles.notice} accessibilityLiveRegion="polite">{notice}</Text> : null}
    </View>
  );
}

export function ConnectionQuestionFields({
  question,
  value,
  onPick,
  notice,
}: {
  question: ConnectionQuestion;
  value: string | undefined;
  onPick: (key: string) => void;
  notice: string | null;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.options} accessibilityRole="radiogroup">
        {question.options.map((o) => (
          <OnboardingOptionCard key={o.key} label={o.title} mode="single" selected={value === o.key} onPress={() => onPick(o.key)} />
        ))}
      </View>
      <PrivacyNote />
      {notice ? <Text style={styles.notice} accessibilityLiveRegion="polite">{notice}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: obSpacing.lg },
  options: { gap: obSpacing.sm },
  privacy: { flexDirection: 'row', gap: obSpacing.sm, alignItems: 'flex-start' },
  privacyText: { flex: 1, fontFamily: obFonts.body, fontSize: 14, lineHeight: 20, color: obColors.textSecondary },
  notice: { fontFamily: obFonts.body, fontSize: 14, lineHeight: 20, color: '#A33A2B' },
});
