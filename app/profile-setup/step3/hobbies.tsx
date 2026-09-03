// Step3 screen 3/6 — hobbies. Preset chips + free-text add with a filtered
// suggestion dropdown, same pattern as step1's languages screen.
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Chip } from '@/components/ui/Chip';
import { ThemedText } from '@/components/themed-text';
import { QuestionScreen } from '@/components/ui/QuestionScreen';
import { colors } from '@/lib/designTokens';
import {
  HOBBY_SUGGESTIONS,
  MAX_HOBBIES,
  PRESET_HOBBIES,
  TOTAL_SCREENS,
  useStep3,
} from '@/lib/onboardingStep3Context';

export default function Step3Hobbies() {
  const router = useRouter();
  const { hobbies, toggleHobby, addHobby } = useStep3();
  const [newHobby, setNewHobby] = useState('');

  const hobbySuggestionsFiltered = useMemo(() => {
    const q = newHobby.trim().toLowerCase();
    const base = !q ? [...HOBBY_SUGGESTIONS] : HOBBY_SUGGESTIONS.filter((h) => h.toLowerCase().includes(q));
    const taken = new Set(hobbies.map((h) => h.toLowerCase()));
    return base.filter((h) => !taken.has(h.toLowerCase()));
  }, [newHobby, hobbies]);

  const customHobbies = useMemo(
    () => hobbies.filter((h) => !PRESET_HOBBIES.includes(h as (typeof PRESET_HOBBIES)[number])),
    [hobbies],
  );

  return (
    <QuestionScreen
      step={3}
      totalSteps={TOTAL_SCREENS}
      macroStep={3}
      title="What do you love doing in your free time?"
      onNext={() => router.push('/profile-setup/step3/drinking' as never)}>
      <View style={styles.chipRow}>
        {PRESET_HOBBIES.map((opt) => (
          <Chip
            key={opt}
            label={opt}
            selected={hobbies.includes(opt)}
            onPress={() => toggleHobby(opt)}
            selectedColor="#1A1A1A"
          />
        ))}
        {customHobbies.map((h) => (
          <Animated.View key={h} entering={FadeIn.duration(200)}>
            <Chip label={h} selected onPress={() => toggleHobby(h)} selectedColor="#1A1A1A" />
          </Animated.View>
        ))}
      </View>

      <View style={styles.inputWrap}>
        <TextInput
          style={styles.input}
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
            setNewHobby('');
          }}
        />
        {newHobby.trim().length > 0 && hobbies.length < MAX_HOBBIES && hobbySuggestionsFiltered.length > 0 ? (
          <View style={styles.dropdown}>
            <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={styles.dropdownScroll}>
              {hobbySuggestionsFiltered.slice(0, 8).map((h) => (
                <Pressable
                  key={h}
                  style={styles.dropdownItem}
                  onPress={() => {
                    addHobby(h);
                    setNewHobby('');
                  }}>
                  <ThemedText style={styles.dropdownItemText}>{h}</ThemedText>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}
      </View>
    </QuestionScreen>
  );
}

const styles = StyleSheet.create({
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
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
