// DEV Discover preview: a picture of the real five-tab bar (same icons,
// labels and active colour as app/(tabs)/_layout.tsx). Not interactive on
// purpose — it must never look like it navigated somewhere.
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { obColors, obFonts } from '@/lib/onboardingV2/theme';

const TABS: { label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { label: 'Discover', icon: 'compass' },
  { label: 'Matches', icon: 'heart-outline' },
  { label: 'Activity', icon: 'notifications-outline' },
  { label: 'Chats', icon: 'chatbubble-outline' },
  { label: 'Profile', icon: 'person-outline' },
];

export function PreviewTabBar({ bottomInset }: { bottomInset: number }) {
  return (
    <View
      style={[styles.bar, { paddingBottom: Math.max(bottomInset, 8) }]}
      accessible
      accessibilityLabel="Tab bar picture, preview only, not interactive">
      {TABS.map((t, i) => {
        const active = i === 0;
        const color = active ? obColors.cta : obColors.textSecondary;
        return (
          <View key={t.label} style={styles.tab} importantForAccessibility="no-hide-descendants">
            <Ionicons name={t.icon} size={24} color={color} />
            <Text style={[styles.label, { color }, active && styles.labelActive]} maxFontSizeMultiplier={1.2}>
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
