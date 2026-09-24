// Height input (D48): large centred number + adjacent "cm", tap the number to
// type it, and a horizontally scrollable 1 cm ruler with a fixed centre marker
// below. Ruler, number and draft stay in sync.
//
// No default answer: before the user drags the ruler or types, the ruler only
// *shows* a neutral position and the value stays empty. The visible ruler
// window is a viewport, not a height rule — typing a value outside it
// re-centres the window around that value.
import { useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import {
  NEUTRAL_VISUAL_CM,
  TICK,
  cmForOffset,
  heightValue,
  offsetForCm,
  rangeFor,
  type Range,
} from '@/lib/onboardingV2/heightRuler';
import { obColors, obFonts, obSpacing } from '@/lib/onboardingV2/theme';

type Props = {
  /** Draft string (digits only, may be ''). */
  valueText: string;
  onChangeText: (v: string) => void;
};

export function HeightRuler({ valueText, onChangeText }: Props) {
  const value = heightValue(valueText);
  const [range, setRange] = useState<Range>(() => rangeFor(value));
  const [width, setWidth] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const userScrolling = useRef(false);
  const momentum = useRef(false);

  // Re-centre the viewport for typed values outside it.
  useEffect(() => {
    setRange((r) => rangeFor(value, r));
  }, [value]);

  // Keep the ruler on the typed value (never while the user is dragging it).
  useEffect(() => {
    if (!width || userScrolling.current) return;
    scrollRef.current?.scrollTo({ x: offsetForCm(value ?? NEUTRAL_VISUAL_CM, range), animated: false });
  }, [value, range, width]);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!userScrolling.current) return;
    const cm = cmForOffset(e.nativeEvent.contentOffset.x, range);
    if (cm !== value) onChangeText(String(cm));
  };

  const ticks: number[] = [];
  for (let cm = range.min; cm <= range.max; cm++) ticks.push(cm);
  const side = width / 2;

  const adjust = (delta: number) => {
    const next = Math.max(1, (value ?? NEUTRAL_VISUAL_CM) + delta);
    if (String(next).length <= 3) onChangeText(String(next));
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.valueRow}>
        <TextInput
          value={valueText}
          onChangeText={(v) => onChangeText(v.replace(/[^0-9]/g, ''))}
          placeholder="—"
          placeholderTextColor={obColors.textSecondary}
          keyboardType="number-pad"
          maxLength={3}
          keyboardAppearance="light"
          selectionColor={obColors.cta}
          accessibilityLabel="Height in centimetres"
          accessibilityHint="Type your height, or use the ruler below"
          maxFontSizeMultiplier={1.2}
          style={styles.value}
        />
        <Text style={styles.unit} maxFontSizeMultiplier={1.4}>
          cm
        </Text>
      </View>
      <Text style={styles.hint} maxFontSizeMultiplier={1.6}>
        Tap the number to type it, or slide the ruler.
      </Text>

      <View
        style={styles.ruler}
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Height ruler"
        accessibilityValue={{ text: value ? `${value} centimetres` : 'Not set' }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => adjust(e.nativeEvent.actionName === 'increment' ? 1 : -1)}>
        {width > 0 ? (
          <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={TICK}
            decelerationRate="fast"
            scrollEventThrottle={16}
            contentOffset={{ x: offsetForCm(value ?? NEUTRAL_VISUAL_CM, range), y: 0 }}
            // Centre of tick N sits under the fixed marker at offset (N - min) * TICK.
            contentContainerStyle={{ paddingHorizontal: side - TICK / 2 }}
            onScrollBeginDrag={() => {
              userScrolling.current = true;
              momentum.current = false;
            }}
            onScrollEndDrag={() => {
              // If no momentum follows, the gesture is over.
              setTimeout(() => {
                if (!momentum.current) userScrolling.current = false;
              }, 120);
            }}
            onMomentumScrollBegin={() => {
              momentum.current = true;
            }}
            onMomentumScrollEnd={() => {
              momentum.current = false;
              userScrolling.current = false;
            }}
            onScroll={handleScroll}>
            {ticks.map((cm) => {
              const major = cm % 10 === 0;
              const mid = !major && cm % 5 === 0;
              return (
                <View key={cm} style={styles.tickSlot}>
                  <View style={[styles.tick, major ? styles.tickMajor : mid ? styles.tickMid : null]} />
                  {major ? (
                    <Text style={styles.tickLabel} numberOfLines={1} maxFontSizeMultiplier={1.2}>
                      {cm}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </ScrollView>
        ) : null}
        <View pointerEvents="none" style={[styles.marker, { left: side - 1 }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: obSpacing.md,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: obSpacing.sm,
  },
  value: {
    fontFamily: obFonts.heading,
    fontSize: 56,
    lineHeight: 68,
    minWidth: 96,
    textAlign: 'center',
    color: obColors.textPrimary,
    padding: 0,
  },
  unit: {
    fontFamily: obFonts.body,
    fontSize: 22,
    lineHeight: 28,
    color: obColors.textSecondary,
  },
  hint: {
    fontFamily: obFonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: obColors.textSecondary,
    textAlign: 'center',
  },
  ruler: {
    height: 84,
    marginTop: obSpacing.sm,
    justifyContent: 'center',
  },
  tickSlot: {
    width: TICK,
    alignItems: 'center',
    height: 64,
  },
  tick: {
    width: 1,
    height: 14,
    backgroundColor: obColors.border,
  },
  tickMid: {
    height: 22,
  },
  tickMajor: {
    height: 32,
    backgroundColor: obColors.textSecondary,
  },
  tickLabel: {
    position: 'absolute',
    top: 38,
    left: (TICK - 40) / 2,
    width: 40,
    textAlign: 'center',
    fontFamily: obFonts.body,
    fontSize: 12,
    lineHeight: 16,
    color: obColors.textSecondary,
  },
  marker: {
    position: 'absolute',
    top: 4,
    width: 2,
    height: 40,
    borderRadius: 1,
    backgroundColor: obColors.cta,
  },
});
