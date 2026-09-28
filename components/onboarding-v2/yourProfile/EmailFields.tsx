// Sections 7.5 Your email and 7.6 Check your email (P07). SIMULATED in the
// DEV preview: no email is sent, no OTP exists, no auth user is created or
// verified. The demo check is bound to the exact email it was made for.
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { OnboardingTextField } from '@/components/onboarding-v2/OnboardingTextField';
import { useRevealInScroll } from '@/components/onboarding-v2/OnboardingScrollContext';
import { DevNotice } from '@/components/onboarding-v2/yourProfile/ProfilePreview';
import { obColors, obFonts, obSpacing } from '@/lib/onboardingV2/theme';
import {
  DEMO_CODE,
  editEmail,
  emailLooksValid,
  resendSecondsLeft,
  sanitizeCode,
  type ProfileDraft,
} from '@/lib/onboardingV2/yourProfile';

type Props = {
  draft: ProfileDraft;
  update: (patch: Partial<ProfileDraft>) => void;
  onSubmit?: () => void;
};

export function EmailFields({ draft, update, onSubmit }: Props) {
  const showError = draft.email.trim().length > 3 && draft.email.includes('@') && !emailLooksValid(draft.email);
  return (
    <View style={styles.wrap}>
      <OnboardingTextField
        label="Email"
        value={draft.email}
        onChangeText={(v) => update(editEmail(draft, v))}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="done"
        onSubmitEditing={onSubmit}
      />
      {showError ? (
        <Text style={styles.error} accessibilityLiveRegion="polite" maxFontSizeMultiplier={1.6}>
          Check your email address.
        </Text>
      ) : null}
      <Text style={styles.note} maxFontSizeMultiplier={1.6}>
        Your email stays private.
      </Text>
      <DevNotice text="Preview only — no email will be sent." />
    </View>
  );
}

const CELLS = 6;

