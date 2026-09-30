// V2 application status (live). The gate is read from the server
// (get_my_access_v2); a pending applicant stays here — no Home, no discovery
// (the server enforces that too). Accepted + verified + active → Home.
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ReceivedFields } from '@/components/onboarding-v2/yourProfile/ApplicationFields';
import { getAccessGate, type AccessGate } from '@/lib/onboardingV2/remote';
import { obColors, obFonts } from '@/lib/onboardingV2/theme';
import { supabase } from '@/lib/supabaseClient';

export default function V2Status() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [gate, setGate] = useState<AccessGate | null>(null);

  const check = useCallback(async () => {
    setGate(null);
    const g = await getAccessGate();
    if (g.gate === 'member' || g.gate === 'legacy_member') return router.replace('/');
    if (g.gate === 'onboarding') return router.replace('/v2/onboarding');
    if (g.gate === 'signed_out') return router.replace('/v2/welcome');
    setGate(g);
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      void check();
    }, [check]),
  );

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace('/');
  };

  if (!gate) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={obColors.cta} accessibilityLabel="Checking your application" />
      </View>
    );
  }
  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      {gate.gate === 'waiting' && gate.applicationStatus === 'submitted' ? (
        <ReceivedFields live />
      ) : gate.gate === 'waiting' && gate.applicationStatus === 'rejected' ? (
        <Text style={styles.text} maxFontSizeMultiplier={1.6}>
          Thanks for applying. We can't offer you a membership right now.
        </Text>
      ) : (
        <Text style={styles.text} accessibilityLiveRegion="polite" maxFontSizeMultiplier={1.6}>
          {gate.gate === 'error' ? gate.message : "We couldn't read your application status."}
        </Text>
      )}
      <TouchableOpacity onPress={() => void check()} accessibilityRole="button" hitSlop={10} style={styles.link}>
        <Text style={styles.linkText}>Refresh</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => void signOut()} accessibilityRole="button" hitSlop={10} style={styles.link}>
        <Text style={styles.linkText}>Sign out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: obColors.background },
  content: { paddingHorizontal: 24, gap: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: obColors.background },
  text: { fontFamily: obFonts.body, fontSize: 17, lineHeight: 24, color: obColors.textPrimary },
  link: { minHeight: 44, justifyContent: 'center', alignSelf: 'center' },
  linkText: { fontFamily: obFonts.bodySemiBold, fontSize: 16, color: obColors.cta, textDecorationLine: 'underline' },
});
