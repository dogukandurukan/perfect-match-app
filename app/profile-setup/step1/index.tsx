// Step1 screen 1/9 — phone number (entry point of the whole onboarding
// flow, per user request — matches Raya's dedicated "Verify your number"
// screen). Just collects the number for now; actual SMS OTP verification is
// deferred (needs a paid SMS provider configured in Supabase — CLAUDE.md §5).
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { QuestionScreen } from '@/components/ui/QuestionScreen';
import { colors } from '@/lib/designTokens';
import { COUNTRIES } from '@/lib/countries';
import { TOTAL_SCREENS, useStep1 } from '@/lib/onboardingStep1Context';

export default function Step1Phone() {
  const router = useRouter();
  const { phoneNumber, setPhoneNumber, countryCode, setCountryCode } = useStep1();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selectedCountry = COUNTRIES.find((c) => c.code === countryCode) ?? COUNTRIES[0];
  const filteredCountries = search.trim()
    ? COUNTRIES.filter(
        (c) =>
          c.name.toLowerCase().includes(search.trim().toLowerCase()) ||
          c.dial.includes(search.trim()) ||
          c.code.toLowerCase().includes(search.trim().toLowerCase()),
      )
    : COUNTRIES;

  const canProceed = phoneNumber.trim().length > 0;

  return (
    <QuestionScreen
      step={1}
      totalSteps={TOTAL_SCREENS}
      title="What's your number?"
      subtitle="We'll use this to keep your account secure."
      onNext={() => router.push('/profile-setup/step1/photos')}
      nextDisabled={!canProceed}>
      <View style={styles.row}>
        <View style={styles.countryWrap}>
          <Pressable
            style={styles.countryBtn}
            onPress={() => setDropdownOpen((v) => !v)}
            accessibilityRole="button">
            <ThemedText style={styles.countryBtnText}>
              {selectedCountry.flag} {selectedCountry.dial} ▾
            </ThemedText>
          </Pressable>

          {dropdownOpen ? (
            <View style={styles.dropdown}>
              <TextInput
                style={styles.search}
                placeholder="Search country"
                placeholderTextColor="#AAAAAA"
                value={search}
                onChangeText={setSearch}
                autoCapitalize="none"
              />
              <ScrollView style={styles.dropdownScroll} nestedScrollEnabled>
                {filteredCountries.map((c) => (
                  <Pressable
                    key={c.code}
                    style={styles.dropdownItem}
                    onPress={() => {
                      setCountryCode(c.code);
                      setDropdownOpen(false);
                      setSearch('');
                    }}>
                    <ThemedText style={styles.dropdownItemText}>
                      {c.flag} {c.name} {c.dial}
                    </ThemedText>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}
        </View>

        <TextInput
          style={styles.phoneInput}
          placeholder="555 000 00 00"
          placeholderTextColor="#AAAAAA"
          keyboardType="phone-pad"
          autoFocus
          value={phoneNumber}
          onChangeText={(t) => setPhoneNumber(t.replace(/[^\d]/g, ''))}
        />
      </View>
    </QuestionScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  countryWrap: { position: 'relative' },
  countryBtn: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    height: 54,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  countryBtnText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  phoneInput: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    height: 54,
    paddingHorizontal: 16,
    fontSize: 17,
    color: colors.textPrimary,
  },
  dropdown: {
    position: 'absolute',
    left: 0,
    top: '100%',
    marginTop: 6,
    width: 260,
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.accent,
    maxHeight: 320,
    zIndex: 50,
    overflow: 'hidden',
  },
  search: {
    backgroundColor: colors.bgPrimary,
    color: colors.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  dropdownScroll: { maxHeight: 270 },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.accent,
  },
  dropdownItemText: { color: colors.textPrimary, fontSize: 14 },
});
