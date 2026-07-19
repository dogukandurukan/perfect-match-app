// Screen: Setup 3 — yaşam tarzı | Status: stable | Last updated: Mayıs 2026
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { HomeTopIcon } from '@/components/ui/HomeTopIcon';
import { OptionalFieldReveal } from '@/components/ui/OptionalFieldReveal';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Chip } from '@/components/ui/Chip';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { SetupScreenHeader } from '@/components/ui/SetupScreenHeader';
import { colors } from '@/lib/designTokens';
import { supabase } from '@/lib/supabaseClient';

const PRESET_HOBBIES = ['Travel', 'Music', 'Fitness', 'Reading', 'Gaming', 'Cooking', 'Art', 'Sports'] as const;
const HOBBY_SUGGESTIONS = [
  'Running',
  'Reading',
  'Gaming',
  'Cooking',
  'Photography',
  'Hiking',
  'Dancing',
  'Yoga',
  'Cinema',
  'Art',
  'Sports',
  'Coffee',
  'Cycling',
] as const;
const MAX_HOBBIES = 5;

type RechargeOption =
  | 'Some quiet alone time'
  | 'Hanging out with people'
  | 'Quality time with my pet'
  | 'Depends on the day';
type DrinkingSmoking = 'Both' | 'Only drinking' | 'Only smoking' | 'When socializing' | 'Neither';

const RECHARGE_OPTIONS: readonly RechargeOption[] = [
  'Some quiet alone time',
  'Hanging out with people',
  'Quality time with my pet',
  'Depends on the day',
];
const DRINK_SMOKE_OPTIONS: { label: string; value: DrinkingSmoking }[] = [
  { label: 'I enjoy both', value: 'Both' },
  { label: 'Just drinks for me', value: 'Only drinking' },
  { label: 'Just smoking for me', value: 'Only smoking' },
  { label: 'Only when socializing', value: 'When socializing' },
  { label: 'Neither, not my thing', value: 'Neither' },
];

