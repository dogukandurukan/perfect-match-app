// DEV-ONLY, TEMPORARY (P05 R2 bisect #2). Input lab #1 showed every variant —
// including the real OnboardingTextField — renders correctly on the phone
// OUTSIDE the onboarding flow. This screen renders the SAME component INSIDE
// the real OnboardingScreen container (as the flow does) with different prop
// sets, to separate "container causes it" from "field props cause it".
// No backend, nothing saved. Redirects in production.
import { Redirect, Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { OnboardingPrimaryButton } from '@/components/onboarding-v2/OnboardingPrimaryButton';
import { OnboardingScreen } from '@/components/onboarding-v2/OnboardingScreen';
import { OnboardingTextField } from '@/components/onboarding-v2/OnboardingTextField';
import { obColors, obFonts } from '@/lib/onboardingV2/theme';

function Row({ tag, children }: { tag: string; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.tag}>{tag}</Text>
      {children}
    </View>
  );
}

export default function InputLab2() {
  const router = useRouter();
  const [job, setJob] = useState('');
  const [school, setSchool] = useState('');
  const [plain, setPlain] = useState('');
  // Recycling repro: 'ruler' mounts a ruler-style input (Playfair 56 / lineHeight 68);
  // switching unmounts it and mounts a field in the same render, so iOS reuses
  // the ruler's native view for the new field.
  const [repro, setRepro] = useState<'ruler' | 'noLH' | 'withLH'>('ruler');
  if (!__DEV__) return <Redirect href="/" />;
  return (
    <>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <OnboardingScreen
        sectionLabel="Lab"
        step={1}
        totalSteps={1}
        title="Input lab 2"
        helper="Same component, inside the flow container."
        compactTitle
        onBack={router.canGoBack() ? () => router.back() : undefined}
        footer={<OnboardingPrimaryButton label="Continue" onPress={() => {}} />}>
        <Row tag="R · recycling repro (tap a button, then compare)">
          <View style={styles.btns}>
            <TouchableOpacity onPress={() => setRepro('ruler')} style={styles.btn}><Text>1 ruler</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setRepro('noLH')} style={styles.btn}><Text>2 field, no lineHeight</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setRepro('withLH')} style={styles.btn}><Text>3 field, lineHeight 25</Text></TouchableOpacity>
          </View>
          {repro === 'ruler' ? (
            <TextInput placeholder="—" style={styles.ruler} />
          ) : (
            <TextInput
              key={repro}
              placeholder="e.g. Designer"
              placeholderTextColor={obColors.textSecondary}
              style={[styles.field, repro === 'withLH' ? { lineHeight: 25 } : null]}
            />
          )}
          <Text style={styles.tag}>Expected if recycling is the cause: 1 → 2 clipped, 1 → 3 correct.</Text>
        </Row>
        <Row tag="A · no extra props (uncontrolled) — like lab #1">
          <OnboardingTextField label="Job title (optional)" placeholder="e.g. Designer" />
        </Row>
        <Row tag="P · controlled value + onChangeText only">
          <OnboardingTextField label="Job title (optional)" placeholder="e.g. Designer" value={plain} onChangeText={setPlain} />
        </Row>
        <Row tag="J · exact Job title props">
          <OnboardingTextField
            label="Job title (optional)"
            placeholder="e.g. Designer"
            value={job}
            onChangeText={setJob}
            autoCapitalize="sentences"
            autoCorrect={false}
            textContentType="jobTitle"
            returnKeyType="done"
          />
        </Row>
        <Row tag="S · exact School (typeahead) props">
          <OnboardingTextField
            label="School"
            placeholder="Search or enter your school"
            value={school}
            onChangeText={setSchool}
            editable
            autoCapitalize="words"
            autoCorrect={false}
            autoComplete="off"
            textContentType="none"
            returnKeyType="search"
          />
        </Row>
      </OnboardingScreen>
    </>
  );
}

const styles = StyleSheet.create({
  row: { gap: 4 },
  tag: { fontSize: 11, fontWeight: '600', color: obColors.textSecondary },
  btns: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  btn: { borderWidth: 1, borderColor: obColors.border, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6 },
  ruler: { fontFamily: obFonts.heading, fontSize: 56, lineHeight: 68, height: 68, padding: 0, textAlign: 'center' },
  field: { fontFamily: obFonts.body, fontSize: 19, height: 44, padding: 0, borderBottomWidth: 1, borderBottomColor: obColors.border },
});
