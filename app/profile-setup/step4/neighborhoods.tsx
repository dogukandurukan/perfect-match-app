// Step4 screen 4/6 — neighborhoods you'd meet in. Preset chips + free-text
// add with a filtered dropdown, max 3.
import { useMemo, useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Chip } from '@/components/ui/Chip';
import { ThemedText } from '@/components/themed-text';
import { QuestionScreen } from '@/components/ui/QuestionScreen';
import { colors } from '@/lib/designTokens';
import {
  MAX_NEIGHBORHOODS,
  NEIGHBORHOOD_PRESETS,
  NEIGHBORHOOD_SUGGESTIONS,
  TOTAL_SCREENS,
  normalizeLoc,
  useStep4,
} from '@/lib/onboardingStep4Context';

export default function Step4Neighborhoods() {
  const router = useRouter();
  const { preferredLocations, addNeighborhood, removeNeighborhood } = useStep4();
  const [neighborhoodInput, setNeighborhoodInput] = useState('');

  const filteredNeighborhoods = useMemo(() => {
    const q = neighborhoodInput.trim().toLowerCase();
    if (!q) return [...NEIGHBORHOOD_SUGGESTIONS];
    return NEIGHBORHOOD_SUGGESTIONS.filter((n) => n.toLowerCase().includes(q));
  }, [neighborhoodInput]);

  const customNeighborhoods = useMemo(() => {
    const presetNorm = new Set(NEIGHBORHOOD_PRESETS.map(normalizeLoc));
    return preferredLocations.filter((loc) => !presetNorm.has(normalizeLoc(loc)));
  }, [preferredLocations]);

  return (
    <QuestionScreen
      step={4}
      totalSteps={TOTAL_SCREENS}
      macroStep={4}
      title="Which neighborhoods work best for you?"
      onNext={() => router.push('/profile-setup/step4/firstmeeting' as never)}>
      <View style={styles.chipRow}>
        {NEIGHBORHOOD_PRESETS.map((p) => {
          const selected = preferredLocations.map(normalizeLoc).includes(normalizeLoc(p));
          return (
            <Chip
              key={p}
              label={p}
              selected={selected}
              onPress={() => {
                if (selected) return removeNeighborhood(p);
                if (preferredLocations.length >= MAX_NEIGHBORHOODS) return;
                addNeighborhood(p);
              }}
              selectedColor="#1A1A1A"
            />
          );
        })}
      </View>

      <View style={styles.inputWrap}>
        <TextInput
          style={styles.input}
          placeholder={
            preferredLocations.length >= MAX_NEIGHBORHOODS
              ? 'Maximum 3 neighborhoods reached'
              : '+ Add a neighborhood'
          }
          placeholderTextColor="#AAAAAA"
          value={neighborhoodInput}
          editable={preferredLocations.length < MAX_NEIGHBORHOODS}
          onChangeText={setNeighborhoodInput}
          returnKeyType="done"
          onSubmitEditing={() => {
            if (preferredLocations.length >= MAX_NEIGHBORHOODS) return;
            addNeighborhood(neighborhoodInput);
            setNeighborhoodInput('');
          }}
        />
        {neighborhoodInput.trim().length > 0 &&
        preferredLocations.length < MAX_NEIGHBORHOODS &&
        filteredNeighborhoods.length > 0 ? (
          <View style={styles.dropdown}>
            <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={styles.dropdownScroll}>
              {filteredNeighborhoods.slice(0, 8).map((n) => (
                <TouchableOpacity
                  key={n}
                  style={styles.dropdownItem}
                  onPress={() => {
                    addNeighborhood(n);
                    setNeighborhoodInput('');
                  }}>
                  <ThemedText style={styles.dropdownItemText}>{n}</ThemedText>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : null}
      </View>

      {customNeighborhoods.length > 0 ? (
        <View style={[styles.chipRow, styles.customChipRow]}>
          {customNeighborhoods.map((loc) => (
            <Chip
              key={loc}
              label={loc}
              selected
              onPress={() => removeNeighborhood(loc)}
              selectedColor="#1A1A1A"
            />
          ))}
        </View>
      ) : null}
    </QuestionScreen>
  );
}

const styles = StyleSheet.create({
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  customChipRow: { marginTop: 12 },
  inputWrap: {
    marginTop: 16,
    position: 'relative',
    zIndex: 20,
  },
  input: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    height: 50,
    paddingHorizontal: 16,
    color: colors.textPrimary,
    fontSize: 15,
  },
  dropdown: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '100%',
    marginTop: 6,
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5E5',
    maxHeight: 200,
    overflow: 'hidden',
  },
  dropdownScroll: { maxHeight: 200 },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E5',
  },
  dropdownItemText: { color: colors.textPrimary, fontSize: 15 },
});
