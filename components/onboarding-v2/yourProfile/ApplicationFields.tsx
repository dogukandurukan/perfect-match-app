// Sections 7.7 Ready to submit? and 7.8 You're on the list (P07). LOCAL
// preview only: nothing is sent, there is no application record, no review
// timeframe, no acceptance, verification or membership.
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { DevNotice } from '@/components/onboarding-v2/yourProfile/ProfilePreview';
import { obColors, obFonts, obSpacing } from '@/lib/onboardingV2/theme';
import type { Checklist } from '@/lib/onboardingV2/yourProfile';

const ITEMS: { key: keyof Checklist; label: string }[] = [
  { key: 'photos', label: 'Photos added' },
  { key: 'answers', label: 'Answers added' },
  { key: 'selfie', label: 'Selfie added' },
  { key: 'email', label: 'Email checked (demo)' },
];

export function SubmitFields({ list }: { list: Checklist }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.list}>
        {ITEMS.map((it) => {
          const done = list[it.key];
          return (
            <View
              key={it.key}
              style={styles.row}
              accessible
              accessibilityLabel={`${it.label}${done ? '' : ', missing'}`}>
              <View style={[styles.mark, done && styles.markDone]}>
                {done ? <Ionicons name="checkmark" size={14} color={obColors.onCta} /> : null}
              </View>
              <Text style={[styles.rowText, !done && styles.rowMissing]} maxFontSizeMultiplier={1.6}>
                {it.label}
              </Text>
            </View>
          );
        })}
      </View>
      <Text style={styles.body} maxFontSizeMultiplier={1.6}>
        Our team reviews every profile before it goes live. We&apos;ll email you once yours has been
        reviewed.
      </Text>
      <DevNotice text="Preview only — no application will be sent." />
    </View>
  );
}

export function ReceivedFields() {
  return (
    <View style={styles.wrap}>
      <View style={styles.copy}>
        <Text style={styles.body} maxFontSizeMultiplier={1.6}>
          We&apos;ve received your application.
        </Text>
        <Text style={styles.body} maxFontSizeMultiplier={1.6}>
          We&apos;ll email you when your profile has been reviewed.
        </Text>
      </View>
      <View style={styles.panel} accessible accessibilityLabel="Application received. Review pending.">
        <Ionicons name="checkmark-circle-outline" size={26} color={obColors.cta} importantForAccessibility="no" />
        <Text style={styles.panelTitle} maxFontSizeMultiplier={1.6}>
          Application received
        </Text>
        <Text style={styles.panelText} maxFontSizeMultiplier={1.6}>
          Review pending
        </Text>
      </View>
      <DevNotice text="Preview only — no application was submitted." />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: obSpacing.xl,
  },
  list: {
    gap: obSpacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: obSpacing.md,
    minHeight: 32,
  },
  mark: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: obColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markDone: {
    backgroundColor: obColors.cta,
    borderColor: obColors.cta,
  },
  rowText: {
    flexShrink: 1,
    fontFamily: obFonts.bodyMedium,
    fontSize: 17,
    lineHeight: 22,
    color: obColors.textPrimary,
  },
  rowMissing: {
    color: obColors.textSecondary,
  },
  copy: {
    gap: obSpacing.xs,
  },
  body: {
    fontFamily: obFonts.body,
    fontSize: 15,
    lineHeight: 21,
    color: obColors.textSecondary,
  },
  panel: {
    alignItems: 'center',
    gap: 2,
    backgroundColor: obColors.selectedFill,
    borderRadius: 12,
    padding: obSpacing.lg,
  },
  panelTitle: {
    marginTop: obSpacing.xs,
    fontFamily: obFonts.bodySemiBold,
    fontSize: 17,
    lineHeight: 22,
    color: obColors.cta,
  },
  panelText: {
    fontFamily: obFonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: obColors.textSecondary,
  },
});
