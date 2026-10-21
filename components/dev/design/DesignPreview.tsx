// DEV-ONLY design preview for branding / onboarding work (round 1): Welcome,
// one representative onboarding question and the application status, each in
// its empty / filled / error states. Renders the SAME components the live
// screens use (OnboardingScreen, OnboardingTextField, ConsentRow,
// SingleChoiceFields, ReceivedFields) with synthetic values from
// lib/dev/designPreview.ts. Nothing here reads or writes Supabase, signs in or
// sends a code; buttons only switch preview states.
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ACCOUNT_COPY,
  AccountError,
  AccountLink,
  ConsentRow,
} from '@/components/onboarding-v2/account/AccountFields';
import { SingleChoiceFields } from '@/components/onboarding-v2/compatibility/CompatibilityFields';
import { OnboardingPrimaryButton } from '@/components/onboarding-v2/OnboardingPrimaryButton';
import { OnboardingScreen } from '@/components/onboarding-v2/OnboardingScreen';
import { OnboardingTextField } from '@/components/onboarding-v2/OnboardingTextField';
import { TempaWordmark } from '@/components/onboarding-v2/TempaWordmark';
import { ReceivedFields, STATUS_COPY } from '@/components/onboarding-v2/yourProfile/ApplicationFields';
import { DevNotice } from '@/components/onboarding-v2/yourProfile/ProfilePreview';
import {
  DESIGN_SCREENS,
  SPEC_WELCOME,
  SYNTHETIC,
  WELCOME_PROPOSALS,
  screenOfState,
  type DesignStateId,
} from '@/lib/dev/designPreview';
import { COMPAT_TOTAL_STEPS, EMPTY_COMPAT_DRAFT, SINGLE_QUESTIONS, type CompatDraft } from '@/lib/onboardingV2/compatibility';
import { obColors, obFonts, obRadius, obSpacing } from '@/lib/onboardingV2/theme';

const previewOnly = () => Alert.alert('Design preview', 'Preview only — nothing is sent or saved.');

export function DesignPreview({ onExit }: { onExit?: () => void }) {
  const [state, setState] = useState<DesignStateId | null>(null);
  const [proposal, setProposal] = useState(0);
  if (!state) {
    return <Hub onPick={setState} onExit={onExit} proposal={proposal} setProposal={setProposal} />;
  }
  const back = () => setState(null);
  const screen = screenOfState(state).id;
  if (screen === 'welcome') return <WelcomeStates state={state} onBack={back} proposal={proposal} />;
  if (screen === 'question') return <QuestionStates state={state} onBack={back} />;
  return <StatusStates state={state} onBack={back} />;
}

