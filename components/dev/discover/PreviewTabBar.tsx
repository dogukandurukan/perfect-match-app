// DEV Discover preview: a picture of the real five-tab bar (same icons,
// labels and active colour as app/(tabs)/_layout.tsx). Not interactive on
// purpose — it must never look like it navigated somewhere.
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { obColors, obFonts } from '@/lib/onboardingV2/theme';

const TABS: { label: string; icon: keyof typeof Ionicons.glyphMap; activeIcon: keyof typeof Ionicons.glyphMap }[] = [
  { label: 'Discover', icon: 'compass-outline', activeIcon: 'compass' },
  { label: 'Matches', icon: 'heart-outline', activeIcon: 'heart' },
  { label: 'Activity', icon: 'notifications-outline', activeIcon: 'notifications' },
  { label: 'Chats', icon: 'chatbubble-outline', activeIcon: 'chatbubble' },
  { label: 'Profile', icon: 'person-outline', activeIcon: 'person' },
];

export function PreviewTabBar({ bottomInset, active = 'Discover' }: { bottomInset: number; active?: string }) {
  return (
    <View
      style={[styles.bar, { paddingBottom: Math.max(bottomInset, 8) }]}
      accessible
      accessibilityLabel="Tab bar picture, preview only, not interactive">
      {TABS.map((t) => {
        const isActive = t.label === active;
        const color = isActive ? obColors.cta : obColors.textSecondary;
        return (
          <View key={t.label} style={styles.tab} importantForAccessibility="no-hide-descendants">
            <Ionicons name={isActive ? t.activeIcon : t.icon} size={24} color={color} />
            <Text style={[styles.label, { color }, isActive && styles.labelActive]} maxFontSizeMultiplier={1.2}>
              {t.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    paddingTop: 8,
    backgroundColor: obColors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E4DCCB',
  },
  tab: { flex: 1, alignItems: 'center', gap: 2 },
  label: { fontFamily: obFonts.bodyMedium, fontSize: 11, lineHeight: 14 },
  labelActive: { fontFamily: obFonts.bodySemiBold },
});