export function CodeFields({
  draft,
  update,
  error,
  onChangeEmail,
  onResend,
  confirmed,
}: Props & { error: string | null; onChangeEmail: () => void; onResend: () => void; confirmed: boolean }) {
  const inputRef = useRef<TextInput>(null);
  const wrapRef = useRef<View>(null);
  const reveal = useRevealInScroll();
  const [now, setNow] = useState(Date.now());
  const left = resendSecondsLeft(draft.codeSentAt, now);

  useEffect(() => {
    if (left <= 0) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [left]);

  const code = draft.code;

  // Success state (P07 R1): verifying never submits — the footer then offers
  // an explicit "Submit application".
  if (confirmed) {
    return (
      <View style={styles.wrap}>
        <View style={styles.confirmed} accessibilityLiveRegion="polite" accessible>
          <Ionicons name="checkmark-circle" size={28} color={obColors.cta} importantForAccessibility="no" />
          <Text style={styles.confirmedTitle} maxFontSizeMultiplier={1.6}>
            Email confirmed
          </Text>
          <Text style={styles.sentTo} maxFontSizeMultiplier={1.6}>
            {draft.email.trim()}
          </Text>
        </View>
        <View style={styles.links}>
          <TouchableOpacity onPress={onChangeEmail} hitSlop={10} accessibilityRole="button" accessibilityLabel="Change email">
            <Text style={styles.link} maxFontSizeMultiplier={1.4}>
              Change email
            </Text>
          </TouchableOpacity>
        </View>
        <DevNotice text="Demo check only — no email was sent and no account was verified." />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.sentTo} maxFontSizeMultiplier={1.6}>
        Enter the code sent to{'\n'}
        <Text style={styles.email}>{draft.email.trim()}</Text>
      </Text>

      <View ref={wrapRef}>
        <Pressable onPress={() => inputRef.current?.focus()} accessible={false} style={styles.cells}>
          {Array.from({ length: CELLS }).map((_, i) => {
            const active = i === Math.min(code.length, CELLS - 1);
            return (
              <View
                key={i}
                style={[styles.cell, active && styles.cellActive, !!error && styles.cellError]}
                importantForAccessibility="no-hide-descendants">
                <Text style={styles.cellText} maxFontSizeMultiplier={1.3}>
                  {code[i] ?? ''}
                </Text>
              </View>
            );
          })}
        </Pressable>
        {/* One real input over the boxes: paste, one-time-code autofill and
            screen readers work on it; the boxes only mirror its value. Explicit
            lineHeight guards against a recycled native view's stale style. */}
        <TextInput
          ref={inputRef}
          value={code}
          onChangeText={(v) => update({ code: sanitizeCode(v) })}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={CELLS}
          caretHidden
          accessibilityLabel="Six digit code"
          accessibilityValue={{ text: code ? code.split('').join(' ') : 'empty' }}
          selectionColor="transparent"
          keyboardAppearance="light"
          onFocus={() => setTimeout(() => reveal(wrapRef), 250)}
          style={styles.hiddenInput}
        />
      </View>

      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite" maxFontSizeMultiplier={1.6}>
          {error}
        </Text>
      ) : null}

      <View style={styles.links}>
        <TouchableOpacity
          onPress={() => {
            onResend();
            setNow(Date.now());
          }}
          disabled={left > 0}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={left > 0 ? `Resend code in ${left} seconds` : 'Resend code'}
          accessibilityState={{ disabled: left > 0 }}>
          <Text style={[styles.link, left > 0 && styles.linkDisabled]} maxFontSizeMultiplier={1.4}>
            {left > 0 ? `Resend code in ${left}s` : 'Resend code'}
          </Text>
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity onPress={onChangeEmail} hitSlop={10} accessibilityRole="button" accessibilityLabel="Change email">
          <Text style={styles.link} maxFontSizeMultiplier={1.4}>
            Change email
          </Text>
        </TouchableOpacity>
      </View>

      <DevNotice text={`Demo code: ${DEMO_CODE}. No email was sent.`} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: obSpacing.lg,
  },
  note: {
    fontFamily: obFonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: obColors.textSecondary,
  },
  error: {
    fontFamily: obFonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: obColors.error,
  },
  sentTo: {
    fontFamily: obFonts.body,
    fontSize: 15,
    lineHeight: 21,
    color: obColors.textSecondary,
  },
  email: {
    fontFamily: obFonts.bodySemiBold,
    color: obColors.textPrimary,
  },
  cells: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  cell: {
    flex: 1,
    maxWidth: 52,
    aspectRatio: 0.85,
    borderWidth: 1,
    borderColor: obColors.border,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFDF8',
  },
  cellActive: {
    borderColor: obColors.cta,
    borderWidth: 1.5,
  },
  cellError: {
    borderColor: obColors.error,
  },
  cellText: {
    fontFamily: obFonts.bodySemiBold,
    fontSize: 22,
    lineHeight: 28,
    color: obColors.textPrimary,
  },
  hiddenInput: {
    ...StyleSheet.absoluteFillObject,
    color: 'transparent',
    fontSize: 16,
    lineHeight: 22,
    opacity: 0.02,
  },
  confirmed: {
    alignItems: 'center',
    gap: 4,
    backgroundColor: obColors.selectedFill,
    borderRadius: 12,
    padding: obSpacing.lg,
  },
  confirmedTitle: {
    marginTop: obSpacing.xs,
    fontFamily: obFonts.bodySemiBold,
    fontSize: 17,
    lineHeight: 22,
    color: obColors.cta,
  },
  links: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: obSpacing.lg,
  },
  link: {
    fontFamily: obFonts.bodyMedium,
    fontSize: 15,
    lineHeight: 20,
    color: obColors.cta,
    textDecorationLine: 'underline',
  },
  linkDisabled: {
    color: obColors.textSecondary,
    textDecorationLine: 'none',
  },
  divider: {
    width: 1,
    height: 18,
    backgroundColor: obColors.border,
  },
});
