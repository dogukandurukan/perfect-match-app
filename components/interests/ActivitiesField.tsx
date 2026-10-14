// Activities chips (D89): the 12 fixed activities, optional, max 5. Shared by
// onboarding ("What are you into?") and Profile → Your interests.
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { ACTIVITIES, MAX_ACTIVITIES, toggleActivity } from '@/lib/interests/takes';
import { obColors, obFonts, obSpacing } from '@/lib/onboardingV2/theme';

export function ActivitiesField({ value, onChange, title = 'Activities' }: { value: string[]; onChange: (next: string[]) => void; title?: string }) {
  return (
    <View style={styles.block}>
      <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.6}>{`${title} · ${value.length} of ${MAX_ACTIVITIES}`}</Text>
      <View style={styles.chips}>
        {ACTIVITIES.map((a) => {
          const on = value.includes(a.key);
          const blocked = !on && value.length >= MAX_ACTIVITIES;
          return (
            <TouchableOpacity
              key={a.key}
              onPress={() => onChange(toggleActivity(value, a.key))}
              disabled={blocked}
              style={[styles.chip, on && styles.chipOn, blocked && { opacity: 0.45 }]}
              accessibilityRole="checkbox"
              accessibilityLabel={a.label}
              accessibilityState={{ checked: on, disabled: blocked }}>
              <Ionicons name={a.icon as keyof typeof Ionicons.glyphMap} size={16} color={obColors.cta} importantForAccessibility="no" />
              <Text style={styles.chipText} maxFontSizeMultiplier={1.6}>{a.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: obSpacing.sm, marginTop: obSpacing.sm },
  title: { fontFamily: obFonts.bodySemiBold, fontSize: 15, lineHeight: 20, color: obColors.textPrimary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: obSpacing.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: obSpacing.md, borderRadius: 999, borderWidth: 1, borderColor: obColors.border, backgroundColor: '#FFFDF8' },
  chipOn: { backgroundColor: obColors.selectedFill, borderColor: obColors.cta },
  chipText: { fontFamily: obFonts.bodyMedium, fontSize: 14, lineHeight: 19, color: obColors.textPrimary },
});
