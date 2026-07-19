// Screen: Tab layout | Status: stable | Last updated: Mayıs 2026
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import {
  TabBarMessagesIcon,
  TabBarNotificationsIcon,
} from '@/components/ui/TabBarBadgedIcon';
import { TabHeaderActions } from '@/components/ui/TabHeaderActions';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const ACCENT = '#B8860B';

const headerOptions = {
  headerShown: true as const,
  headerTitle: '',
  headerShadowVisible: false,
  headerStyle: { backgroundColor: '#FFFFFF' },
  headerRight: () => <TabHeaderActions />,
};

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme ?? 'light'];

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: ACCENT,
        tabBarInactiveTintColor: palette.tabIconDefault,
        tabBarButton: HapticTab,
        ...headerOptions,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Ana Sayfa',
          href: '/(tabs)',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="vibe"
        options={{
          title: 'Vibe',
          headerTitle: '',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="color-wand-outline" size={size ?? 24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="matches"
        options={{
          title: 'Eşleşmeler',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="sparkles-outline" size={size ?? 24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          href: null,
          title: 'Harita',
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Bildirimler',
          headerTitle: 'Bildirimler',
          tabBarIcon: ({ color, size }) => (
            <TabBarNotificationsIcon color={color} size={size ?? 24} />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Mesajlar',
          headerTitle: 'Mesajlar',
          tabBarIcon: ({ color, size }) => <TabBarMessagesIcon color={color} size={size ?? 24} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
          title: 'Profil',
          headerTitle: 'Profil',
          headerTransparent: true,
          headerStyle: { backgroundColor: 'transparent' },
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
