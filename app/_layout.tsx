// Screen: Root Stack layout | Status: stable | Last updated: Mayıs 2026
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { View } from 'react-native';

import { WebDebugNav } from '@/components/ui/WebDebugNav';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { applySessionFromUrl, subscribeAuthDeepLinks } from '@/lib/authDeepLinks';

function AuthDeepLinkBridge() {
  useEffect(() => {
    return subscribeAuthDeepLinks((url) => {
      void applySessionFromUrl(url);
    });
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
      <View style={{ flex: 1 }}>
        <WebDebugNav />
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)/register" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding/index" options={{ headerShown: false }} />
          <Stack.Screen name="profile-setup" options={{ headerShown: false }} />
          <Stack.Screen name="reset-password" options={{ headerShown: false }} />
          <Stack.Screen name="coming-soon" options={{ headerShown: false }} />
          <Stack.Screen name="match-results" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
      </View>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
