import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { colors } from '@/lib/designTokens';
import { supabase } from '@/lib/supabaseClient';

const STEPS = [
  { label: '1', path: '/profile-setup/step1' },
  { label: '2', path: '/profile-setup/step2' },
  { label: '3', path: '/profile-setup/step3' },
  { label: '4', path: '/profile-setup/step4' },
] as const;

type DevStepNavProps = {
  /** Which macro onboarding step (1-4) the current screen belongs to. */
  current: number;
};

// TEMPORARY dev-only jump nav (2026-09-03, user request) — lets you skip
// directly to step1/2/3/4 while testing the onboarding restructure, instead
// of always landing on whatever profiles.current_step says. __DEV__-gated
// so it never renders in a production build. Remove once onboarding is
// stable and no longer being actively tested.
export function DevStepNav({ current }: DevStepNavProps) {
  const router = useRouter();
  if (!__DEV__) return null;

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace('/(auth)/login' as never);
  };

  return (
    <View style={styles.row} pointerEvents="box-none">
      {STEPS.map((s, i) => (
        <TouchableOpacity
          key={s.path}
          onPress={() => router.push(s.path as never)}
          hitSlop={6}
          style={styles.item}>
          <ThemedText style={[styles.text, current === i + 1 && styles.textActive]}>
            {s.label}
          </ThemedText>
        </TouchableOpacity>
      ))}
      <TouchableOpacity onPress={() => void signOut()} hitSlop={6} style={styles.item}>
        <ThemedText style={styles.signOutText}>⎋</ThemedText>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    position: 'absolute',
    top: 0,
    right: 0,
    flexDirection: 'row',
    gap: 10,
    zIndex: 50,
  },
  item: {
    paddingHorizontal: 2,
  },
  text: {
    fontSize: 13,
    fontWeight: '700',
    color: '#CCCCCC',
  },
  textActive: {
    color: colors.accent,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#CC4444',
  },
});
