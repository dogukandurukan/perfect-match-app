// V2 Section 1 Account — shared presentational pieces of the email-code
// sign-in screen (app/v2/welcome.tsx). Extracted so the DEV design preview
// (app/dev/design-preview.tsx) renders the SAME copy and consent row as the
// live screen instead of a copy of it. No state, no backend calls here.
import { StyleSheet, Text, TouchableOpacity } from 'react-native';

import { obColors, obFonts } from '@/lib/onboardingV2/theme';

/** Live Account screen copy (email-code sign-in). */
export const ACCOUNT_COPY = {
  sectionLabel: 'Account',
  emailTitle: "What's your email?",
  emailHelper: "We'll send you a code to sign in.",
  codeTitle: 'Enter your code',
  codeHelper: (email: string) => `We sent a sign-in code to ${email}.`,
  emailLabel: 'Email',
  codeLabel: 'Sign-in code',
  sendCode: 'Send code',
  continue: 'Continue',
  busy: 'Please wait…',
  resend: 'Resend code',
  resendIn: (s: number) => `Resend code in ${s}s`,
  errors: {
    rateLimited: 'Please wait a moment before asking for another code.',
    sendFailed: "We couldn't send a code. Check the address and try again.",
    codeInvalid: 'That code isn’t valid or has expired. Use the newest code or send a new one.',
    codeWrong: "That code isn't right. Try again.",
  },
} as const;

const CONSENT_LABEL = 'I have read the Privacy Notice and agree to the processing of my personal data';

/** KVKK consent checkbox — never pre-checked; required before a code is sent. */
export function ConsentRow({
  checked,
  onToggle,
  onOpenNotice,
}: {
  checked: boolean;
  onToggle: () => void;
  onOpenNotice: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={CONSENT_LABEL}
      hitSlop={6}
      style={styles.consentRow}>
      <Text style={styles.box}>{checked ? '☑' : '☐'}</Text>
      <Text style={styles.consentText} maxFontSizeMultiplier={1.6}>
        {'I have read the '}
        <Text style={styles.consentLink} onPress={onOpenNotice}>
          Privacy Notice
        </Text>
        {' and agree to the processing of my personal data.'}
      </Text>
    </TouchableOpacity>
  );
}

/** Inline error above the primary button (same look as the live screen). */
export function AccountError({ text }: { text: string }) {
  return (
    <Text style={styles.error} accessibilityLiveRegion="polite" maxFontSizeMultiplier={1.6}>
      {text}
    </Text>
  );
}

/** Underlined text action, e.g. "Resend code". */
export function AccountLink({
  label,
  onPress,
  disabled = false,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      hitSlop={10}
      style={styles.link}>
      <Text style={[styles.linkText, disabled && styles.linkDisabled]} maxFontSizeMultiplier={1.6}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export const accountStyles = StyleSheet.create({
  consentText: { flex: 1, fontFamily: obFonts.body, fontSize: 15, lineHeight: 21, color: obColors.textSecondary },
});

const styles = StyleSheet.create({
  error: { fontFamily: obFonts.body, fontSize: 15, lineHeight: 21, color: '#A33A2B', textAlign: 'center', marginBottom: 8 },
  link: { minHeight: 44, justifyContent: 'center', marginTop: 16 },
  linkText: { fontFamily: obFonts.bodySemiBold, fontSize: 16, lineHeight: 22, color: obColors.cta, textDecorationLine: 'underline' },
  linkDisabled: { color: obColors.textSecondary },
  consentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 20, minHeight: 44 },
  box: { fontSize: 22, lineHeight: 26, color: obColors.cta },
  consentText: accountStyles.consentText,
  consentLink: { color: obColors.cta, textDecorationLine: 'underline' },
});
