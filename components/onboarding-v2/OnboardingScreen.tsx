// Onboarding V2 screen shell (D46): flat warm ivory, visible Tempa header,
// large Playfair heading, scrollable content and a footer CTA that stays
// above the open keyboard. Light only — there is no dark-theme variant, so the
// status bar is pinned dark here regardless of the phone's appearance setting.
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Keyboard,
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
  /** Changing this remounts the scroll view (e.g. per step) so each step
   * starts scrolled to the top. */
  contentKey?: string | number;
};

function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvt, () => setVisible(true));
    const hide = Keyboard.addListener(hideEvt, () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return visible;
}

export function OnboardingScreen({
  step,
  totalSteps,
  title,
  onBack,
  children,
  footer,
  contentKey,
}: Props) {
  const insets = useSafeAreaInsets();
  const fontsReady = useOnboardingFonts();
  const keyboardVisible = useKeyboardVisible();

  if (!fontsReady) {
    return (
      <View style={[styles.root, styles.center]}>
        <StatusBar style="dark" />
        <ActivityIndicator color={obColors.cta} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style="dark" />
      <View style={[styles.headerWrap, { paddingTop: insets.top }]}>
        <OnboardingHeader step={step} totalSteps={totalSteps} onBack={onBack} />
      </View>
      <ScrollView
        key={contentKey}
        style={styles.flex}
        contentContainerStyle={[styles.content, keyboardVisible && styles.contentKeyboard]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}>
        <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.4}>
          {title}
        </Text>
        <View style={[styles.body, keyboardVisible && styles.bodyKeyboard]}>{children}</View>
      </ScrollView>
      <View
        style={[
          styles.footer,
          // With the keyboard open the home indicator is covered, so the
          // bottom safe-area inset would only add a gap above the keyboard.
          { paddingBottom: keyboardVisible ? obSpacing.md : Math.max(insets.bottom, obSpacing.lg) },
        ]}>
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
    flexGrow: 1,
    paddingHorizontal: obSpacing.gutter,
    paddingTop: obSpacing.xxl,
    paddingBottom: obSpacing.xl,
  },
  contentKeyboard: {
    paddingTop: obSpacing.lg,
    paddingBottom: obSpacing.md,
  },
  title: {
    fontFamily: obFonts.heading,
    fontSize: 36,
    lineHeight: 44,
    color: obColors.textPrimary,
  },
  body: {
    marginTop: obSpacing.xxl + obSpacing.sm,
    gap: obSpacing.xxl,
  },
  bodyKeyboard: {
    marginTop: obSpacing.xl,
    gap: obSpacing.xl,
  },
  footer: {
    paddingHorizontal: obSpacing.gutter,
    paddingTop: obSpacing.md,
    gap: obSpacing.md,
    backgroundColor: obColors.background,
  },
});