function Hub({
  onPick,
  onExit,
  proposal,
  setProposal,
}: {
  onPick: (s: DesignStateId) => void;
  onExit?: () => void;
  proposal: number;
  setProposal: (i: number) => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.hub, { paddingTop: insets.top + obSpacing.lg, paddingBottom: insets.bottom + obSpacing.xxl }]}>
      <TempaWordmark />
      <Text style={styles.hubTitle} accessibilityRole="header">
        Design preview
      </Text>
      <DevNotice text="DEV only · synthetic content · nothing is saved or sent. Back arrow on a screen returns here." />
      {DESIGN_SCREENS.map((s) => (
        <View key={s.id} style={styles.card}>
          <Text style={styles.cardTitle}>{s.title}</Text>
          <Text style={styles.cardSource}>{s.liveSource}</Text>
          <View style={styles.chips}>
            {s.states.map((st) => (
              <TouchableOpacity
                key={st.id}
                onPress={() => onPick(st.id)}
                accessibilityRole="button"
                accessibilityLabel={`${s.title}: ${st.label}`}
                style={styles.chip}>
                <Text style={styles.chipText}>{st.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {s.id === 'welcome' && WELCOME_PROPOSALS.length > 1 ? (
            <View style={styles.chips}>
              {WELCOME_PROPOSALS.map((p, i) => (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => setProposal(i)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: i === proposal }}
                  style={[styles.chip, i === proposal && styles.chipOn]}>
                  <Text style={[styles.chipText, i === proposal && styles.chipTextOn]}>{`Welcome copy: ${p.label}`}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </View>
      ))}
      {onExit ? <AccountLink label="Close preview" onPress={onExit} /> : null}
    </ScrollView>
  );
}

function WelcomeStates({ state, onBack, proposal }: { state: DesignStateId; onBack: () => void; proposal: number }) {
  const [consent, setConsent] = useState(state !== 'email-empty');
  if (state === 'spec-welcome') return <SpecWelcome onBack={onBack} proposal={proposal} />;
  const isEmail = state.startsWith('email');
  const email = state === 'email-empty' ? '' : SYNTHETIC.email;
  const error =
    state === 'email-error' ? ACCOUNT_COPY.errors.sendFailed : state === 'code-error' ? ACCOUNT_COPY.errors.codeWrong : null;
  return (
    <OnboardingScreen
      sectionLabel={ACCOUNT_COPY.sectionLabel}
      step={isEmail ? 1 : 2}
      totalSteps={2}
      title={isEmail ? ACCOUNT_COPY.emailTitle : ACCOUNT_COPY.codeTitle}
      helper={isEmail ? ACCOUNT_COPY.emailHelper : ACCOUNT_COPY.codeHelper(SYNTHETIC.email)}
      onBack={onBack}
      contentKey={state}
      footer={
        <>
          {error ? <AccountError text={error} /> : null}
          <OnboardingPrimaryButton
            label={isEmail ? ACCOUNT_COPY.sendCode : ACCOUNT_COPY.continue}
            onPress={previewOnly}
            disabled={isEmail ? !email || !consent : false}
          />
        </>
      }>
      {isEmail ? (
        <>
          <OnboardingTextField label={ACCOUNT_COPY.emailLabel} value={email} editable={false} />
          <ConsentRow checked={consent} onToggle={() => setConsent((c) => !c)} onOpenNotice={previewOnly} />
        </>
      ) : (
        <>
          <OnboardingTextField label={ACCOUNT_COPY.codeLabel} value={SYNTHETIC.code} editable={false} />
          <AccountLink label={ACCOUNT_COPY.resendIn(42)} onPress={previewOnly} disabled />
        </>
      )}
    </OnboardingScreen>
  );
}

// Spec Section 1 welcome: not a live screen yet. Built from the onboarding
// tokens and components so a proposal looks like the rest of onboarding.
function SpecWelcome({ onBack, proposal }: { onBack: () => void; proposal: number }) {
  const insets = useSafeAreaInsets();
  const copy = WELCOME_PROPOSALS[proposal] ?? WELCOME_PROPOSALS[0];
  return (
    <View style={[styles.root, { paddingTop: insets.top + obSpacing.lg, paddingBottom: Math.max(insets.bottom, obSpacing.lg) }]}>
      <View style={styles.specTop}>
        <TempaWordmark />
      </View>
      <View style={styles.specBody}>
        <Text style={styles.specHeadline} accessibilityRole="header" maxFontSizeMultiplier={1.4}>
          {copy.headline}
        </Text>
        <Text style={styles.specText} maxFontSizeMultiplier={1.6}>
          {copy.body}
        </Text>
      </View>
      <View style={styles.specActions}>
        <OnboardingPrimaryButton label={SPEC_WELCOME.primary} onPress={previewOnly} />
        <OnboardingPrimaryButton label={SPEC_WELCOME.secondary} onPress={previewOnly} variant="outline" />
        <AccountLink label={SPEC_WELCOME.link} onPress={previewOnly} />
        <DevNotice text="Spec copy (ONBOARDING_FLOW.md §1) — not a live screen." />
        <AccountLink label="Back to design preview" onPress={onBack} />
      </View>
    </View>
  );
}

function QuestionStates({ state, onBack }: { state: DesignStateId; onBack: () => void }) {
  const question = SINGLE_QUESTIONS[0]; // 3.1 What are you looking for?
  const [draft, setDraft] = useState<CompatDraft>(
    state === 'question-empty' ? EMPTY_COMPAT_DRAFT : { ...EMPTY_COMPAT_DRAFT, [question.id]: question.options[0].key },
  );
  const valid = !!draft[question.id];
  return (
    <OnboardingScreen
      sectionLabel="Compatibility"
      step={1}
      totalSteps={COMPAT_TOTAL_STEPS}
      title={question.title}
      helper={question.helper}
      compactTitle
      onBack={onBack}
      contentKey={state}
      footer={
        <>
          {state === 'question-save-error' ? <AccountError text={SYNTHETIC.offlineMessage} /> : null}
          <OnboardingPrimaryButton label="Continue" onPress={previewOnly} disabled={!valid} />
        </>
      }>
      <SingleChoiceFields question={question} draft={draft} update={(patch) => setDraft((d) => ({ ...d, ...patch }))} />
    </OnboardingScreen>
  );
}

// Mirrors app/v2/status.tsx: same layout, same copy, no access-gate call.
function StatusStates({ state, onBack }: { state: DesignStateId; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.status, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      {state === 'submitted' ? (
        <ReceivedFields live />
      ) : (
        <Text style={styles.statusText} maxFontSizeMultiplier={1.6}>
          {state === 'rejected' ? STATUS_COPY.rejected : SYNTHETIC.offlineMessage}
        </Text>
      )}
      <AccountLink label={STATUS_COPY.refresh} onPress={previewOnly} />
      <AccountLink label={STATUS_COPY.signOut} onPress={previewOnly} />
      <DevNotice text="Design preview — synthetic state." />
      <AccountLink label="Back to design preview" onPress={onBack} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: obColors.background },
  hub: { paddingHorizontal: obSpacing.gutter, gap: obSpacing.lg },
  hubTitle: { fontFamily: obFonts.heading, fontSize: 30, lineHeight: 38, color: obColors.textPrimary },
  card: {
    gap: obSpacing.sm,
    padding: obSpacing.lg,
    borderRadius: obRadius.button,
    borderWidth: 1,
    borderColor: obColors.border,
  },
  cardTitle: { fontFamily: obFonts.bodySemiBold, fontSize: 17, lineHeight: 23, color: obColors.textPrimary },
  cardSource: { fontFamily: obFonts.body, fontSize: 12, lineHeight: 17, color: obColors.textSecondary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: obSpacing.sm },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: obSpacing.md,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: obColors.cta,
  },
  chipOn: { backgroundColor: obColors.cta },
  chipText: { fontFamily: obFonts.bodyMedium, fontSize: 14, lineHeight: 19, color: obColors.cta },
  chipTextOn: { color: obColors.onCta },
  specTop: { alignItems: 'center' },
  specBody: { flex: 1, justifyContent: 'center', paddingHorizontal: obSpacing.gutter, gap: obSpacing.md },
  specHeadline: { fontFamily: obFonts.heading, fontSize: 40, lineHeight: 48, color: obColors.textPrimary },
  specText: { fontFamily: obFonts.body, fontSize: 18, lineHeight: 26, color: obColors.textSecondary },
  specActions: { paddingHorizontal: obSpacing.gutter, gap: obSpacing.md },
  status: { paddingHorizontal: 24, gap: 8 },
  statusText: { fontFamily: obFonts.body, fontSize: 17, lineHeight: 24, color: obColors.textPrimary },
});
