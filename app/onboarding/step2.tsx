import { useRouter } from 'expo-router';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

export default function OnboardingStep2() {
  const router = useRouter();

  const handleNext = () => {
    router.push('/onboarding/step3');
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <View style={styles.container}>
      <View style={styles.progressRow}>
        <View style={[styles.progressBar, styles.progressActive]} />
        <View style={[styles.progressBar, styles.progressActive]} />
        <View style={styles.progressBar} />
        <View style={styles.progressBar} />
      </View>

      <ThemedText type="title" style={styles.title}>
        Ne zaman ve nasıl buluşmak istersin?
      </ThemedText>
      <ThemedText style={styles.subtitle}>
        Zaman ve buluşma tipi, algoritmanın senin için doğru anı seçmesini sağlar.
      </ThemedText>

      <View style={styles.section}>
        <ThemedText style={styles.label}>En rahat olduğun zamanlar</ThemedText>
        <View style={styles.chipRow}>
          <Chip label="Hafta içi akşam" />
          <Chip label="Hafta sonu gündüz" />
          <Chip label="Hafta sonu akşam" />
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.label}>Tercih ettiğin buluşma tipleri</ThemedText>
        <View style={styles.chipRow}>
          <Chip label="Kahve" />
          <Chip label="Bar / kokteyl" />
          <Chip label="Yürüyüş" />
          <Chip label="Brunch" />
          <Chip label="Akşam yemeği" />
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
  label: {
    color: '#E5E7EB',
    marginBottom: 8,
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

