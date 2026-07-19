// Screen: Setup 2 — intent ve onboarding | Status: stable | Last updated: Mayıs 2026
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { HomeTopIcon } from '@/components/ui/HomeTopIcon';
import { OptionalFieldReveal } from '@/components/ui/OptionalFieldReveal';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Chip } from '@/components/ui/Chip';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { SetupScreenHeader } from '@/components/ui/SetupScreenHeader';
import { colors } from '@/lib/designTokens';
import { supabase } from '@/lib/supabaseClient';
import type { IntentKey } from '@/lib/onboardingIntent';
import { normalizeIntentKey } from '@/lib/onboardingIntent';

export type Setup2Answers = {
  friendship_value?: string;
  hangout_frequency?: string;
  social_preference?: string;
  casualness_expectation?: string;
  exclusivity_view?: string;
  connection_style?: string;
  relationship_pace?: string;
  life_priority?: string;
  relationship_vision?: string;
  excitement_factor?: string;
  commitment_view?: string;
  connection_energy?: string;
};

const INTENT_OPTIONS: { label: string; key: IntentKey }[] = [
  { label: 'Just friends', key: 'just_friends' },
  { label: 'Something casual', key: 'keeping_it_casual' },
  { label: 'Open to something real', key: 'open_to_relationship' },
  { label: 'Figuring it out', key: 'not_sure_yet' },
];

function ChipRow({
  options,
  selected,
  onSelect,
}: {
  options: readonly string[];
  selected: string | null;
  onSelect: (v: string) => void;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((opt) => (
        <Chip
          key={opt}
          label={opt}
          selected={selected === opt}
          onPress={() => onSelect(opt)}
          style={styles.profileChip}
        />
      ))}
    </View>
  );
}

