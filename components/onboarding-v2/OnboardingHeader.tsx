// Onboarding V2 header: back · Tempa wordmark · section name + local progress.
// The progress label is section-local ("1 of 6" = Basics only), never total
// onboarding progress (DECISIONS D6).
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { TempaWordmark } from '@/components/onboarding-v2/TempaWordmark';
import { obColors, obFonts, obSpacing } from '@/lib/onboardingV2/theme';

type Props = {
  /** Section name shown above the local progress, e.g. "Basics". */
  sectionLabel?: string;
  step: number;
  totalSteps: number;
  /** Omit to hide the back control (keeps the wordmark centered). */
  onBack?: () => void;
};

export function OnboardingHeader({ sectionLabel, step, totalSteps, onBack }: Props) {
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
        <View
          accessible
          accessibilityLabel={`${sectionLabel ? `${sectionLabel}, ` : ''}step ${step} of ${totalSteps}`}
          style={styles.progressCol}>
          {sectionLabel ? (
            <Text style={styles.section} numberOfLines={1} maxFontSizeMultiplier={1.3}>
              {sectionLabel}
            </Text>
          ) : null}
          <Text style={styles.progress} maxFontSizeMultiplier={1.4}>
            {step} of {totalSteps}
          </Text>
        </View>
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
    width: 104,
    minHeight: 44,
    justifyContent: 'center',
  },
  sideRight: {
    alignItems: 'flex-end',
  },
  progressCol: {
    alignItems: 'flex-end',
  },
  section: {
    fontFamily: obFonts.bodyMedium,
    fontSize: 12,
    lineHeight: 16,
    color: obColors.textPrimary,
  },
  progress: {
    fontFamily: obFonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: obColors.textSecondary,
  },
});
