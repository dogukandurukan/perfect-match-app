// Onboarding V2 header: back · Tempa wordmark · section-local progress.
// The progress label is section-local ("1 of 6" = Basics only), never total
// onboarding progress (DECISIONS D6).
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { TempaWordmark } from '@/components/onboarding-v2/TempaWordmark';
import { obColors, obFonts, obSpacing } from '@/lib/onboardingV2/theme';

type Props = {
  step: number;
  totalSteps: number;
  /** Omit to hide the back control (keeps the wordmark centered). */
  onBack?: () => void;
};

export function OnboardingHeader({ step, totalSteps, onBack }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.side}>
        {onBack ? (
          <TouchableOpacity
            onPress={onBack}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={24} color={obColors.textPrimary} />
          </TouchableOpacity>
        ) : null}
      </View>
      <TempaWordmark />
      <View style={[styles.side, styles.sideRight]}>
        <Text
          style={styles.progress}
          accessibilityLabel={`Step ${step} of ${totalSteps}`}
          maxFontSizeMultiplier={1.4}>
          {step} of {totalSteps}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingTop: obSpacing.sm,
  },
  side: {
    width: 64,
    minHeight: 44,
    justifyContent: 'center',
  },
  sideRight: {
    alignItems: 'flex-end',
  },
  progress: {
    fontFamily: obFonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: obColors.textSecondary,
  },
});
