import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { View } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { WebDebugNav } from '@/components/ui/WebDebugNav';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <View style={{ flex: 1 }}>
        <WebDebugNav />
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)/register" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding/index" options={{ headerShown: false }} />
          <Stack.Screen name="profile-setup/index" options={{ headerShown: false }} />
          <Stack.Screen name="profile-setup/step1" options={{ headerShown: false }} />
          <Stack.Screen name="profile-setup/step2" options={{ headerShown: false }} />
          <Stack.Screen name="profile-setup/step3" options={{ headerShown: false }} />
          <Stack.Screen name="profile-setup/step4" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
      </View>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
