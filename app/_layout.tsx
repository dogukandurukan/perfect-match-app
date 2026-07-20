// Screen: Root Stack layout | Status: stable | Last updated: Mayıs 2026
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { applySessionFromUrl, subscribeAuthDeepLinks } from '@/lib/authDeepLinks';
import { requestAndSaveLocation } from '@/lib/location';
import {
  registerForPushNotifications,
  savePushToken,
} from '@/lib/notifications';
import { supabase } from '@/lib/supabaseClient';
import * as Notifications from 'expo-notifications';

function AuthDeepLinkBridge() {
  useEffect(() => {
    return subscribeAuthDeepLinks((url) => {
      void applySessionFromUrl(url);
    });
  }, []);
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

function NotificationBridge() {
  useEffect(() => {
    const notificationListener = Notifications.addNotificationReceivedListener(() => {
      // handled by OS banner / in-app list
    });

    const responseListener = Notifications.addNotificationResponseReceivedListener(() => {
      // navigation handled elsewhere when needed
    });

    return () => {
      notificationListener.remove();
      responseListener.remove();
    };
  }, []);

  return null;
}

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthDeepLinkBridge />
      <LocationBridge />
      <NotificationBridge />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)/register" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding/index" options={{ headerShown: false }} />
        <Stack.Screen name="profile-setup" options={{ headerShown: false }} />
        <Stack.Screen name="reset-password" options={{ headerShown: false }} />
        <Stack.Screen name="coming-soon" options={{ headerShown: false }} />
        <Stack.Screen name="match-results" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
        <Stack.Screen name="change-password" options={{ headerShown: false }} />
        <Stack.Screen name="user-profile" options={{ headerShown: false }} />
        <Stack.Screen name="micro-intro" options={{ headerShown: false }} />
        <Stack.Screen name="chat" options={{ headerShown: false }} />
        <Stack.Screen name="vibe-detail" options={{ headerShown: true }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
