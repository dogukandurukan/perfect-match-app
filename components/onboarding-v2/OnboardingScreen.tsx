// Onboarding V2 screen shell: ivory background, safe areas, header, heading,
// scrollable content and a footer CTA that stays above the keyboard.
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OnboardingHeader } from '@/components/onboarding-v2/OnboardingHeader';
import { obColors, obFonts, obSpacing, useOnboardingFonts } from '@/lib/onboardingV2/theme';

type Props = {
  step: number;
  totalSteps: number;
  title: string;
  onBack?: () => void;
  children: ReactNode;
  /** Rendered pinned at the bottom (e.g. notices + primary button). */
  footer: ReactNode;
};

export function OnboardingScreen({ step, totalSteps, title, onBack, children, footer }: Props) {
  const insets = useSafeAreaInsets();
  const fontsReady = useOnboardingFonts();

  if (!fontsReady) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={obColors.cta} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.headerWrap, { paddingTop: insets.top }]}>
        <OnboardingHeader step={step} totalSteps={totalSteps} onBack={onBack} />
      </View>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive">
        <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.5}>
          {title}
        </Text>
        {children}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, obSpacing.lg) }]}>
        {footer}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: obColors.background,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
  },
  headerWrap: {
    paddingHorizontal: obSpacing.lg,
  },
  content: {
    paddingHorizontal: obSpacing.gutter,
    paddingTop: obSpacing.xl,
    paddingBottom: obSpacing.xl,
    gap: obSpacing.lg,
  },
  title: {
    fontFamily: obFonts.heading,
    fontSize: 30,
    lineHeight: 38,
    color: obColors.textPrimary,
    marginBottom: obSpacing.sm,
  },
  footer: {
    paddingHorizontal: obSpacing.gutter,
    paddingTop: obSpacing.md,
    gap: obSpacing.md,
    backgroundColor: obColors.background,
  },
});
