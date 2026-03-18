import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { HomeTopIcon } from '@/components/ui/HomeTopIcon';
import { ScreenContainer } from '@/components/ui/ScreenContainer';

const OPTIONS = ['Something serious', 'A life partner', 'Not sure yet'] as const;
type Option = (typeof OPTIONS)[number];

export default function OnboardingStep2() {
  const router = useRouter();
  const [selected, setSelected] = useState<Option | null>(null);

  const handleSelect = (value: Option) => {
    setSelected(value);
    router.push('/onboarding/step3');
  };

  return (
    <ScreenContainer style={styles.container}>
      <HomeTopIcon />
      <ThemedText style={styles.progress}>1 of 2</ThemedText>

      <ThemedText style={styles.question}>What are you looking for?</ThemedText>

      <View style={styles.options}>
        {OPTIONS.map((opt) => (
          <OptionCard
            key={opt}
            label={opt}
            selected={selected === opt}
            onPress={() => handleSelect(opt)}
          />
        ))}
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
  options: {
    gap: 16,
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

