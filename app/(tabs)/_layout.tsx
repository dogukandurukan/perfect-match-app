// Screen: Tab layout | Status: stable | Last updated: Mayıs 2026
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { ActiveTabIcon } from '@/components/ui/ActiveTabIcon';
import { HapticTab } from '@/components/haptic-tab';
import {
  TabBarMessagesIcon,
  TabBarNotificationsIcon,
} from '@/components/ui/TabBarBadgedIcon';
import {
  ProfileHeaderActions,
  TabHeaderActions,
} from '@/components/ui/TabHeaderActions';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { homeColors } from '@/lib/homeTheme';

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
          // 2026-09-18: label-only rename (Matches redesign brief) — the
          // route file stays `index`/`/(tabs)`, only the user-visible label
          // changed. "Discover" better matches what this screen actually
          // does (browse/discovery feed) now that Matches owns the
          // post-match planning flow.
          title: 'Discover',
          href: '/(tabs)',
          tabBarIcon: ({ color, focused }) => (
            <ActiveTabIcon focused={focused}>
              <Ionicons name={focused ? 'compass' : 'compass-outline'} size={22} color={color} />
            </ActiveTabIcon>
          ),
          // Home builds its own in-body header (wordmark + filters + daily
          // like quota, "Warm Editorial" redesign 2026-09-16) — same
          // approach Activity already uses, needed here so the quota row
          // can sit fixed under the wordmark instead of inside react-
          // navigation's more constrained native header API.
          headerShown: false,
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
          // 2026-09-18: Matches moved to the "Warm Editorial" coral system
          // (matches redesign brief) — its own active tint overrides the
          // Navigator-wide black ACCENT below, matching the mockup's coral
          // heart/label when this tab is active. Every other tab keeps the
          // shared black active tint.
          tabBarActiveTintColor: homeColors.accent,
          // Matches now builds its own in-body header (wordmark + big
          // title + subtitle, MatchesHeader component) with its own
          // insets.top handling — same reasoning as Home's headerShown:
          // false. Keeping the shared native header (empty title + the
          // generic "go to Profile" shortcut from TabHeaderActions) would
          // both double-count the top safe area against MatchesHeader's
          // own padding and stack a redundant, mockup-mismatched bar above
          // it. The Profile shortcut this drops is still reachable via the
          // bottom tab bar itself (5th tab).
          headerShown: false,
          tabBarIcon: ({ color, size, focused }) => (
            <ActiveTabIcon focused={focused}>
              {/* 2026-09-17: was sparkles/sparkles-outline — Ionicons draws
                  that glyph with a visibly thinner stroke than the rest of
                  the bar's outline icons (house/person-outline/chatbubble-
                  outline/notifications-outline), reported as inconsistent
                  on a real device. heart-outline matches their stroke
                  weight and reads clearly as "Matches" in a dating app. */}
              <Ionicons name={focused ? 'heart' : 'heart-outline'} size={size ?? 24} color={color} />
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
          title: 'Activity',
          headerTitle: 'Activity',
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
          // Back in the bottom bar as a real 5th tab (2026-09-16, Home
          // redesign brief) — supersedes the 2026-09-06 header-avatar-only
          // decision above. The header avatar route (TabHeaderActions'
          // ProfileHeaderActions) still exists and still works, just isn't
          // the only way in anymore.
          title: 'Profile',
          headerTitle: 'Profile',
          tabBarIcon: ({ color, size, focused }) => (
            <ActiveTabIcon focused={focused}>
              <Ionicons name={focused ? 'person' : 'person-outline'} size={size ?? 24} color={color} />
            </ActiveTabIcon>
          ),
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
