// Shared "one question per screen" onboarding template — layout modeled on
// Raya/Hinge's single-focus flow (big question, one control, thin top
// progress bar, pinned bottom action) instead of one long scrolling form.
// The black/monochrome colors used here became the app's colors.accent
// too (2026-09-03) — no longer a scoped exception, this is just the app
// identity now.
import type { ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { DevStepNav } from '@/components/ui/DevStepNav';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { colors } from '@/lib/designTokens';

type QuestionScreenProps = {
  /** 1-based position within the current sub-flow (e.g. onboarding step1's screens). */
  step: number;
  totalSteps: number;
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Omit to render no bottom button — for screens that auto-advance on selection. */
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  nextLoading?: boolean;
  onBack?: () => void;
  /** Which macro onboarding step (1-4) this sub-flow belongs to, for the
   * dev jump-nav's active-step highlight. Defaults to 1 (step1's own
   * sub-flow, the original/only caller of this component). */
  macroStep?: number;
};

export function QuestionScreen({
  step,
  totalSteps,
  title,
  subtitle,
  children,
  onNext,
  nextLabel = 'Next',
  nextDisabled = false,
  nextLoading = false,
  onBack,
  macroStep = 1,
}: QuestionScreenProps) {
  const router = useRouter();
  const progress = totalSteps > 0 ? Math.min(1, step / totalSteps) : 0;
  // Same guard as SetupScreenHeader — a user can land directly on some
  // step1 screens with no history to go back to; router.back() would throw
  // "GO_BACK was not handled by any navigator". A caller-supplied onBack is
  // trusted as-is (it's their own handler).
  const showBack = Boolean(onBack) || router.canGoBack();

  return (
    <ScreenContainer style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        <View style={styles.devRow}>
          <DevStepNav current={macroStep} />
        </View>
        <View style={styles.topRow}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
        </View>

        <View style={styles.body}>
          <ThemedText style={styles.title}>{title}</ThemedText>
          {subtitle ? <ThemedText style={styles.subtitle}>{subtitle}</ThemedText> : null}
          <View style={styles.content}>{children}</View>
        </View>

        <View style={styles.bottomRow}>
          {showBack ? (
            <TouchableOpacity
              onPress={onBack ?? (() => router.back())}
              hitSlop={12}
              style={styles.prevBtn}
              accessibilityRole="button"
              accessibilityLabel="Previous">
              <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
          ) : (
            <View style={styles.prevBtn} />
          )}

          {onNext ? (
            <TouchableOpacity
              onPress={onNext}
              disabled={nextDisabled || nextLoading}
              hitSlop={8}
              style={[styles.nextBtn, (nextDisabled || nextLoading) && styles.nextBtnDisabled]}
              accessibilityRole="button"
              accessibilityLabel={nextLabel}
              accessibilityState={{ disabled: nextDisabled || nextLoading }}>
              {nextLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Ionicons
                  name={
                    nextLabel === 'Finish' || nextLabel === 'Complete Profile' ? 'checkmark' : 'arrow-forward'
                  }
                  size={22}
                  color="#FFFFFF"
                />
              )}
            </TouchableOpacity>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'flex-start',
  },
  keyboard: {
    flex: 1,
  },
  devRow: {
    height: 22,
    marginBottom: 4,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#EDEDED',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#1A1A1A', // == colors.accent
  },
  body: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
    lineHeight: 34,
  },
  subtitle: {
    marginTop: 10,
    fontSize: 15,
    color: '#888888',
    lineHeight: 21,
  },
  content: {
    marginTop: 28,
  },
  bottomRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  prevBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  nextBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1A1A1A', // == colors.accent
  },
  nextBtnDisabled: {
    backgroundColor: '#C9C9C9',
  },
});
