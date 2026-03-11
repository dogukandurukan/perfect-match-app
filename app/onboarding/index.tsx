import { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';

export default function OnboardingStep1() {
  const router = useRouter();
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<'female' | 'male' | 'other' | 'hidden' | null>(null);
  const [lookingFor, setLookingFor] = useState<'female' | 'male' | 'any' | null>(null);
  const [city, setCity] = useState('');

  const handleNext = () => {
    router.push('/onboarding/step2');
  };

  return (
    <View style={styles.container}>
      <View style={styles.progressRow}>
        <View style={[styles.progressBar, styles.progressActive]} />
        <View style={styles.progressBar} />
        <View style={styles.progressBar} />
        <View style={styles.progressBar} />
      </View>

      <ThemedText type="title" style={styles.title}>
        Seni daha iyi tanıyalım
      </ThemedText>
      <ThemedText style={styles.subtitle}>
        Bu adım, sana uygun kişileri filtrelememize yardım edecek. 30 saniye bile sürmez.
      </ThemedText>

      <View style={styles.form}>
        <ThemedText style={styles.label}>Yaşın</ThemedText>
        <TextInput
          style={styles.input}
          placeholder="Örn. 27"
          placeholderTextColor="#9CA3AF"
          keyboardType="number-pad"
          value={age}
          onChangeText={setAge}
        />

        <ThemedText style={styles.label}>Cinsiyetin</ThemedText>
        <View style={styles.chipRow}>
          <Chip label="Kadın" selected={gender === 'female'} onPress={() => setGender('female')} />
          <Chip label="Erkek" selected={gender === 'male'} onPress={() => setGender('male')} />
          <Chip label="Diğer" selected={gender === 'other'} onPress={() => setGender('other')} />
          <Chip
            label="Söylemek istemiyorum"
            selected={gender === 'hidden'}
            onPress={() => setGender('hidden')}
          />
        </View>

        <ThemedText style={styles.label}>Kimleri arıyorsun?</ThemedText>
        <View style={styles.chipRow}>
          <Chip
            label="Kadın"
            selected={lookingFor === 'female'}
            onPress={() => setLookingFor('female')}
          />
          <Chip
            label="Erkek"
            selected={lookingFor === 'male'}
            onPress={() => setLookingFor('male')}
          />
          <Chip
            label="Farketmez"
            selected={lookingFor === 'any'}
            onPress={() => setLookingFor('any')}
          />
        </View>

        <ThemedText style={styles.label}>Şehrin</ThemedText>
        <TextInput
          style={styles.input}
          placeholder="Örn. İstanbul"
          placeholderTextColor="#9CA3AF"
          autoCapitalize="words"
          value={city}
          onChangeText={setCity}
        />
      </View>

      <View style={styles.bottomRow}>
        <TouchableOpacity onPress={handleNext}>
          <ThemedText style={styles.skipText}>Skip</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity style={styles.nextButton} activeOpacity={0.9} onPress={handleNext}>
          <ThemedText style={styles.nextButtonText}>Devam et</ThemedText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

type ChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

function Chip({ label, selected, onPress }: ChipProps) {
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipSelected]}
      activeOpacity={0.85}
      onPress={onPress}>
      <ThemedText style={[styles.chipText, selected && styles.chipTextSelected]}>
        {label}
      </ThemedText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 24,
  },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#1F2937',
  },
  progressActive: {
    backgroundColor: '#F97316',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    color: '#9CA3AF',
    marginBottom: 24,
  },
  form: {
    flex: 1,
    gap: 16,
  },
  label: {
    color: '#E5E7EB',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#111827',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#4B5563',
  },
  chipSelected: {
    backgroundColor: '#F97316',
    borderColor: '#F97316',
  },
  chipText: {
    color: '#E5E7EB',
    fontSize: 13,
  },
  chipTextSelected: {
    color: '#111827',
    fontWeight: '600',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  skipText: {
    color: '#6B7280',
  },
  nextButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  nextButtonText: {
    color: '#111827',
    fontWeight: '600',
  },
});

