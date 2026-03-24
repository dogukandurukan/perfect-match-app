import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { HomeTopIcon } from '@/components/ui/HomeTopIcon';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Chip } from '@/components/ui/Chip';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { supabase } from '@/lib/supabaseClient';
import type { IntentKey } from '@/lib/onboardingIntent';
import { normalizeIntentKey } from '@/lib/onboardingIntent';

type ConnectionOpen = 'Friendship' | 'Something romantic' | 'Both';

/** Dynamic answers stored in preferences.setup2_answers */
export type Setup2Answers = {
  connection_open?: ConnectionOpen;
  /** Intent: keeping_it_casual */
  casual_hoping?: string;
  casual_exclusivity?: string;
  friendship_kind?: string;
  shared_interests_importance?: string;
  social_style?: string;
  marriage?: string;
  children?: string;
  living_long_term?: string;
  life_priority?: string;
  children_someday?: string;
  marriage_feeling?: string;
  friendship_also?: string;
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

export default function ProfileSetupStep2() {
  const router = useRouter();
  const params = useLocalSearchParams<{ demo?: string; intent?: string }>();
  const isDemoMode = params.demo === '1';

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [intent, setIntent] = useState<IntentKey | null>(null);
  const [answers, setAnswers] = useState<Setup2Answers>({});
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const intentRef = useRef<IntentKey | null>(null);

  useEffect(() => {
    intentRef.current = intent;
  }, [intent]);

  const setAnswer = useCallback(<K extends keyof Setup2Answers>(key: K, value: Setup2Answers[K]) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }, []);

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
    };
  }, [isDemoMode, params.intent, router]);

  const selectIntent = useCallback((key: IntentKey) => {
    if (intentRef.current !== null && intentRef.current !== key) {
      setAnswers({});
    }
    setIntent(key);
  }, []);

  const showVersionCasual = useMemo(() => intent === 'keeping_it_casual', [intent]);

  const showVersionA = useMemo(() => {
    if (!intent) return false;
    if (intent === 'just_friends') return true;
    if (intent === 'not_sure_yet' && answers.connection_open === 'Friendship') return true;
    return false;
  }, [intent, answers.connection_open]);

  const showVersionB = useMemo(() => {
    if (!intent) return false;
    if (intent === 'open_to_relationship') return true;
    if (intent === 'not_sure_yet' && answers.connection_open === 'Something romantic') return true;
    return false;
  }, [intent, answers.connection_open]);

  const showVersionCBoth = useMemo(() => {
    return intent === 'not_sure_yet' && answers.connection_open === 'Both';
  }, [intent, answers.connection_open]);

  const dynamicTitle = useMemo(() => {
    if (!intent) return '';
    if (showVersionCasual) return 'Keeping it casual';
    if (intent === 'just_friends' || (intent === 'not_sure_yet' && showVersionA && !showVersionCBoth)) {
      return "Tell us about the friendship you're looking for";
    }
    if (intent === 'open_to_relationship' || (intent === 'not_sure_yet' && showVersionB)) {
      return "Let's understand what you're looking for";
    }
    return "Let's figure out what feels right";
  }, [intent, showVersionA, showVersionB, showVersionCBoth, showVersionCasual]);

  const canProceed = useMemo(() => {
    if (!intent) return false;
    if (intent === 'keeping_it_casual') {
      return !!(answers.casual_hoping && answers.casual_exclusivity);
    }
    if (intent === 'just_friends') {
      return !!(
        answers.friendship_kind &&
        answers.shared_interests_importance &&
        answers.social_style
      );
    }
    if (intent === 'open_to_relationship') {
      return !!(answers.marriage && answers.children && answers.living_long_term && answers.life_priority);
    }
    if (!answers.connection_open) return false;
    if (answers.connection_open === 'Friendship') {
      return !!(
        answers.friendship_kind &&
        answers.shared_interests_importance &&
        answers.social_style
      );
    }
    if (answers.connection_open === 'Something romantic') {
      return !!(answers.marriage && answers.children && answers.living_long_term && answers.life_priority);
    }
    if (answers.connection_open === 'Both') {
      return !!(answers.children_someday && answers.marriage_feeling && answers.friendship_also);
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
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ThemedText style={styles.progress}>Step 2 of 4</ThemedText>

        <View style={styles.section}>
          <ThemedText style={styles.sectionLabel}>What kind of connection are you looking for?</ThemedText>
          <View style={styles.chipRow}>
            {INTENT_OPTIONS.map(({ label, key }) => (
              <Chip
                key={key}
                label={label}
                selected={intent === key}
                onPress={() => selectIntent(key)}
                style={styles.profileChip}
              />
            ))}
          </View>
        </View>

        {intent ? (
          <>
            {dynamicTitle ? (
              <ThemedText style={styles.title}>{dynamicTitle}</ThemedText>
            ) : null}

            {showVersionCasual && (
              <>
                <View style={styles.section}>
                  <ThemedText style={styles.sectionLabel}>What are you hoping for?</ThemedText>
                  <ChipRow
                    options={['Fun & good vibes', 'New experiences', 'See where it goes', 'All of the above'] as const}
                    selected={answers.casual_hoping ?? null}
                    onSelect={(v) => setAnswer('casual_hoping', v)}
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
                    selected={answers.casual_exclusivity ?? null}
                    onSelect={(v) => setAnswer('casual_exclusivity', v)}
                  />
                </View>
              </>
            )}

            {intent === 'not_sure_yet' && (
              <View style={styles.section}>
                <ThemedText style={styles.sectionLabel}>What kind of connection are you open to?</ThemedText>
                <ChipRow
                  options={['Friendship', 'Something romantic', 'Both'] as const}
                  selected={answers.connection_open ?? null}
                  onSelect={(v) => setAnswer('connection_open', v as ConnectionOpen)}
                />
              </View>
            )}

            {showVersionA && (
              <>
                <View style={styles.section}>
                  <ThemedText style={styles.sectionLabel}>What kind of friendship are you looking for?</ThemedText>
                  <ChipRow
                    options={['Activity buddy', 'Someone to talk to', 'Both'] as const}
                    selected={answers.friendship_kind ?? null}
                    onSelect={(v) => setAnswer('friendship_kind', v)}
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
                    selected={answers.social_style ?? null}
                    onSelect={(v) => setAnswer('social_style', v)}
                  />
                </View>
              </>
            )}

            {showVersionB && (
              <>
                <View style={styles.section}>
                  <ThemedText style={styles.sectionLabel}>Do you see yourself getting married?</ThemedText>
                  <ChipRow
                    options={['Yes, definitely', 'Open to it', 'Not sure', 'No'] as const}
                    selected={answers.marriage ?? null}
                    onSelect={(v) => setAnswer('marriage', v)}
                  />
                </View>
                <View style={styles.section}>
                  <ThemedText style={styles.sectionLabel}>Do you want children?</ThemedText>
                  <ChipRow
                    options={['Yes', 'Maybe someday', 'No', 'Already have kids'] as const}
                    selected={answers.children ?? null}
                    onSelect={(v) => setAnswer('children', v)}
                  />
                </View>
                <View style={styles.section}>
                  <ThemedText style={styles.sectionLabel}>Where do you see yourself living long-term?</ThemedText>
                  <ChipRow
                    options={['Same city', 'Open to moving', 'Want to move abroad'] as const}
                    selected={answers.living_long_term ?? null}
                    onSelect={(v) => setAnswer('living_long_term', v)}
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
              </>
            )}

            {showVersionCBoth && (
              <>
                <View style={styles.section}>
                  <ThemedText style={styles.sectionLabel}>Do you want children someday?</ThemedText>
                  <ChipRow
                    options={['Yes', 'Maybe', 'No', 'Not thinking about it yet'] as const}
                    selected={answers.children_someday ?? null}
                    onSelect={(v) => setAnswer('children_someday', v)}
                  />
                </View>
                <View style={styles.section}>
                  <ThemedText style={styles.sectionLabel}>How do you feel about marriage?</ThemedText>
                  <ChipRow
                    options={['Open to it', 'Not for me', "Haven't thought about it"] as const}
                    selected={answers.marriage_feeling ?? null}
                    onSelect={(v) => setAnswer('marriage_feeling', v)}
                  />
                </View>
                <View style={styles.section}>
                  <ThemedText style={styles.sectionLabel}>What kind of friendship are you open to?</ThemedText>
                  <ChipRow
                    options={['Activity buddy', 'Someone to talk to', 'Both'] as const}
                    selected={answers.friendship_also ?? null}
                    onSelect={(v) => setAnswer('friendship_also', v)}
                  />
                </View>
              </>
            )}
          </>
        ) : null}

        <View style={styles.footer}>
          <PrimaryButton
            label={saving ? 'Saving…' : 'Next →'}
            onPress={handleNext}
            disabled={!canProceed || saving}
            loading={saving}
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'flex-start',
  },
  content: {
    paddingBottom: 48,
    paddingRight: 8,
  },
  progress: {
    textAlign: 'center',
    color: '#C9A96E',
    fontSize: 14,
    marginTop: 12,
    marginBottom: 16,
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
    gap: 10,
  },
  profileChip: {
    borderRadius: 20,
  },
  footer: {
    marginTop: 24,
    marginBottom: 16,
  },
});
