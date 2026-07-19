import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { HomeTopIcon } from '@/components/ui/HomeTopIcon';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenContainer } from '@/components/ui/ScreenContainer';

const OPTIONS = ['Outdoors & active', 'Cozy & homebody', 'Social & events', 'Mix of everything'] as const;
type Option = (typeof OPTIONS)[number];

export default function OnboardingStep3() {
  const router = useRouter();
  const [selected, setSelected] = useState<Option[]>([]);

  const toggleSelect = (value: Option) => {
    setSelected((prev) => (prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value]));
  };

  const handleContinue = () => {
    router.replace('/(auth)/register');
  };

  return (
    <ScreenContainer style={styles.container}>
      <HomeTopIcon />
      <ThemedText style={styles.progress}>2 of 2</ThemedText>

      <ThemedText style={styles.question}>How does your ideal weekend look?</ThemedText>

      <ThemedText style={styles.hint}>
        Choose one or more. Selected: {selected.length}
      </ThemedText>

      <View style={styles.options}>
        {OPTIONS.map((opt) => (
          <OptionCard
            key={opt}
            label={opt}
            selected={selected.includes(opt)}
            onPress={() => toggleSelect(opt)}
          />
        ))}
      </View>

      <View style={styles.footer}>
        <PrimaryButton label="Continue" onPress={handleContinue} disabled={selected.length === 0} />
      </View>
    </ScreenContainer>
  );
}

type OptionCardProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

function OptionCard({ label, selected, onPress }: OptionCardProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        selected && styles.cardSelected,
        pressed && styles.cardPressed,
      ]}
      onPress={onPress}>
      <ThemedText style={styles.cardText}>{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'flex-start',
  },
  progress: {
    textAlign: 'center',
    color: '#C9A96E',
    fontSize: 14,
    marginTop: 8,
    marginBottom: 24,
  },
  question: {
    color: '#F5F0E8',
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 24,
  },
  hint: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: -12,
    marginBottom: 16,
  },
  options: {
    gap: 16,
  },
  footer: {
    marginTop: 24,
  },
  card: {
    width: '100%',
    backgroundColor: '#1C2030',
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  cardSelected: {
    borderWidth: 1,
    borderColor: '#C9A96E',
  },
  cardPressed: {
    transform: [{ scale: 0.99 }],
    opacity: 0.95,
  },
  cardText: {
    color: '#F5F0E8',
    fontSize: 16,
  },
});

