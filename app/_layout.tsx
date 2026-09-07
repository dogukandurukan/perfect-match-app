// Screen: Root Stack layout | Status: stable | Last updated: Mayıs 2026
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { applySessionFromUrl, subscribeAuthDeepLinks } from '@/lib/authDeepLinks';
import { requestAndSaveLocation } from '@/lib/location';
import {
  registerForPushNotifications,
  savePushToken,
} from '@/lib/notifications';
import { supabase } from '@/lib/supabaseClient';
import * as Notifications from 'expo-notifications';

// Supabase's autoRefreshToken timer relies on the JS event loop, which RN
// suspends while the app is backgrounded — without this, a session that's
// been backgrounded past its ~1h token expiry comes back stale, and the
// first authenticated write (e.g. a Storage upload) fails RLS with "new row
// violates row-level security policy" even though the user never signed
// out (found via device testing, 2026-09-03; this is Supabase's documented
// RN requirement, not something specific to this app's code).
function AuthRefreshBridge() {
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        supabase.auth.startAutoRefresh();
      } else {
        supabase.auth.stopAutoRefresh();
      }
    });
    if (AppState.currentState === 'active') {
      supabase.auth.startAutoRefresh();
    }
    return () => sub.remove();
  }, []);
  return null;
}

function AuthDeepLinkBridge() {
  const router = useRouter();
  useEffect(() => {
    return subscribeAuthDeepLinks((url) => {
      void applySessionFromUrl(url).then((type) => {
        // Password-reset email link — the session is now a recovery session,
        // route straight to setting a new password instead of dropping the
        // user on whatever screen the app happened to open to.
        if (type === 'recovery') {
          router.push('/change-password' as never);
        }
      });
    });
  }, [router]);
  return null;
}

function LocationBridge() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) return;
    void requestAndSaveLocation(userId);
    void (async () => {
      const token = await registerForPushNotifications();
      if (token) await savePushToken(userId, token);
    })();
  }, [userId]);

  return null;
}

function handleNotificationResponse(
  response: Notifications.NotificationResponse,
  router: ReturnType<typeof useRouter>,
) {
  const data = response.notification.request.content.data as
    | { type?: string; matchId?: string; matchName?: string; isUserA?: string }
    | undefined;
  if (data?.type === 'meetup_reminder' && data.matchId) {
    router.push({
      pathname: '/checkin',
      params: {
        matchId: data.matchId,
        matchName: data.matchName ?? '',
        isUserA: data.isUserA ?? '0',
      },
    } as never);
  }
}

function NotificationBridge() {
  const router = useRouter();

  useEffect(() => {
    const notificationListener = Notifications.addNotificationReceivedListener(() => {
      // handled by OS banner / in-app list
    });

    // Tapping a "meetup_reminder" push (send-meetup-reminders Edge Function)
    // deep-links straight into the existing checkin.tsx "did you go?" flow —
    // reuses that screen rather than building a new yes/no UI (2026-08-27).
    // This listener only fires while JS is already running (warm/backgrounded
    // app) — a tap that cold-starts the app fires the response BEFORE this
    // listener is subscribed, so it's silently missed and you land on Home.
    // getLastNotificationResponseAsync() below covers that cold-start case.
    const responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
      handleNotificationResponse(response, router);
    });

    // getLastNotificationResponseAsync() keeps returning the same response
    // on every subsequent app open until cleared — clear it right after
    // handling so re-opening the app later doesn't repeat the navigation.
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        handleNotificationResponse(response, router);
        void Notifications.clearLastNotificationResponseAsync();
      }
    });

    return () => {
      notificationListener.remove();
      responseListener.remove();
    };
  }, [router]);

  return null;
}

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  // App has no real dark-mode design — every screen hardcodes a light
  // palette (colors.bgPrimary etc. in lib/designTokens.ts). Following the
  // system scheme here only re-themed the navigation chrome (tab bar,
  // headers) to dark, producing a half-black-half-white UI whenever the
  // device auto-switches to Dark Mode at night (found 2026-09-03, ~23:49 —
  // the tab bar and its labels went black while every screen stayed white).
  // Pin to light until the app actually gets a dark-mode design.
  return (
    // Required by react-native-gesture-handler for reliable gesture
    // recognition (Home's new swipe-to-like/pass card, 2026-09-08) —
    // wasn't set up before; RNGH was only ever used transitively via
    // react-navigation's own swipe-back, which didn't need this wrapper.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={DefaultTheme}>
        <AuthRefreshBridge />
        <AuthDeepLinkBridge />
        <LocationBridge />
        <NotificationBridge />
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)/register" options={{ headerShown: false }} />
          <Stack.Screen name="profile-setup" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)/forgot-password" options={{ headerShown: false }} />
          <Stack.Screen name="coming-soon" options={{ headerShown: false }} />
          <Stack.Screen name="match-results" options={{ headerShown: false }} />
          <Stack.Screen name="settings" options={{ headerShown: false }} />
          <Stack.Screen name="filters" options={{ headerShown: false }} />
          <Stack.Screen name="blocked-users" options={{ headerShown: false }} />
          <Stack.Screen name="premium" options={{ headerShown: false }} />
          <Stack.Screen name="change-password" options={{ headerShown: false }} />
          <Stack.Screen name="user-profile" options={{ headerShown: false }} />
          <Stack.Screen name="micro-intro" options={{ headerShown: false }} />
          <Stack.Screen name="chat" options={{ headerShown: false }} />
          <Stack.Screen name="vibe-detail" options={{ headerShown: true }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
