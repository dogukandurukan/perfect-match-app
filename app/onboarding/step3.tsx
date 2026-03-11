import { useRouter } from 'expo-router';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

export default function OnboardingStep3() {
  const router = useRouter();

  const handleNext = () => {
    router.push('/onboarding/step4');
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <View style={styles.container}>
      <View style={styles.progressRow}>
        <View style={[styles.progressBar, styles.progressActive]} />
        <View style={[styles.progressBar, styles.progressActive]} />
        <View style={[styles.progressBar, styles.progressActive]} />
        <View style={styles.progressBar} />
      </View>

      <ThemedText type="title" style={styles.title}>
        İlgi alanların
      </ThemedText>
      <ThemedText style={styles.subtitle}>
        Ortak ilgi alanları, sohbetin doğal akmasını sağlar. Ne kadar çok seçersen, algoritma o
        kadar isabetli olur.
      </ThemedText>

      <View style={styles.section}>
        <View style={styles.chipRow}>
          <Chip label="Müzik" />
          <Chip label="Konser / festival" />
          <Chip label="Spor" />
          <Chip label="Koşu" />
          <Chip label="Yoga / pilates" />
          <Chip label="Seyahat" />
          <Chip label="Kahve / üçüncü dalga" />
          <Chip label="Yeme‑içme / yeni mekan" />
          <Chip label="Sinema / dizi" />
          <Chip label="Kitap" />
          <Chip label="Sanat / sergi" />
          <Chip label="Oyun" />
        </View>
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
};

function Chip({ label }: ChipProps) {
  return (
    <TouchableOpacity style={styles.chip} activeOpacity={0.85}>
      <ThemedText style={styles.chipText}>{label}</ThemedText>
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
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    color: '#9CA3AF',
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
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
  chipText: {
    color: '#E5E7EB',
    fontSize: 13,
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

