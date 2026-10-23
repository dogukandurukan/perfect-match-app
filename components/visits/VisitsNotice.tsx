// The one-time profile-visits notice (D103): a small inline area under the
// screen header, one action ("Got it"). Closing it or going back records
// nothing; the next eligible profile open shows it again.
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { VisitNoticeState } from '@/hooks/useProfileVisit';
import { obColors, obFonts, obRadius, obSpacing } from '@/lib/onboardingV2/theme';
import { VISITS_NOTICE } from '@/lib/visits/visitsCore';

export function VisitsNotice({ state }: { state: VisitNoticeState }) {
  if (!state.visible) return null;
  return (
    <View style={styles.card} accessibilityLiveRegion="polite">
      <View style={styles.row}>
        <Ionicons name="eye-outline" size={18} color={obColors.textSecondary} style={styles.icon} />
        <Text style={styles.body} maxFontSizeMultiplier={1.6}>
          {VISITS_NOTICE.body}
        </Text>
        <TouchableOpacity
          onPress={state.dismiss}
          disabled={state.busy}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={VISITS_NOTICE.closeLabel}
          style={styles.close}>
          <Ionicons name="close" size={18} color={obColors.textSecondary} />
        </TouchableOpacity>
      </View>
      {state.error ? <Text style={styles.error}>{VISITS_NOTICE.saveError}</Text> : null}
      <TouchableOpacity
        onPress={state.gotIt}
        disabled={state.busy}
        accessibilityRole="button"
        accessibilityState={{ disabled: state.busy, busy: state.busy }}
        style={styles.cta}>
        {state.busy ? <ActivityIndicator color={obColors.onCta} /> : <Text style={styles.ctaText}>{VISITS_NOTICE.cta}</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: obSpacing.lg,
    marginBottom: obSpacing.sm,
    padding: obSpacing.md,
    gap: obSpacing.sm,
    borderRadius: obRadius.button,
    backgroundColor: obColors.notice,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: obSpacing.sm },
  icon: { marginTop: 1 },
  body: { flex: 1, fontFamily: obFonts.body, fontSize: 14, lineHeight: 19, color: obColors.textPrimary },
  close: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  error: { fontFamily: obFonts.bodyMedium, fontSize: 13, lineHeight: 18, color: obColors.error },
  cta: {
    alignSelf: 'flex-start',
    minHeight: 40,
    minWidth: 96,
    paddingHorizontal: obSpacing.lg,
    borderRadius: 10,
    backgroundColor: obColors.cta,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { fontFamily: obFonts.bodySemiBold, fontSize: 15, lineHeight: 20, color: obColors.onCta },
});
