// DEV-ONLY, TEMPORARY (P05 R2 bisect #2). Input lab #1 showed every variant —
// including the real OnboardingTextField — renders correctly on the phone
// OUTSIDE the onboarding flow. This screen renders the SAME component INSIDE
// the real OnboardingScreen container (as the flow does) with different prop
// sets, to separate "container causes it" from "field props cause it".
// No backend, nothing saved. Redirects in production.
import { Redirect, Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { OnboardingPrimaryButton } from '@/components/onboarding-v2/OnboardingPrimaryButton';
import { OnboardingScreen } from '@/components/onboarding-v2/OnboardingScreen';
import { OnboardingTextField } from '@/components/onboarding-v2/OnboardingTextField';
import { obColors } from '@/lib/onboardingV2/theme';

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
});