function IntentChip({
  label,
  selected,
  showSparkle,
  onPress,
  onLongPress,
}: {
  label: string;
  selected: boolean;
  showSparkle: boolean;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  return (
    <View style={styles.intentChipWrap}>
      {showSparkle ? <ThemedText style={styles.sparkle}>✨</ThemedText> : null}
      <Pressable
        style={[styles.intentChip, selected && styles.intentChipSelected]}
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={280}>
        <ThemedText style={[styles.intentLabel, selected && styles.intentLabelSelected]}>{label}</ThemedText>
      </Pressable>
    </View>
  );
}

export default function ProfileSetupStep2() {
  const router = useRouter();
  const params = useLocalSearchParams<{ demo?: string; intent?: string }>();
  const isDemoMode = params.demo === '1';

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [intent, setIntent] = useState<IntentKey | null>(null);
  const [answers, setAnswers] = useState<Setup2Answers>({});
  const [saving, setSaving] = useState(false);
  const [showNotSureTooltip, setShowNotSureTooltip] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const intentRef = useRef<IntentKey | null>(null);
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    intentRef.current = intent;
  }, [intent]);

  useEffect(() => {
    const id = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 350);
    return () => clearTimeout(id);
  }, [intent, answers]);

  const setAnswer = useCallback(<K extends keyof Setup2Answers>(key: K, value: Setup2Answers[K]) => {
    if (showNotSureTooltip) setShowNotSureTooltip(false);
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }, [showNotSureTooltip]);

  useEffect(() => {
    if (isDemoMode) {
      setCheckingAuth(false);
      setUserId('demo-user');
      const raw = params.intent as string | undefined;
      const i = raw ? normalizeIntentKey(raw) : null;
      setIntent(i);
      setHydrated(true);
      return;
    }

    let mounted = true;
    (async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (!mounted) return;
      if (error || !user) {
        router.replace('/(auth)/login');
        return;
      }

      setUserId(user.id);

      setHydrated(true);
      setCheckingAuth(false);
    })();

    return () => {
      mounted = false;
      if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
    };
  }, [isDemoMode, params.intent, router]);

  const showNotSureHint = useCallback(() => {
    setShowNotSureTooltip(true);
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
    tooltipTimerRef.current = setTimeout(() => setShowNotSureTooltip(false), 3000);
  }, []);

  const selectIntent = useCallback(
    (key: IntentKey) => {
      if (intentRef.current !== null && intentRef.current !== key) {
        setAnswers({});
      }
      if (showNotSureTooltip) setShowNotSureTooltip(false);
      setIntent(key);
      if (key === 'not_sure_yet') showNotSureHint();
    },
    [showNotSureHint, showNotSureTooltip],
  );

  const showVersionCasual = useMemo(() => intent === 'keeping_it_casual', [intent]);
  const showJustFriends = useMemo(() => intent === 'just_friends', [intent]);
  const showOpenRelationship = useMemo(() => intent === 'open_to_relationship', [intent]);
  const showNotSure = useMemo(() => intent === 'not_sure_yet', [intent]);

  const dynamicTitle = useMemo(() => {
    if (!intent) return '';
    if (showVersionCasual) return 'Keeping it casual';
    if (intent === 'just_friends') return "Tell us about the friendship you're looking for";
    if (intent === 'open_to_relationship') return "Let's understand what you're looking for";
    return "Let's figure out what feels right";
  }, [intent, showVersionCasual]);

  const canProceed = useMemo(() => {
    if (!intent) return false;
    if (intent === 'keeping_it_casual') {
      return !!(answers.casualness_expectation && answers.exclusivity_view && answers.connection_style);
    }
    if (intent === 'just_friends') {
      return !!(answers.friendship_value && answers.hangout_frequency && answers.social_preference);
    }
    if (intent === 'open_to_relationship') {
      return !!(
        answers.relationship_pace &&
        answers.life_priority &&
        answers.relationship_vision
      );
    }
    if (intent === 'not_sure_yet') {
      return !!(answers.excitement_factor && answers.commitment_view && answers.connection_energy);
    }
    return false;
  }, [intent, answers]);

  const handleNext = async () => {
    if (!intent || !canProceed) {
      Alert.alert('Eksik bilgi', 'Lütfen tüm soruları yanıtla.');
      return;
    }

    if (!userId) {
      Alert.alert('Eksik bilgi', 'Lütfen tüm soruları yanıtla.');
      return;
    }

    if (isDemoMode) {
      router.replace('/profile-setup/step3?demo=1');
      return;
    }

    setSaving(true);
    try {
      const onboardingPayload = {
        user_id: userId,
        intent,
        friendship_value: answers.friendship_value ?? null,
        hangout_frequency: answers.hangout_frequency ?? null,
        social_preference: answers.social_preference ?? null,
        casualness_expectation: answers.casualness_expectation ?? null,
        exclusivity_view: answers.exclusivity_view ?? null,
        connection_style: answers.connection_style ?? null,
        relationship_pace: answers.relationship_pace ?? null,
        life_priority: answers.life_priority ?? null,
        relationship_vision: answers.relationship_vision ?? null,
        excitement_factor: answers.excitement_factor ?? null,
        commitment_view: answers.commitment_view ?? null,
        connection_energy: answers.connection_energy ?? null,
      };
      const profileStep2Payload = { id: userId, current_step: 3 as const };

      console.log('STEP 2 - user id:', userId);
      console.log('STEP 2 - upsert data:', onboardingPayload);
      const { error: onboardingErr } = await supabase
        .from('onboarding_answers')
        .upsert(onboardingPayload, { onConflict: 'user_id' });
      console.log('STEP 2 - upsert error:', onboardingErr);
      if (onboardingErr) throw onboardingErr;

      console.log('STEP 2 - user id:', userId);
      console.log('STEP 2 - upsert data:', profileStep2Payload);
      const { error: profileErr } = await supabase
        .from('profiles')
        .upsert(profileStep2Payload, { onConflict: 'id' });
      console.log('STEP 2 - upsert error:', profileErr);
      if (profileErr) throw profileErr;

      router.replace('/profile-setup/step3');
    } catch (e: any) {
      console.error('STEP 2 - handleNext error:', e);
      console.warn(e);
      Alert.alert('Kaydetme başarısız', e?.message ?? 'Bir hata oluştu.');
    } finally {
      setSaving(false);
    }
  };

  if (checkingAuth || !hydrated) return null;

  return (
    <ScreenContainer style={styles.container}>
      <HomeTopIcon />
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}>
        <Pressable style={styles.main} onPress={() => setShowNotSureTooltip(false)}>
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            onScrollBeginDrag={() => setShowNotSureTooltip(false)}>
            <SetupScreenHeader step={2} />

            <View style={styles.section}>
              <ThemedText style={styles.sectionLabel}>What brings you here?</ThemedText>
              <View style={styles.chipRow}>
                {INTENT_OPTIONS.map(({ label, key }) =>
                  key === 'not_sure_yet' ? (
                    <View key={key} style={styles.notSureWrap}>
                      {showNotSureTooltip ? (
                        <View style={styles.tooltipAboveChip} pointerEvents="none">
                          <View style={styles.tooltip}>
                            <ThemedText style={styles.tooltipTextSmall}>
                              Keeping it open means you&apos;ll appear in more matches
                            </ThemedText>
                          </View>
                          <View style={styles.tooltipCaretDown} />
                        </View>
                      ) : null}
                      <IntentChip
                        label={label}
                        selected={intent === key}
                        showSparkle
                        onPress={() => selectIntent(key)}
                        onLongPress={showNotSureHint}
                      />
                    </View>
                  ) : (
                    <IntentChip
                      key={key}
                      label={label}
                      selected={intent === key}
                      showSparkle={false}
                      onPress={() => selectIntent(key)}
                    />
                  ),
                )}
              </View>
            </View>

            {intent ? (
              <>
                <OptionalFieldReveal show={!!dynamicTitle} animationKey={dynamicTitle}>
                  <ThemedText style={styles.title}>{dynamicTitle}</ThemedText>
                </OptionalFieldReveal>

                {showVersionCasual && (
                  <OptionalFieldReveal show animationKey="casual-block">
                    <View style={styles.section}>
                      <ThemedText style={styles.sectionLabel}>What are you hoping for?</ThemedText>
                      <ChipRow
                        options={['Fun & good vibes', 'New experiences', 'See where it goes', 'All of the above'] as const}
                        selected={answers.casualness_expectation ?? null}
                        onSelect={(v) => setAnswer('casualness_expectation', v)}
                      />
                    </View>
                    <View style={styles.section}>
                      <ThemedText style={styles.sectionLabel}>How do you feel about exclusivity?</ThemedText>
                      <ChipRow
                        options={['Not important right now', 'Open to it eventually', 'Prefer to keep it open'] as const}
                        selected={answers.exclusivity_view ?? null}
                        onSelect={(v) => setAnswer('exclusivity_view', v)}
                      />
                    </View>
                    <View style={styles.section}>
                      <ThemedText style={styles.sectionLabel}>You know there&apos;s a vibe when...</ThemedText>
                      <ChipRow
                        options={[
                          'Physical chemistry first',
                          'Good conversations',
                          'Shared experiences',
                          'A bit of everything',
                        ] as const}
                        selected={answers.connection_style ?? null}
                        onSelect={(v) => setAnswer('connection_style', v)}
                      />
                    </View>
                  </OptionalFieldReveal>
                )}

                {showJustFriends && (
                  <OptionalFieldReveal show animationKey="friends-block">
                    <View style={styles.section}>
                      <ThemedText style={styles.sectionLabel}>What makes a friendship last for you?</ThemedText>
                      <ChipRow
                        options={[
                          'Loyalty & trust',
                          'Shared adventures',
                          'Deep conversations',
                          'Just having fun',
                        ] as const}
                        selected={answers.friendship_value ?? null}
                        onSelect={(v) => setAnswer('friendship_value', v)}
                      />
                    </View>
                    <View style={styles.section}>
                      <ThemedText style={styles.sectionLabel}>How often do you see your close friends?</ThemedText>
                      <ChipRow
                        options={[
                          'A few times a week',
                          'Once a week',
                          'A few times a month',
                          'Whenever it happens',
                        ] as const}
                        selected={answers.hangout_frequency ?? null}
                        onSelect={(v) => setAnswer('hangout_frequency', v)}
                      />
                    </View>
                    <View style={styles.section}>
                      <ThemedText style={styles.sectionLabel}>Your ideal hangout looks like...</ThemedText>
                      <ChipRow
                        options={['One-on-one', 'Small groups', 'Big groups', 'Mix of everything'] as const}
                        selected={answers.social_preference ?? null}
                        onSelect={(v) => setAnswer('social_preference', v)}
                      />
                    </View>
                  </OptionalFieldReveal>
                )}

                {showOpenRelationship && (
                  <OptionalFieldReveal show animationKey="relationship-block">
                    <View style={styles.section}>
                      <ThemedText style={styles.sectionLabel}>What&apos;s your relationship pace?</ThemedText>
                      <ChipRow
                        options={[
                          'Taking it slow',
                          'Going with the flow',
                          'Ready to commit',
                          'Not sure yet',
                        ] as const}
                        selected={answers.relationship_pace ?? null}
                        onSelect={(v) => setAnswer('relationship_pace', v)}
                      />
                    </View>
                    <View style={styles.section}>
                      <ThemedText style={styles.sectionLabel}>What takes priority right now?</ThemedText>
                      <ChipRow
                        options={[
                          'Career & ambition',
                          'Family & relationships',
                          'Personal growth',
                          'Balance of everything',
                        ] as const}
                        selected={answers.life_priority ?? null}
                        onSelect={(v) => setAnswer('life_priority', v)}
                      />
                    </View>
                    <View style={styles.section}>
                      <ThemedText style={styles.sectionLabel}>
                        What does a healthy relationship look like to you?
                      </ThemedText>
                      <ChipRow
                        options={[
                          "We support each other's independence",
                          "We're each other's priority",
                          'We grow together',
                          'A balance of both',
                        ] as const}
                        selected={answers.relationship_vision ?? null}
                        onSelect={(v) => setAnswer('relationship_vision', v)}
                      />
                    </View>
                  </OptionalFieldReveal>
                )}

                {showNotSure && (
                  <OptionalFieldReveal show animationKey="not-sure-block">
                    <View style={styles.section}>
                      <ThemedText style={styles.sectionLabel}>What would make you excited about meeting someone?</ThemedText>
                      <ChipRow
                        options={[
                          'A great friendship',
                          'A romantic spark',
                          'An adventure buddy',
                          'Just seeing what happens',
                        ] as const}
                        selected={answers.excitement_factor ?? null}
                        onSelect={(v) => setAnswer('excitement_factor', v)}
                      />
                    </View>
                    <View style={styles.section}>
                      <ThemedText style={styles.sectionLabel}>How do you feel about commitment?</ThemedText>
                      <ChipRow
                        options={[
                          'Taking it slow',
                          'Open to whatever feels right',
                          'Not thinking about it yet',
                        ] as const}
                        selected={answers.commitment_view ?? null}
                        onSelect={(v) => setAnswer('commitment_view', v)}
                      />
                    </View>
                    <View style={styles.section}>
                      <ThemedText style={styles.sectionLabel}>What kind of energy are you bringing?</ThemedText>
                      <ChipRow
                        options={[
                          'Laid back & easy going',
                          'Curious & open minded',
                          'Fun & spontaneous',
                          'Still figuring it out',
                        ] as const}
                        selected={answers.connection_energy ?? null}
                        onSelect={(v) => setAnswer('connection_energy', v)}
                      />
                    </View>
                  </OptionalFieldReveal>
                )}
              </>
            ) : null}
          </ScrollView>
          <View style={styles.footer}>
            <PrimaryButton
              label={saving ? 'Saving…' : 'Next →'}
              onPress={handleNext}
              disabled={!canProceed || saving}
              loading={saving}
            />
          </View>
        </Pressable>
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
  main: {
    flex: 1,
  },
  content: {
    paddingBottom: 120,
    paddingRight: 8,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
  },
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    color: colors.accent,
    fontSize: 14,
    marginBottom: 12,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  intentChipWrap: {
    position: 'relative',
  },
  intentChip: {
    backgroundColor: colors.bgCard,
    borderWidth: 0.5,
    borderColor: '#E0E0E0',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 36,
    justifyContent: 'center',
  },
  intentChipSelected: {
    backgroundColor: colors.accent,
  },
  intentLabel: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '500',
  },
  intentLabelSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  notSureWrap: {
    position: 'relative',
    alignSelf: 'flex-start',
  },
  tooltipAboveChip: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    marginBottom: 4,
    zIndex: 30,
    maxWidth: 200,
  },
  sparkle: {
    position: 'absolute',
    right: 2,
    top: 0,
    zIndex: 2,
    fontSize: 11,
  },
  tooltip: {
    backgroundColor: '#FFFFFF',
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  tooltipCaretDown: {
    width: 0,
    height: 0,
    alignSelf: 'center',
    marginTop: -1,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: colors.accent,
  },
  tooltipTextSmall: {
    color: colors.textPrimary,
    fontSize: 10,
    lineHeight: 13,
  },
  profileChip: {
    borderRadius: 20,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: colors.bgPrimary,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
});