export default function ProfileSetupStep3() {
  const router = useRouter();
  const params = useLocalSearchParams<{ demo?: string }>();
  const isDemoMode = params.demo === '1';

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const [morningNight, setMorningNight] = useState<string | null>(null);
  const [recharge, setRecharge] = useState<RechargeOption[]>([]);
  const [hobbies, setHobbies] = useState<string[]>([]);
  const [newHobby, setNewHobby] = useState('');
  const [drinkingSmoking, setDrinkingSmoking] = useState<DrinkingSmoking | null>(null);
  const [education, setEducation] = useState<'High school' | 'University' | "Master's" | 'Other' | null>(null);
  const [educationDetail, setEducationDetail] = useState('');
  const [religion, setReligion] = useState<
    'Spiritual' | 'Religious' | 'Agnostic' | 'Atheist' | 'Prefer not to say' | null
  >(null);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isDemoMode) {
      setCheckingAuth(false);
      setUserId('demo-user');
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
      setCheckingAuth(false);
    })();
    return () => {
      mounted = false;
    };
  }, [isDemoMode, router]);

  useEffect(() => {
    if (education === null) {
      setEducationDetail('');
    }
  }, [education]);

  const educationFollowupMeta = useMemo(() => {
    if (!education) return null;
    const meta: Record<string, { placeholder: string }> = {
      'High school': { placeholder: 'Which high school? (optional)' },
      University: { placeholder: 'Which university? (optional)' },
      "Master's": { placeholder: 'Which university / field? (optional)' },
      Other: { placeholder: "Any details you'd like to share? (optional)" },
    };
    return meta[education] ?? null;
  }, [education]);

  const hobbySuggestionsFiltered = useMemo(() => {
    const q = newHobby.trim().toLowerCase();
    const base =
      !q || q.length < 1
        ? [...HOBBY_SUGGESTIONS]
        : HOBBY_SUGGESTIONS.filter((h) => h.toLowerCase().includes(q));
    const taken = new Set(hobbies.map((h) => h.toLowerCase()));
    return base.filter((h) => !taken.has(h.toLowerCase()));
  }, [newHobby, hobbies]);

  const customHobbies = useMemo(
    () => hobbies.filter((h) => !PRESET_HOBBIES.includes(h as (typeof PRESET_HOBBIES)[number])),
    [hobbies],
  );

  const addHobby = (value: string) => {
    const t = value.trim();
    if (!t) return;
    setHobbies((prev) => {
      if (prev.includes(t)) return prev;
      if (prev.length >= MAX_HOBBIES) {
        Alert.alert('Limit', `You can add up to ${MAX_HOBBIES}.`);
        return prev;
      }
      return [...prev, t];
    });
    setNewHobby('');
  };

  const toggleHobby = (value: string) => {
    setHobbies((prev) => {
      if (prev.includes(value)) return prev.filter((x) => x !== value);
      if (prev.length >= MAX_HOBBIES) {
        Alert.alert('Limit', `You can add up to ${MAX_HOBBIES}.`);
        return prev;
      }
      return [...prev, value];
    });
  };

  const toggleRecharge = (opt: RechargeOption) => {
    setRecharge((prev) => {
      if (prev.includes(opt)) return prev.filter((x) => x !== opt);
      return [...prev, opt];
    });
  };

  const persist = async (skip: boolean) => {
    if (!userId) return;
    if (isDemoMode) {
      router.replace('/profile-setup/step4?demo=1');
      return;
    }

    setSaving(true);
    try {
      const educationDetailOut =
        !skip && education ? educationDetail.trim() || null : null;
      const drinkingValue =
        skip || !drinkingSmoking
          ? null
          : drinkingSmoking === 'Both' || drinkingSmoking === 'Only drinking'
            ? 'Yes'
            : drinkingSmoking === 'When socializing'
              ? 'Socially'
              : 'No';
      const smokingValue =
        skip || !drinkingSmoking
          ? null
          : drinkingSmoking === 'Both' || drinkingSmoking === 'Only smoking'
            ? 'Yes'
            : drinkingSmoking === 'When socializing'
              ? 'Socially'
              : 'No';
      const step3ProfilePayload = {
        id: userId,
        morning_night: skip ? null : morningNight,
        recharge_style: skip ? null : recharge.length ? recharge.join(', ') : null,
        hobbies: skip ? null : hobbies.length ? hobbies : null,
        drinking: drinkingValue,
        smoking: smokingValue,
        education: skip ? null : education,
        education_detail: skip ? null : educationDetailOut,
        religion: skip ? null : religion,
        current_step: 4,
      };

      console.log('STEP 3 - user id:', userId);
      console.log('STEP 3 - upsert data:', step3ProfilePayload);
      const { error: profileErr } = await supabase
        .from('profiles')
        .upsert(step3ProfilePayload, { onConflict: 'id' });
      console.log('STEP 3 - upsert error:', profileErr);
      if (profileErr) throw profileErr;

      router.replace('/profile-setup/step4');
    } catch (e: any) {
      console.error('STEP 3 - persist error:', e);
      Alert.alert('Kaydetme başarısız', e?.message ?? 'Bir hata oluştu.');
    } finally {
      setSaving(false);
    }
  };

  if (checkingAuth) return null;

  return (
    <ScreenContainer style={styles.container}>
      <HomeTopIcon />
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SetupScreenHeader step={3} />
        <ThemedText style={styles.title}>A little more about you</ThemedText>

        <View style={styles.section}>
          <ThemedText style={styles.sectionLabel}>Are you a morning person or a night owl?</ThemedText>
          <View style={styles.chipRow}>
            {(['Morning person', 'Night owl', 'Depends on the day'] as const).map((opt) => (
              <Chip
                key={opt}
                label={opt}
                selected={morningNight === opt}
                onPress={() => setMorningNight(opt)}
                style={styles.profileChip}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionLabel}>How do you recharge after a long day?</ThemedText>
          <View style={styles.chipRow}>
            {RECHARGE_OPTIONS.map((opt) => (
              <Chip
                key={opt}
                label={opt}
                selected={recharge.includes(opt)}
                onPress={() => toggleRecharge(opt)}
                style={styles.profileChip}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionLabel}>What do you love doing in your free time?</ThemedText>
          <View style={styles.chipRow}>
            {PRESET_HOBBIES.map((opt) => (
              <Chip
                key={opt}
                label={opt}
                selected={hobbies.includes(opt)}
                onPress={() => toggleHobby(opt)}
                style={styles.profileChip}
              />
            ))}
            {customHobbies.map((h) => (
              <Animated.View key={h} entering={FadeIn.duration(300)}>
                <Chip label={h} selected onPress={() => toggleHobby(h)} style={styles.profileChip} />
              </Animated.View>
            ))}
          </View>
          <View style={styles.hobbyInputWrap}>
            <TextInput
              style={styles.addInput}
              placeholder={hobbies.length >= MAX_HOBBIES ? 'Maximum 5 reached' : '+ Add your own'}
              placeholderTextColor="#AAAAAA"
              value={newHobby}
              editable={hobbies.length < MAX_HOBBIES}
              onChangeText={setNewHobby}
              returnKeyType="done"
              onSubmitEditing={() => {
                const t = newHobby.trim();
                if (!t || hobbies.length >= MAX_HOBBIES) return;
                addHobby(t);
              }}
            />
            {newHobby.trim().length > 0 && hobbies.length < MAX_HOBBIES && hobbySuggestionsFiltered.length > 0 ? (
              <View style={styles.dropdown}>
                <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={styles.dropdownScroll}>
                  {hobbySuggestionsFiltered.slice(0, 8).map((h) => (
                    <Pressable key={h} style={styles.dropdownItem} onPress={() => addHobby(h)}>
                      <ThemedText style={styles.dropdownItemText}>{h}</ThemedText>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionLabel}>What&apos;s your take on drinking and smoking?</ThemedText>
          <View style={styles.chipRow}>
            {DRINK_SMOKE_OPTIONS.map(({ label, value }) => (
              <Chip
                key={value}
                label={label}
                selected={drinkingSmoking === value}
                onPress={() => setDrinkingSmoking(value)}
                style={styles.profileChip}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionLabel}>What&apos;s your education background?</ThemedText>
          <View style={styles.chipRow}>
            {(['High school', 'University', "Master's", 'Other'] as const).map((opt) => (
              <Chip
                key={opt}
                label={opt}
                selected={education === opt}
                onPress={() => setEducation(opt)}
                style={styles.profileChip}
              />
            ))}
          </View>
          <OptionalFieldReveal show={!!educationFollowupMeta} animationKey={education ?? 'none'}>
            <TextInput
              style={styles.followUpInput}
              placeholder={educationFollowupMeta?.placeholder}
              placeholderTextColor="#AAAAAA"
              value={educationDetail}
              onChangeText={setEducationDetail}
            />
          </OptionalFieldReveal>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionLabel}>How would you describe your beliefs?</ThemedText>
          <View style={styles.chipRow}>
            {(['Spiritual', 'Religious', 'Agnostic', 'Atheist', 'Prefer not to say'] as const).map((opt) => (
              <Chip
                key={opt}
                label={opt}
                selected={religion === opt}
                onPress={() => setReligion(opt)}
                style={styles.profileChip}
              />
            ))}
          </View>
        </View>

        <View style={styles.footer}>
          <PrimaryButton label={saving ? 'Saving…' : 'Next →'} onPress={() => persist(false)} loading={saving} disabled={saving} />
          <TouchableOpacity onPress={() => persist(true)} disabled={saving}>
            <ThemedText style={styles.skipText}>Skip for now</ThemedText>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  content: {
    paddingBottom: 40,
    paddingRight: 8,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  section: {
    marginBottom: 18,
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
  profileChip: {
    borderRadius: 20,
  },
  followUpInput: {
    backgroundColor: colors.bgCard,
    borderWidth: 0.5,
    borderColor: '#E8E8E8',
    borderRadius: 12,
    height: 56,
    paddingHorizontal: 16,
    color: colors.textPrimary,
    marginTop: 12,
  },
  drinkSmokeRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  drinkSmokeCol: {
    flex: 1,
    minWidth: 0,
  },
  drinkSmokeLabel: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  hobbyInputWrap: {
    marginTop: 12,
    position: 'relative',
    zIndex: 20,
  },
  addInput: {
    backgroundColor: colors.bgCard,
    borderWidth: 0.5,
    borderColor: '#E8E8E8',
    borderRadius: 12,
    height: 44,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: colors.textPrimary,
  },
  dropdown: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '100%',
    marginTop: 4,
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5E5',
    maxHeight: 160,
    overflow: 'hidden',
  },
  dropdownScroll: {
    maxHeight: 160,
  },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E5',
  },
  dropdownItemText: {
    color: colors.textPrimary,
    fontSize: 14,
  },
  footer: {
    marginTop: 20,
    gap: 18,
    marginBottom: 24,
  },
  skipText: {
    color: '#555555',
    fontSize: 14,
    textAlign: 'center',
  },
});
