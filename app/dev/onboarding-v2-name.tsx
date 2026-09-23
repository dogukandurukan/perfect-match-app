// DEV-ONLY preview for Tempa onboarding V2 — P01 name screen.
// Isolated from the active onboarding/auth flow: nothing reads or writes
// Supabase, no session is required or created, and Continue only shows a
// local demo response (no navigation into unbuilt screens, no persistence).
// In production builds (__DEV__ === false) this route redirects to "/".
//
// Open it (dev-client running via `npx expo start --dev-client`):
//   - Simulator: xcrun simctl openurl booted "datingapp://dev/onboarding-v2-name"
//   - Any onboarding screen: tap "V2" in the top-right dev jump-nav (DevStepNav)
// See docs/tempa/work-packages/P01_RESULT.md.
import { Redirect, Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { NameStep } from '@/components/onboarding-v2/NameStep';
import { obColors, obFonts, obSpacing } from '@/lib/onboardingV2/theme';

export default function OnboardingV2NamePreview() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [demoResponse, setDemoResponse] = useState<string | null>(null);

  if (!__DEV__) return <Redirect href="/" />;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <NameStep
        firstName={firstName}
        lastName={lastName}
        onChangeFirstName={(v) => {
          setFirstName(v);
          setDemoResponse(null);
        }}
        onChangeLastName={(v) => {
          setLastName(v);
          setDemoResponse(null);
        }}
        onBack={router.canGoBack() ? () => router.back() : undefined}
        onContinue={() =>
          setDemoResponse(
            `Preview only — "${firstName.trim()} ${lastName.trim()}" was not saved. The next Basics screen isn't built yet.`,
          )
        }
        footerNotice={
          demoResponse ? (
            <View style={styles.notice} accessibilityLiveRegion="polite">
              <Text style={styles.noticeText}>{demoResponse}</Text>
            </View>
          ) : null
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  notice: {
    backgroundColor: obColors.notice,
    borderRadius: 10,
    padding: obSpacing.md,
  },
  noticeText: {
    fontFamily: obFonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: obColors.textPrimary,
  },
});
