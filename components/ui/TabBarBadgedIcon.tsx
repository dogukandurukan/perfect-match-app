import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useActivityBadge } from '@/hooks/useActivityBadge';
import { useTabBadgeCounts } from '@/hooks/useTabBadgeCounts';
import { v2Enabled } from '@/lib/supabaseClient';

function MessageCountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  const label = count > 9 ? '9+' : String(count);
  return (
    <View style={styles.messageBadge}>
      <ThemedText style={styles.badgeText}>{label}</ThemedText>
    </View>
  );
}

function NotificationDot({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return <View style={styles.notificationDot} />;
}

export function TabBarMessagesIcon({
  color,
  size = 24,
  focused = false,
}: {
  color: string;
  size?: number;
  focused?: boolean;
}) {
  const { messageCount } = useTabBadgeCounts();
  return (
    <View style={[styles.wrap, focused && styles.wrapActive]}>
      <Ionicons
        name={focused ? 'chatbubble' : 'chatbubble-outline'}
        size={size}
        color={color}
      />
      <MessageCountBadge count={messageCount} />
    </View>
  );
}

export function TabBarNotificationsIcon({
  color,
  size = 24,
  focused = false,
}: {
  color: string;
  size?: number;
  focused?: boolean;
}) {
  const { showNotificationDot } = useTabBadgeCounts();
  // V2: the number of pending likes not yet opened (0 → no badge). V1 keeps
  // its unread-notification dot.
  const unseenLikes = useActivityBadge(v2Enabled);
  return (
    <View style={[styles.wrap, focused && styles.wrapActive]}
      accessibilityLabel={v2Enabled && unseenLikes > 0 ? `${unseenLikes} new ${unseenLikes === 1 ? 'like' : 'likes'}` : undefined}>
      <Ionicons
        name={focused ? 'notifications' : 'notifications-outline'}
        size={size}
        color={color}
      />
      {v2Enabled ? <MessageCountBadge count={unseenLikes} /> : <NotificationDot visible={showNotificationDot} />}
    </View>
  );
}

export function TabBarMapIcon({ color, size = 24 }: { color: string; size?: number }) {
  return <Ionicons name="map-outline" size={size} color={color} />;
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Same nudge-up treatment as ActiveTabIcon (components/ui/ActiveTabIcon.tsx)
  // — kept separate here since this View also anchors the badge/dot overlay.
  wrapActive: {
    transform: [{ translateY: -2 }],
  },
  messageBadge: {
    position: 'absolute',
    top: -2,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#E53935',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  notificationDot: {
    position: 'absolute',
    top: 0,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },
});
