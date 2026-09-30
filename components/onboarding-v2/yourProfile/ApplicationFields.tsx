// Section 7.7 You're on the list! (P07 R1). LOCAL preview only: nothing is
// sent, there is no application record, no review timeframe, no acceptance,
// verification or membership. The former "Ready to submit?" checklist state
// was removed in P07 R1 (Submit now lives on the confirmed email-code screen).
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { DevNotice } from '@/components/onboarding-v2/yourProfile/ProfilePreview';
import { obColors, obFonts, obSpacing } from '@/lib/onboardingV2/theme';

const PIECES = 14;
// Small warm-gold accent used only for the celebration details.
const GOLD = '#B7894C';
const CONFETTI_COLORS = [obColors.cta, '#8FA894', '#CDBE9C', '#C9D6C4', GOLD];

/** One short, light burst (≈1.4 s, native driver) that plays once per mount.
 * Skipped entirely when the system "Reduce Motion" setting is on. */
function Confetti() {
  const [reduce, setReduce] = useState<boolean | null>(null);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((r) => alive && setReduce(r))
      .catch(() => alive && setReduce(true));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (reduce !== false) return;
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: 1400,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [reduce, progress]);

  if (reduce !== false) return null;
  return (
    <View pointerEvents="none" style={styles.confetti} importantForAccessibility="no-hide-descendants">
      {Array.from({ length: PIECES }).map((_, i) => {
        const angle = (i / PIECES) * Math.PI * 2;
        const dist = 70 + (i % 3) * 22;
        return (
          <Animated.View
            key={i}
            style={[
              styles.piece,
              {
                backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                opacity: progress.interpolate({ inputRange: [0, 0.15, 0.75, 1], outputRange: [0, 1, 1, 0] }),
                transform: [
                  { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(angle) * dist] }) },
                  {
                    translateY: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, Math.sin(angle) * dist * 0.6 + 40],
                    }),
                  },
                  {
                    rotate: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', `${(i % 2 ? 1 : -1) * 160}deg`],
                    }),
                  },
                ],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

/** `live`: shown after the server recorded the application — no preview notice. */
export function ReceivedFields({ live = false }: { live?: boolean } = {}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.celebrate}>
        <Confetti />
        {/* Decorative party popper (application RECEIVED, not approved). */}
        <View style={styles.badge} importantForAccessibility="no-hide-descendants">
          <MaterialCommunityIcons name="party-popper" size={38} color={obColors.cta} />
          <MaterialCommunityIcons name="star-four-points" size={13} color={GOLD} style={styles.sparkTop} />
          <MaterialCommunityIcons name="star-four-points" size={9} color={GOLD} style={styles.sparkLeft} />
        </View>
      </View>
      <View style={styles.copy}>
        <Text style={styles.lead} maxFontSizeMultiplier={1.6}>
          Thanks for joining Tempa.
        </Text>
        <Text style={styles.body} maxFontSizeMultiplier={1.6}>
          We&apos;ll email you after we review your profile.
        </Text>
      </View>
      <View style={styles.panel} accessible accessibilityLabel="Application received. Review pending.">
        <Text style={styles.panelTitle} maxFontSizeMultiplier={1.6}>
          Application received
        </Text>
        <Text style={styles.panelText} maxFontSizeMultiplier={1.6}>
          Review pending
        </Text>
      </View>
      {live ? null : <DevNotice text="Preview only — no application was submitted." />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: obSpacing.xl,
  },
  celebrate: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 96,
  },
  confetti: {
    position: 'absolute',
    top: 40,
    left: '50%',
    width: 0,
    height: 0,
  },
  piece: {
    position: 'absolute',
    width: 7,
    height: 11,
    borderRadius: 2,
  },
  badge: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 1.5,
    borderColor: obColors.cta,
    backgroundColor: obColors.selectedFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparkTop: {
    position: 'absolute',
    top: 12,
    right: 14,
  },
  sparkLeft: {
    position: 'absolute',
    bottom: 16,
    left: 14,
  },
  copy: {
    gap: obSpacing.xs,
  },
  lead: {
    fontFamily: obFonts.bodySemiBold,
    fontSize: 17,
    lineHeight: 23,
    color: obColors.textPrimary,
  },
  body: {
    fontFamily: obFonts.body,
    fontSize: 15,
    lineHeight: 21,
    color: obColors.textSecondary,
  },
  panel: {
    alignItems: 'center',
    gap: 2,
    backgroundColor: obColors.selectedFill,
    borderRadius: 12,
    padding: obSpacing.lg,
  },
  panelTitle: {
    fontFamily: obFonts.bodySemiBold,
    fontSize: 17,
    lineHeight: 22,
    color: obColors.cta,
  },
  panelText: {
    fontFamily: obFonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: obColors.textSecondary,
  },
});
