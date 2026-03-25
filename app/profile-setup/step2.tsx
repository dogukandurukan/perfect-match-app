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
import { supabase } from '@/lib/supabaseClient';
import type { IntentKey } from '@/lib/onboardingIntent';
import { normalizeIntentKey } from '@/lib/onboardingIntent';

type SubIntent = 'Friendship' | 'Something romantic' | 'Both';

export type Setup2Answers = {
  sub_intent?: SubIntent;
  friendship_type?: string;
  shared_interests_importance?: string;
  social_preference?: string;
  casualness_expectation?: string;
  exclusivity_view?: string;
  marriage_view?: string;
  children_view?: string;
  living_preference?: string;
  life_priority?: string;
  commitment_view?: string;
};

const INTENT_OPTIONS: { label: string; key: IntentKey }[] = [
  { label: 'Just friends', key: 'just_friends' },
  { label: 'Keeping it casual', key: 'keeping_it_casual' },
  { label: 'Open to a relationship', key: 'open_to_relationship' },
  { label: 'Not sure yet', key: 'not_sure_yet' },
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

      const { data: pref } = await supabase
        .from('preferences')
        .select('intent, setup2_answers')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!mounted) return;

      if (pref?.intent) {
        const n = normalizeIntentKey(pref.intent as string);
        if (n) setIntent(n);
      }
      if (pref?.setup2_answers && typeof pref.setup2_answers === 'object') {
        setAnswers(pref.setup2_answers as Setup2Answers);
      }
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

  const selectIntent = useCallback((key: IntentKey) => {
    if (intentRef.current !== null && intentRef.current !== key) {
      setAnswers({});
    }
    if (showNotSureTooltip) setShowNotSureTooltip(false);
    setIntent(key);
    if (key === 'not_sure_yet') showNotSureHint();
  }, [showNotSureHint, showNotSureTooltip]);

  const showVersionCasual = useMemo(() => intent === 'keeping_it_casual', [intent]);

  const showVersionA = useMemo(() => {
    if (!intent) return false;
    if (intent === 'just_friends') return true;
    if (intent === 'not_sure_yet' && answers.sub_intent === 'Friendship') return true;
    return false;
  }, [intent, answers.sub_intent]);

  const showVersionB = useMemo(() => {
    if (!intent) return false;
    if (intent === 'open_to_relationship') return true;
    if (intent === 'not_sure_yet' && answers.sub_intent === 'Something romantic') return true;
    return false;
  }, [intent, answers.sub_intent]);

  const showVersionD = useMemo(() => intent === 'not_sure_yet' && answers.sub_intent === 'Both', [intent, answers.sub_intent]);

  const dynamicTitle = useMemo(() => {
    if (!intent) return '';
    if (showVersionCasual) return 'Keeping it casual';
    if (intent === 'just_friends' || (intent === 'not_sure_yet' && showVersionA && !showVersionD)) {
      return "Tell us about the friendship you're looking for";
    }
    if (intent === 'open_to_relationship' || (intent === 'not_sure_yet' && showVersionB)) {
      return "Let's understand what you're looking for";
    }
    return "Let's figure out what feels right";
  }, [intent, showVersionA, showVersionB, showVersionD, showVersionCasual]);

  const canProceed = useMemo(() => {
    if (!intent) return false;
    if (intent === 'keeping_it_casual') {
      return !!(answers.casualness_expectation && answers.exclusivity_view);
    }
    if (intent === 'just_friends') {
      return !!(
        answers.friendship_type &&
        answers.shared_interests_importance &&
        answers.social_preference
      );
    }
    if (intent === 'open_to_relationship') {
      return !!(answers.marriage_view && answers.children_view && answers.living_preference && answers.life_priority);
    }
    if (!answers.sub_intent) return false;
    if (answers.sub_intent === 'Friendship') {
      return !!(
        answers.friendship_type &&
        answers.shared_interests_importance &&
        answers.social_preference
      );
    }
    if (answers.sub_intent === 'Something romantic') {
      return !!(answers.marriage_view && answers.children_view && answers.living_preference && answers.life_priority);
    }
    if (answers.sub_intent === 'Both') {
      return !!(answers.commitment_view && answers.friendship_type && answers.social_preference);
    }
    return false;
  }, [intent, answers]);

  const handleNext = async () => {
    if (!userId || !intent || !canProceed) {
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
        sub_intent: answers.sub_intent ? answers.sub_intent.toLowerCase().replace(' ', '_') : null,
        friendship_type: answers.friendship_type ?? null,
        shared_interests_importance: answers.shared_interests_importance ?? null,
        social_preference: answers.social_preference ?? null,
        casualness_expectation: answers.casualness_expectation ?? null,
        exclusivity_view: answers.exclusivity_view ?? null,
        marriage_view: answers.marriage_view ?? null,
        children_view: answers.children_view ?? null,
        living_preference: answers.living_preference ?? null,
        life_priority: answers.life_priority ?? null,
        commitment_view: answers.commitment_view ?? null,
      };
      const { error: onboardingErr } = await supabase
        .from('onboarding_answers')
        .upsert(onboardingPayload, { onConflict: 'user_id' });
      if (onboardingErr) throw onboardingErr;

      const prefPayload = {
        user_id: userId,
        intent,
        setup2_answers: answers,
        setup2_completed: true,
      };
      const { error: prefErr } = await supabase.from('preferences').upsert(prefPayload, { onConflict: 'user_id' });
      if (prefErr) throw prefErr;

      const { error: profileErr } = await supabase.from('profiles').update({ intent }).eq('id', userId);
      if (profileErr) {
        console.warn('profiles.intent update:', profileErr);
      }

      router.replace('/profile-setup/step3');
    } catch (e: any) {
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
          <ThemedText style={styles.sectionLabel}>What kind of connection are you looking for?</ThemedText>
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
                    options={[
                      'Not important right now',
                      'Open to it eventually',
                      'Prefer to keep it open',
                    ] as const}
                    selected={answers.exclusivity_view ?? null}
                    onSelect={(v) => setAnswer('exclusivity_view', v)}
                  />
                </View>
              </OptionalFieldReveal>
            )}

            {intent === 'not_sure_yet' && (
              <OptionalFieldReveal show animationKey="sub-intent">
              <View style={styles.section}>
                <ThemedText style={styles.sectionLabel}>What kind of connection are you open to?</ThemedText>
                <ChipRow
                  options={['Friendship', 'Something romantic', 'Both'] as const}
                  selected={answers.sub_intent ?? null}
                  onSelect={(v) => setAnswer('sub_intent', v as SubIntent)}
                />
              </View>
              </OptionalFieldReveal>
            )}

            {showVersionA && (
              <OptionalFieldReveal show animationKey="friends-block">
                <View style={styles.section}>
                  <ThemedText style={styles.sectionLabel}>What kind of friendship are you looking for?</ThemedText>
                  <ChipRow
                    options={['Activity buddy', 'Someone to talk to', 'Both'] as const}
                    selected={answers.friendship_type ?? null}
                    onSelect={(v) => setAnswer('friendship_type', v)}
                  />
                </View>
                <View style={styles.section}>
                  <ThemedText style={styles.sectionLabel}>How important are shared interests to you?</ThemedText>
                  <ChipRow
                    options={['Very important', 'Somewhat important', 'Not that important'] as const}
                    selected={answers.shared_interests_importance ?? null}
                    onSelect={(v) => setAnswer('shared_interests_importance', v)}
                  />
                </View>
                <View style={styles.section}>
                  <ThemedText style={styles.sectionLabel}>Do you prefer group hangouts or one-on-one?</ThemedText>
                  <ChipRow
                    options={['Group', 'One-on-one', 'Both'] as const}
                    selected={answers.social_preference ?? null}
                    onSelect={(v) => setAnswer('social_preference', v)}
                  />
                </View>
              </OptionalFieldReveal>
            )}

            {showVersionB && (
              <OptionalFieldReveal show animationKey="relationship-block">
                <View style={styles.section}>
                  <ThemedText style={styles.sectionLabel}>Do you see yourself getting married?</ThemedText>
                  <ChipRow
                    options={['Yes, definitely', 'Open to it', 'Not sure', 'No'] as const}
                    selected={answers.marriage_view ?? null}
                    onSelect={(v) => setAnswer('marriage_view', v)}
                  />
                </View>
                <View style={styles.section}>
                  <ThemedText style={styles.sectionLabel}>Do you want children?</ThemedText>
                  <ChipRow
                    options={['Yes', 'Maybe someday', 'No', 'Already have kids'] as const}
                    selected={answers.children_view ?? null}
                    onSelect={(v) => setAnswer('children_view', v)}
                  />
                </View>
                <View style={styles.section}>
                  <ThemedText style={styles.sectionLabel}>Where do you see yourself living long-term?</ThemedText>
                  <ChipRow
                    options={['Same city', 'Open to moving', 'Want to move abroad'] as const}
                    selected={answers.living_preference ?? null}
                    onSelect={(v) => setAnswer('living_preference', v)}
                  />
                </View>
                <View style={styles.section}>
                  <ThemedText style={styles.sectionLabel}>What takes priority in your life right now?</ThemedText>
                  <ChipRow
                    options={['Career', 'Family', 'Balance of both', 'Still figuring it out'] as const}
                    selected={answers.life_priority ?? null}
                    onSelect={(v) => setAnswer('life_priority', v)}
                  />
                </View>
              </OptionalFieldReveal>
            )}

            {showVersionD && (
              <OptionalFieldReveal show animationKey="not-sure-both">
                <View style={styles.section}>
                  <ThemedText style={styles.sectionLabel}>How do you feel about commitment?</ThemedText>
                  <ChipRow
                    options={['Taking it slow', 'Open to it', 'Not thinking about it'] as const}
                    selected={answers.commitment_view ?? null}
                    onSelect={(v) => setAnswer('commitment_view', v)}
                  />
                </View>
                <View style={styles.section}>
                  <ThemedText style={styles.sectionLabel}>What kind of friendship are you open to?</ThemedText>
                  <ChipRow
                    options={['Activity buddy', 'Someone to talk to', 'Both'] as const}
                    selected={answers.friendship_type ?? null}
                    onSelect={(v) => setAnswer('friendship_type', v)}
                  />
                </View>
                <View style={styles.section}>
                  <ThemedText style={styles.sectionLabel}>Do you prefer group hangouts or one-on-one?</ThemedText>
                  <ChipRow
                    options={['Group', 'One-on-one', 'Both'] as const}
                    selected={answers.social_preference ?? null}
                    onSelect={(v) => setAnswer('social_preference', v)}
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
    color: '#F5F0E8',
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
  },
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    color: '#C9A96E',
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
    backgroundColor: '#1C2030',
    borderRadius: 20,
    borderWidth: 0,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 36,
    justifyContent: 'center',
  },
  intentChipSelected: {
    backgroundColor: '#C9A96E',
  },
  intentLabel: {
    color: '#F5F0E8',
    fontSize: 13,
    fontWeight: '500',
  },
  intentLabelSelected: {
    color: '#0F1117',
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
    backgroundColor: '#1C2030',
    borderColor: '#C9A96E',
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
    borderTopColor: '#C9A96E',
  },
  tooltipTextSmall: {
    color: '#F5F0E8',
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
    backgroundColor: '#0F1117',
    borderTopWidth: 1,
    borderTopColor: '#1C2030',
  },
});
