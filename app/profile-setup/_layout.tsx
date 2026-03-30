import { Stack, Redirect, useGlobalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';

import { colors } from '@/lib/designTokens';
import { supabase } from '@/lib/supabaseClient';

type GateState = 'loading' | 'ok' | 'denied';

function isDemoParam(demo: string | string[] | undefined): boolean {
  if (demo === '1') return true;
  if (Array.isArray(demo) && demo[0] === '1') return true;
  return false;
}

/** Web: expo-router bazen child query string'i üst layout'a iletmez; URL'den de oku (WebDebugNav ?demo=1). */
function isDemoFromWindow(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  try {
    const q = window.location.search;
    if (q.includes('demo=1')) return true;
    const h = window.location.hash;
    if (h.includes('demo=1')) return true;
  } catch {
    /* ignore */
  }
  return false;
}

export default function ProfileSetupLayout() {
  const params = useGlobalSearchParams<{ demo?: string | string[] }>();

  const demoBypass = useMemo(
    () => isDemoParam(params.demo) || isDemoFromWindow(),
    [params.demo],
  );

  const [gate, setGate] = useState<GateState>('loading');

  useEffect(() => {
    if (demoBypass) {
      setGate('ok');
      return;
    }

    let cancelled = false;

    (async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      if (cancelled) return;

      if (error || !user) {
        setGate('denied');
        return;
      }

      if (user.is_anonymous) {
        setGate('ok');
        return;
      }

      if (user.email && !user.email_confirmed_at) {
        setGate('denied');
        return;
      }

      setGate('ok');
    })();

    return () => {
      cancelled = true;
    };
  }, [demoBypass]);

  if (gate === 'loading') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (gate === 'denied') {
    return <Redirect href="/(auth)/login?verify=1" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bgPrimary,
  },
});
