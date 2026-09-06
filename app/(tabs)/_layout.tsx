// Screen: Tab layout | Status: stable | Last updated: Mayıs 2026
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { ActiveTabIcon } from '@/components/ui/ActiveTabIcon';
import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import {
  TabBarMessagesIcon,
  TabBarNotificationsIcon,
} from '@/components/ui/TabBarBadgedIcon';
import { ProfileHeaderActions, TabHeaderActions } from '@/components/ui/TabHeaderActions';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const ACCENT = '#1A1A1A';

const headerOptions = {
  headerShown: true as const,
  headerTitle: '',
  headerShadowVisible: false,
  headerStyle: { backgroundColor: '#FFFFFF' },
  headerRight: () => <TabHeaderActions />,
};

// Bumble bolds the active tab's label too, not just the icon (2026-09-03,
// user reference screenshot).
function TabLabel({ focused, color, children }: { focused: boolean; color: string; children: string }) {
  return <Text style={[styles.label, { color }, focused && styles.labelActive]}>{children}</Text>;
}

const styles = StyleSheet.create({
  label: {
    fontSize: 10,
    fontWeight: '500',
  },
  labelActive: {
    fontWeight: '700',
    transform: [{ translateY: -2 }],
  },
});

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme ?? 'light'];

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: ACCENT,
        tabBarInactiveTintColor: palette.tabIconDefault,
        tabBarButton: HapticTab,
        tabBarLabel: ({ focused, color, children }) => (
          <TabLabel focused={focused} color={color}>
            {children}
          </TabLabel>
        ),
        ...headerOptions,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          href: '/(tabs)',
          tabBarIcon: ({ color, focused }) => (
            <ActiveTabIcon focused={focused}>
              <IconSymbol size={22} name={focused ? 'house.fill' : 'house'} color={color} />
            </ActiveTabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="vibe"
        options={{
          href: null,
          title: 'Vibe',
          headerTitle: '',
          tabBarIcon: ({ color, size, focused }) => (
            <ActiveTabIcon focused={focused}>
              <Ionicons
                name={focused ? 'color-wand' : 'color-wand-outline'}
                size={size ?? 24}
                color={color}
              />
            </ActiveTabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="matches"
        options={{
          title: 'Matches',
          tabBarIcon: ({ color, size, focused }) => (
            <ActiveTabIcon focused={focused}>
              <Ionicons
                name={focused ? 'sparkles' : 'sparkles-outline'}
                size={size ?? 24}
                color={color}
              />
            </ActiveTabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          href: null,
          title: 'Map',
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Buzz',
          headerTitle: 'Buzz',
          tabBarIcon: ({ color, size, focused }) => (
            <TabBarNotificationsIcon color={color} size={size ?? 24} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Chats',
          headerTitle: 'Chats',
          tabBarIcon: ({ color, size, focused }) => (
            <TabBarMessagesIcon color={color} size={size ?? 24} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          // Reached via the header avatar icon (TabHeaderActions) now, not
          // the bottom bar — Profile isn't a check-repeatedly feed like
          // Matches/Buzz/Chats, so it doesn't need equal billing there
          // (user request, 2026-09-06; matches Hinge/Tinder's own pattern
          // of a header-icon profile instead of a 5th bottom tab).
          href: null,
          title: 'Profile',
          headerTitle: 'Profile',
          headerRight: () => <ProfileHeaderActions />,
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
