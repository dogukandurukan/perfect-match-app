import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { HomeTopIcon } from '@/components/ui/HomeTopIcon';
import { OptionalFieldReveal } from '@/components/ui/OptionalFieldReveal';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Chip } from '@/components/ui/Chip';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { SetupScreenHeader } from '@/components/ui/SetupScreenHeader';
import { supabase } from '@/lib/supabaseClient';

type Vibe = 'Introvert' | 'Extrovert' | 'Mixed';
type Drinking = 'Yes' | 'No' | 'Socially';

const PRESET_HOBBIES = ['Running', 'Movies', 'Music'] as const;
const MAX_HOBBIES = 5;

export default function ProfileSetupStep3() {
  const router = useRouter();
  const params = useLocalSearchParams<{ demo?: string }>();
  const isDemoMode = params.demo === '1';

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const [morningNight, setMorningNight] = useState<string | null>(null);
  const [recharge, setRecharge] = useState<string | null>(null);
  const [hobbies, setHobbies] = useState<string[]>([]);
  const [newHobby, setNewHobby] = useState('');
  const [vibe, setVibe] = useState<Vibe | null>(null);
  const [drinking, setDrinking] = useState<Drinking | null>(null);
  const [smoking, setSmoking] = useState<'Yes' | 'No' | 'Sometimes' | null>(null);
  const [pets, setPets] = useState<'Dog' | 'Cat' | 'Other' | 'No pets' | null>(null);
  const [education, setEducation] = useState<'High school' | 'University' | "Master's" | 'PhD' | 'Other' | null>(null);
  const [educationDetail, setEducationDetail] = useState('');
  const [occupation, setOccupation] = useState('');
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
    if (education === 'Other' || education === null) {
      setEducationDetail('');
    }
  }, [education]);

  const educationFollowupMeta = useMemo(() => {
    if (!education || education === 'Other') return null;
    const meta: Record<string, { placeholder: string }> = {
      'High school': { placeholder: 'Which high school? (optional)' },
      University: { placeholder: 'Which university? (optional)' },
      "Master's": { placeholder: 'Which university / field? (optional)' },
      PhD: { placeholder: 'Which university / field? (optional)' },
    };
    return meta[education] ?? null;
  }, [education]);

  const customHobbies = useMemo(
    () => hobbies.filter((h) => !PRESET_HOBBIES.includes(h as any)),
    [hobbies],
  );

  const toggleHobby = (value: string) => {
    setHobbies((prev) => {
      if (prev.includes(value)) return prev.filter((x) => x !== value);
      if (prev.length >= MAX_HOBBIES) {
        Alert.alert('Limit', `En fazla ${MAX_HOBBIES} seçebilirsin.`);
        return prev;
      }
      return [...prev, value];
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
      const payload = skip
        ? {
            user_id: userId,
            morning_night: null,
            recharge_style: null,
            hobbies: null,
            vibe: null,
            drinking: null,
            smoking: null,
            pets: null,
            education: null,
            religion: null,
            lifestyle_tags: null,
            setup3_completed: true,
          }
        : {
            user_id: userId,
            morning_night: morningNight,
            recharge_style: recharge,
            hobbies: hobbies.length ? hobbies : null,
            vibe,
            drinking,
            smoking,
            pets,
            education,
            religion,
            lifestyle_tags: hobbies.length ? hobbies : null,
            setup3_completed: true,
          };

      const { error } = await supabase.from('preferences').upsert(payload, { onConflict: 'user_id' });
      if (error) throw error;

      const educationDetailOut =
        !skip && education && education !== 'Other' ? educationDetail.trim() || null : null;
      const { error: profileErr } = await supabase.from('profiles').update({
        morning_night: skip ? null : morningNight,
        recharge_style: skip ? null : recharge,
        hobbies: skip ? null : (hobbies.length ? hobbies : null),
        vibe: skip ? null : vibe,
        drinking: skip ? null : drinking,
        smoking: skip ? null : smoking,
        pets: skip ? null : pets,
        education: skip ? null : education,
        education_detail: skip ? null : educationDetailOut,
        occupation: skip ? null : occupation.trim() || null,
        religion: skip ? null : religion,
      }).eq('id', userId);
      if (profileErr) console.warn('profiles occupation/education_detail:', profileErr);

      router.replace('/profile-setup/step4');
    } catch (e: any) {
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
          <ThemedText style={styles.sectionLabel}>Are you more of a morning or night person?</ThemedText>
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
          <ThemedText style={styles.sectionLabel}>How do you recharge?</ThemedText>
          <View style={styles.chipRow}>
            {(['Alone time', 'With people', 'Mix of both'] as const).map((opt) => (
              <Chip
                key={opt}
                label={opt}
                selected={recharge === opt}
                onPress={() => setRecharge(opt)}
                style={styles.profileChip}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionLabel}>What do you enjoy doing?</ThemedText>
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
          <View style={styles.addInputWrap}>
            <TextInput
              style={styles.addInput}
              placeholder={hobbies.length >= MAX_HOBBIES ? 'Maximum 5 reached' : '+ Add your own'}
              placeholderTextColor="#9CA3AF"
              value={newHobby}
              editable={hobbies.length < MAX_HOBBIES}
              onChangeText={setNewHobby}
              returnKeyType="done"
              onSubmitEditing={() => {
                const t = newHobby.trim();
                if (!t || hobbies.length >= MAX_HOBBIES) return;
                setNewHobby('');
                toggleHobby(t);
              }}
            />
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionLabel}>How would you describe your energy?</ThemedText>
          <View style={styles.chipRow}>
            {(['Introvert', 'Extrovert', 'Mixed'] as const).map((opt) => (
              <Chip
                key={opt}
                label={opt}
                selected={vibe === opt}
                onPress={() => setVibe(opt)}
                style={styles.profileChip}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionLabel}>Do you drink?</ThemedText>
          <View style={styles.chipRow}>
            {(['Yes', 'No', 'Socially'] as const).map((opt) => (
              <Chip
                key={opt}
                label={opt}
                selected={drinking === opt}
                onPress={() => setDrinking(opt)}
                style={styles.profileChip}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionLabel}>Do you smoke?</ThemedText>
          <View style={styles.chipRow}>
            {(['Yes', 'No', 'Sometimes'] as const).map((opt) => (
              <Chip
                key={opt}
                label={opt}
                selected={smoking === opt}
                onPress={() => setSmoking(opt)}
                style={styles.profileChip}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionLabel}>Do you have any pets?</ThemedText>
          <View style={styles.chipRow}>
            {(['Dog', 'Cat', 'Other', 'No pets'] as const).map((opt) => (
              <Chip
                key={opt}
                label={opt}
                selected={pets === opt}
                onPress={() => setPets(opt)}
                style={styles.profileChip}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionLabel}>What is your education level?</ThemedText>
          <View style={styles.chipRow}>
            {(['High school', 'University', "Master's", 'PhD', 'Other'] as const).map((opt) => (
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
              placeholderTextColor="#9CA3AF"
              value={educationDetail}
              onChangeText={setEducationDetail}
            />
          </OptionalFieldReveal>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionLabel}>What do you do for a living?</ThemedText>
          <TextInput
            style={styles.occupationInput}
            placeholder="e.g. Software Engineer, Teacher, Student..."
            placeholderTextColor="#9CA3AF"
            value={occupation}
            onChangeText={setOccupation}
          />
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionLabel}>Which word best describes your religion?</ThemedText>
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
          <PrimaryButton label={saving ? 'Saving…' : 'Next →'} onPress={() => persist(false)} loading={saving} />
          <TouchableOpacity onPress={() => persist(true)}>
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
    color: '#F5F0E8',
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  section: {
    marginBottom: 18,
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
  profileChip: {
    borderRadius: 20,
  },
  followUpInput: {
    backgroundColor: '#1C2030',
    borderRadius: 12,
    height: 56,
    paddingHorizontal: 16,
    color: '#F5F0E8',
    marginTop: 12,
  },
  occupationInput: {
    backgroundColor: '#1C2030',
    borderRadius: 12,
    height: 56,
    paddingHorizontal: 16,
    color: '#F5F0E8',
  },
  addInputWrap: {
    marginTop: 12,
  },
  addInput: {
    backgroundColor: '#1C2030',
    borderRadius: 12,
    height: 44,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#F5F0E8',
  },
  footer: {
    marginTop: 20,
    gap: 18,
    marginBottom: 24,
  },
  skipText: {
    color: 'rgba(245, 240, 232, 0.6)',
    fontSize: 14,
    textAlign: 'center',
  },
});
