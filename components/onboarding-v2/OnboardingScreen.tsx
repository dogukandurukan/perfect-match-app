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
  type StyleProp,
  type TextStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OnboardingHeader } from '@/components/onboarding-v2/OnboardingHeader';
import { obColors, obFonts, obSpacing, useOnboardingFonts } from '@/lib/onboardingV2/theme';

type Props = {
  sectionLabel?: string;
  step: number;
  totalSteps: number;
  title: string;
  /** Optional small line under the title. */
  helper?: string;
  /** Compatibility (P03 R1): ~28pt heading and a reserved title/helper block
   * so options start on the same baseline for 1–2 line titles, with or
   * without a helper. The block still grows at accessibility text sizes. */
  compactTitle?: boolean;
  /** Small decorative icon beside the heading (P04). Hidden from screen
   * readers; the heading text is the accessible label. */
  titleIcon?: ReactNode;
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

/** Heading with a small icon beside its first line. If the icon's width would
 * push the title past two lines, the icon moves above the title instead of
 * narrowing it further. Remounts per step (inside the keyed ScrollView), so
 * the decision is re-made for every title. */
function HeadingWithIcon({
  title,
  icon,
  style,
}: {
  title: string;
  icon: ReactNode;
  style: StyleProp<TextStyle>;
}) {
  const [stacked, setStacked] = useState(false);
  return (
    <View style={stacked ? styles.headingStacked : styles.headingRow}>
      <View
        style={stacked ? undefined : styles.headingIconInline}
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden>
        {icon}
      </View>
      <Text
        style={[style, !stacked && styles.headingTextInline]}
        accessibilityRole="header"
        maxFontSizeMultiplier={1.4}
        onTextLayout={(e) => {
          if (!stacked && e.nativeEvent.lines.length > 2) setStacked(true);
        }}>
        {title}
      </Text>
    </View>
  );
}

export function OnboardingScreen({
  sectionLabel,
  step,
  totalSteps,
  title,
  helper,
  compactTitle = false,
  titleIcon,
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
        <OnboardingHeader
          sectionLabel={sectionLabel}
          step={step}
          totalSteps={totalSteps}
          onBack={onBack}
        />
      </View>
      <ScrollView
        key={contentKey}
        style={styles.flex}
        contentContainerStyle={[styles.content, keyboardVisible && styles.contentKeyboard]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}>
        <View style={compactTitle ? styles.titleBlockCompact : undefined}>
          {titleIcon ? (
            <HeadingWithIcon
              title={title}
              icon={titleIcon}
              style={compactTitle ? styles.titleCompact : styles.title}
            />
          ) : (
            <Text
              style={compactTitle ? styles.titleCompact : styles.title}
              accessibilityRole="header"
              maxFontSizeMultiplier={1.4}>
              {title}
            </Text>
          )}
          {helper ? (
            <Text style={styles.helper} maxFontSizeMultiplier={1.6}>
              {helper}
            </Text>
          ) : null}
        </View>
        <View
          style={[
            styles.body,
            compactTitle && styles.bodyCompact,
            keyboardVisible && styles.bodyKeyboard,
          ]}>
          {children}
        </View>
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
  headingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  // Centres a ~20pt icon on the first 36pt title line.
  headingIconInline: {
    height: 36,
    justifyContent: 'center',
  },
  headingTextInline: {
    flex: 1,
  },
  headingStacked: {
    gap: 6,
  },
  // Two title lines (2 × 36) + helper line (6 + 20) at normal text size.
  titleBlockCompact: {
    minHeight: 98,
  },
  titleCompact: {
    fontFamily: obFonts.heading,
    fontSize: 28,
    lineHeight: 36,
    color: obColors.textPrimary,
  },
  helper: {
    marginTop: 6,
    fontFamily: obFonts.body,
    fontSize: 15,
    lineHeight: 20,
    color: obColors.textSecondary,
  },
  bodyCompact: {
    marginTop: obSpacing.xl,
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
