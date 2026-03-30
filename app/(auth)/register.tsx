import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { HomeTopIcon } from '@/components/ui/HomeTopIcon';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { colors } from '@/lib/designTokens';
import { supabase } from '@/lib/supabaseClient';

type Country = { code: string; name: string; dial: string; flag: string };

const COUNTRIES: readonly Country[] = [
  { code: 'TR', name: 'Turkey', dial: '+90', flag: '🇹🇷' },
  { code: 'US', name: 'United States', dial: '+1', flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom', dial: '+44', flag: '🇬🇧' },
  { code: 'DE', name: 'Germany', dial: '+49', flag: '🇩🇪' },
  { code: 'FR', name: 'France', dial: '+33', flag: '🇫🇷' },
  { code: 'NL', name: 'Netherlands', dial: '+31', flag: '🇳🇱' },
  { code: 'BE', name: 'Belgium', dial: '+32', flag: '🇧🇪' },
  { code: 'CH', name: 'Switzerland', dial: '+41', flag: '🇨🇭' },
  { code: 'AT', name: 'Austria', dial: '+43', flag: '🇦🇹' },
  { code: 'IT', name: 'Italy', dial: '+39', flag: '🇮🇹' },
  { code: 'ES', name: 'Spain', dial: '+34', flag: '🇪🇸' },
  { code: 'PT', name: 'Portugal', dial: '+351', flag: '🇵🇹' },
  { code: 'GR', name: 'Greece', dial: '+30', flag: '🇬🇷' },
  { code: 'SE', name: 'Sweden', dial: '+46', flag: '🇸🇪' },
  { code: 'NO', name: 'Norway', dial: '+47', flag: '🇳🇴' },
  { code: 'DK', name: 'Denmark', dial: '+45', flag: '🇩🇰' },
  { code: 'FI', name: 'Finland', dial: '+358', flag: '🇫🇮' },
  { code: 'PL', name: 'Poland', dial: '+48', flag: '🇵🇱' },
  { code: 'RU', name: 'Russia', dial: '+7', flag: '🇷🇺' },
  { code: 'UA', name: 'Ukraine', dial: '+380', flag: '🇺🇦' },
  { code: 'AE', name: 'UAE', dial: '+971', flag: '🇦🇪' },
  { code: 'SA', name: 'Saudi Arabia', dial: '+966', flag: '🇸🇦' },
  { code: 'EG', name: 'Egypt', dial: '+20', flag: '🇪🇬' },
  { code: 'MA', name: 'Morocco', dial: '+212', flag: '🇲🇦' },
  { code: 'JP', name: 'Japan', dial: '+81', flag: '🇯🇵' },
  { code: 'KR', name: 'South Korea', dial: '+82', flag: '🇰🇷' },
  { code: 'CN', name: 'China', dial: '+86', flag: '🇨🇳' },
  { code: 'IN', name: 'India', dial: '+91', flag: '🇮🇳' },
  { code: 'AU', name: 'Australia', dial: '+61', flag: '🇦🇺' },
  { code: 'CA', name: 'Canada', dial: '+1', flag: '🇨🇦' },
  { code: 'BR', name: 'Brazil', dial: '+55', flag: '🇧🇷' },
  { code: 'MX', name: 'Mexico', dial: '+52', flag: '🇲🇽' },
  { code: 'AR', name: 'Argentina', dial: '+54', flag: '🇦🇷' },
  { code: 'ZA', name: 'South Africa', dial: '+27', flag: '🇿🇦' },
] as const;

export default function RegisterScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifyModal, setVerifyModal] = useState(false);

  const [selectedCountryCode, setSelectedCountryCode] = useState('TR');
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');

  const selectedCountry = useMemo(
    () => COUNTRIES.find((c) => c.code === selectedCountryCode) ?? COUNTRIES[0],
    [selectedCountryCode],
  );

  const filteredCountries = useMemo(() => {
    const q = countrySearch.trim().toLowerCase();
    if (!q) return [...COUNTRIES];
    return COUNTRIES.filter((c) => c.name.toLowerCase().includes(q) || c.dial.includes(q) || c.code.includes(q));
  }, [countrySearch]);

  const handleRegister = async () => {
    if (!email || !password) {
      return;
    }

    if (password.length < 8) {
      return;
    }

    setLoading(true);
    const emailRedirectTo = Linking.createURL('/profile-setup/step1');
    const meta: Record<string, string> = {};
    const trimmedPhone = phoneNumber.trim();
    if (trimmedPhone) {
      meta.phone_number = trimmedPhone;
      meta.country_code = selectedCountry.code;
      meta.dial_code = selectedCountry.dial;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
        ...(Object.keys(meta).length ? { data: meta } : {}),
      },
    });
    setLoading(false);

    if (error) {
      Alert.alert('Sign up failed', error.message);
      return;
    }

    if (data.session) {
      router.replace('/profile-setup/step1');
      return;
    }

    setVerifyModal(true);
  };

  const openMailApp = () => {
    Linking.openURL('mailto:').catch(() => {});
  };

  return (
    <ScreenContainer style={styles.container}>
      <HomeTopIcon />
      <ThemedText type="title" style={styles.title}>
        Create account
      </ThemedText>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#AAAAAA"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#AAAAAA"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <View style={styles.phoneRow}>
          <View style={styles.countrySelectWrap}>
            <Pressable
              style={[styles.input, styles.countrySelectBtn]}
              onPress={() => setCountryDropdownOpen((v) => !v)}>
              <ThemedText style={styles.countrySelectText}>
                {selectedCountry.flag} {selectedCountry.dial} ▼
              </ThemedText>
            </Pressable>

            {countryDropdownOpen ? (
              <View style={styles.countryDropdown} accessibilityRole="menu">
                <TextInput
                  style={styles.countrySearch}
                  placeholder="Search country"
                  placeholderTextColor="#AAAAAA"
                  value={countrySearch}
                  onChangeText={setCountrySearch}
                  autoCapitalize="none"
                />
                <ScrollView style={styles.countryDropdownScroll} nestedScrollEnabled>
                  {filteredCountries.map((c) => (
                    <Pressable
                      key={c.code}
                      style={styles.countryDropdownItem}
                      onPress={() => {
                        setSelectedCountryCode(c.code);
                        setCountryDropdownOpen(false);
                        setCountrySearch('');
                      }}>
                      <ThemedText style={styles.countryDropdownItemText}>
                        {c.flag} {c.name} {c.dial}
                      </ThemedText>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </View>

          <TextInput
            style={[styles.input, styles.phoneInput]}
            placeholder="555 000 00 00"
            placeholderTextColor="#AAAAAA"
            keyboardType="phone-pad"
            value={phoneNumber}
            onChangeText={(t) => setPhoneNumber(t.replace(/[^\d]/g, ''))}
          />
        </View>

        <PrimaryButton
          label={loading ? 'Signing up…' : 'Sign up'}
          onPress={handleRegister}
          loading={loading}
          disabled={!email.trim() || !password || password.length < 8}
        />

        <ThemedText style={styles.linkText} onPress={() => router.push('/(auth)/login')}>
          Already have an account? Log in
        </ThemedText>
      </View>

      <Modal visible={verifyModal} transparent animationType="fade" onRequestClose={() => setVerifyModal(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setVerifyModal(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <ThemedText style={styles.verifyIcon}>✉️</ThemedText>
            <ThemedText style={styles.verifyTitle}>Check your email!</ThemedText>
            <ThemedText style={styles.verifyBody}>
              We sent you a confirmation link. Click it to get started.
            </ThemedText>
            <PrimaryButton label="Open email app" onPress={openMailApp} />
            <Pressable onPress={() => setVerifyModal(false)} style={styles.modalDismiss}>
              <ThemedText style={styles.modalDismissText}>Close</ThemedText>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.accent,
    marginBottom: 24,
    textAlign: 'left',
  },
  form: {
    gap: 16,
  },
  input: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    color: colors.textPrimary,
  },
  phoneRow: {
    flexDirection: 'row',
    gap: 12,
  },
  countrySelectWrap: {
    flex: 0.38,
    position: 'relative',
  },
  countrySelectBtn: {
    paddingVertical: 14,
  },
  countrySelectText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  countryDropdown: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '100%',
    marginTop: 6,
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.accent,
    maxHeight: 300,
    zIndex: 50,
    overflow: 'hidden',
  },
  countryDropdownScroll: {
    maxHeight: 250,
  },
  countrySearch: {
    backgroundColor: colors.bgPrimary,
    color: colors.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  countryDropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.accent,
  },
  countryDropdownItemText: {
    color: colors.textPrimary,
    fontSize: 14,
  },
  phoneInput: {
    flex: 1,
  },
  linkText: {
    marginTop: 16,
    textAlign: 'center',
    color: colors.textPrimary,
    fontSize: 14,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 24,
    gap: 16,
  },
  verifyIcon: {
    fontSize: 40,
    textAlign: 'center',
  },
  verifyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  verifyBody: {
    fontSize: 15,
    color: colors.textPrimary,
    opacity: 0.85,
    textAlign: 'center',
    lineHeight: 22,
  },
  modalDismiss: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  modalDismissText: {
    color: '#AAAAAA',
    fontSize: 14,
  },
});
