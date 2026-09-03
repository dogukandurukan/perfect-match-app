// Step1 screen 8/8 — languages. Last screen: triggers submitAll() (the old
// handleNext — upload photos/selfie, upsert the profile row) instead of
// navigating to another step1 screen.
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Chip } from '@/components/ui/Chip';
import { ThemedText } from '@/components/themed-text';
import { QuestionScreen } from '@/components/ui/QuestionScreen';
import { colors } from '@/lib/designTokens';
import {
  LANGUAGE_SUGGESTIONS,
  MAX_LANGUAGES,
  PRESET_LANGUAGES,
  TOTAL_SCREENS,
  useStep1,
} from '@/lib/onboardingStep1Context';

export default function Step1Languages() {
  const { languages, toggleLanguage, addLanguage, saving, submitAll } = useStep1();
  const [langInput, setLangInput] = useState('');

  const langSuggestionsFiltered = useMemo(() => {
    const q = langInput.trim().toLowerCase();
    if (!q) return [...LANGUAGE_SUGGESTIONS];
    return LANGUAGE_SUGGESTIONS.filter(
      (l) => l.toLowerCase().startsWith(q) || l.toLowerCase().includes(q),
    );
  }, [langInput]);

  const customLanguages = useMemo(
    () => languages.filter((l) => !PRESET_LANGUAGES.includes(l as (typeof PRESET_LANGUAGES)[number])),
    [languages],
  );

  return (
    <QuestionScreen
      step={9}
      totalSteps={TOTAL_SCREENS}
      title="Which languages do you speak?"
      onNext={() => void submitAll()}
      nextLabel={saving ? 'Saving…' : 'Finish'}
      nextLoading={saving}>
      <View style={styles.chipRow}>
        {PRESET_LANGUAGES.map((opt) => (
          <Chip
            key={opt}
            label={opt}
            selected={languages.includes(opt)}
            onPress={() => toggleLanguage(opt)}
            selectedColor="#1A1A1A"
          />
        ))}
        {customLanguages.map((lang) => (
          <Animated.View key={lang} entering={FadeIn.duration(200)}>
            <Chip label={lang} selected onPress={() => toggleLanguage(lang)} selectedColor="#1A1A1A" />
          </Animated.View>
        ))}
      </View>

      <View style={styles.inputWrap}>
        <TextInput
          style={styles.input}
          placeholder={languages.length >= MAX_LANGUAGES ? 'Maximum 5 reached' : '+ Add language'}
          placeholderTextColor="#AAAAAA"
          value={langInput}
          editable={languages.length < MAX_LANGUAGES}
          onChangeText={setLangInput}
          returnKeyType="done"
          onSubmitEditing={() => {
            const t = langInput.trim();
            if (!t || languages.length >= MAX_LANGUAGES) return;
            addLanguage(t);
            setLangInput('');
          }}
        />
        {langInput.trim().length > 0 &&
        languages.length < MAX_LANGUAGES &&
        langSuggestionsFiltered.length > 0 ? (
          <View style={styles.dropdown}>
            <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={styles.dropdownScroll}>
              {langSuggestionsFiltered.slice(0, 8).map((lang) => (
                <Pressable
                  key={lang}
                  style={styles.dropdownItem}
                  onPress={() => {
                    addLanguage(lang);
                    setLangInput('');
                  }}>
                  <ThemedText style={styles.dropdownItemText}>{lang}</ThemedText>
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
