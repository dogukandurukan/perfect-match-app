// Section 6 Your Dates — per-step content (P06). Presentational only; the
// draft lives in PreviewFlow. General first-date preferences — no venue
// search, no scheduling, nothing persisted.
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';

import { OnboardingOptionCard } from '@/components/onboarding-v2/OnboardingOptionCard';
import { OnboardingTextField } from '@/components/onboarding-v2/OnboardingTextField';
import { obColors, obFonts, obSpacing } from '@/lib/onboardingV2/theme';
import {
  DATE_TYPES,
  DAY_OPTIONS,
  DAYS_GROUP_TITLE,
  MAX_DATE_TYPES,
  SPOT_HELPER,
  SPOT_MAX_LENGTH,
  SPOT_PLACEHOLDER,
  SPOT_TITLE,
  SUMMARY_HELPER,
  TIME_GROUP_TITLE,
  TIME_OPTIONS,
  datesSummary,
  toggleDateType,
  type DateIcon,
  type DatesDraft,
} from '@/lib/onboardingV2/yourDates';

type Props = {
  draft: DatesDraft;
  update: (patch: Partial<DatesDraft>) => void;
};

const MAX_SCALE = 1.6; // matches maxFontSizeMultiplier on these labels
const GUTTERS = 48; // obSpacing.gutter × 2
const GRID_GAP = 10;
const CARD_PAD = 14;
const CHECK = 18;

// Widest labels at their font size, measured from the bundled DM Sans Medium
// advance widths (see P06_RESULT.md). Layout switches instead of shrinking or
// splitting words.
// On a 390 pt wide phone: two date columns up to ~1.33× text, time on one row
// up to ~1.27×; beyond that they stack.
const WIDEST_DATE_LABEL_AT_16PT = 100.4; // "A fun activity"
const WIDEST_TIME_LABEL_AT_16PT = 63.4; // "Daytime"

function DateGlyph({ icon }: { icon: DateIcon }) {
  if (icon.family === 'ion') {
    return <Ionicons name={icon.name as keyof typeof Ionicons.glyphMap} size={22} color={obColors.cta} />;
  }
  return (
    <MaterialCommunityIcons
      name={icon.name as keyof typeof MaterialCommunityIcons.glyphMap}
      size={22}
      color={obColors.cta}
    />
  );
}

/** Two columns while the widest label fits one line in a half-width card. */
function useTwoDateColumns(): boolean {
  const { width, fontScale } = useWindowDimensions();
  const textWidth = (width - GUTTERS - GRID_GAP) / 2 - CARD_PAD * 2;
  return textWidth >= WIDEST_DATE_LABEL_AT_16PT * Math.min(fontScale, MAX_SCALE) + 4;
}

/** Time options on one row only while every label fits its third. */
function useTimeOneRow(): boolean {
  const { width, fontScale } = useWindowDimensions();
  const slot = (width - GUTTERS - obSpacing.sm * 2) / 3 - obSpacing.md * 2;
  return slot >= WIDEST_TIME_LABEL_AT_16PT * Math.min(fontScale, MAX_SCALE) + 4;
}

// 1 — Your ideal first date? (required 1–2) + optional favorite spot
export function DateTypesFields({ draft, update }: Props) {
  const twoColumns = useTwoDateColumns();
  const full = draft.dateTypes.length >= MAX_DATE_TYPES;
  return (
    <View style={styles.wrap}>
      <View style={styles.stack}>
        <View style={styles.grid}>
          {DATE_TYPES.map((t) => {
            const selected = draft.dateTypes.includes(t.key);
            const blocked = full && !selected;
            return (
              <TouchableOpacity
                key={t.key}
                onPress={() => update({ dateTypes: toggleDateType(draft.dateTypes, t.key) })}
                disabled={blocked}
                activeOpacity={0.8}
                accessibilityRole="checkbox"
                accessibilityLabel={t.label}
                accessibilityState={{ checked: selected, disabled: blocked }}
                accessibilityHint={blocked ? 'Two already chosen. Deselect one to change.' : undefined}
                style={[
                  styles.card,
                  twoColumns ? styles.cardHalf : styles.cardFull,
                  selected && styles.cardSelected,
                  blocked && styles.cardBlocked,
                ]}>
                <View importantForAccessibility="no-hide-descendants">
                  <DateGlyph icon={t.icon} />
                </View>
                <Text style={styles.cardText} maxFontSizeMultiplier={MAX_SCALE}>
                  {t.label}
                </Text>
                {/* Absolutely positioned: selecting never moves the label. */}
                <View style={[styles.check, selected && styles.checkOn]}>
                  {selected ? <Ionicons name="checkmark" size={12} color={obColors.onCta} /> : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={styles.count} accessibilityLiveRegion="polite" maxFontSizeMultiplier={MAX_SCALE}>
          {draft.dateTypes.length} of {MAX_DATE_TYPES} selected
          {full ? ' — deselect one to change' : ''}
        </Text>
      </View>

      <View style={styles.spot}>
        <View style={styles.spotHeading}>
          <Text style={styles.groupTitle} accessibilityRole="header" maxFontSizeMultiplier={MAX_SCALE}>
            {SPOT_TITLE}
          </Text>
          <Text style={styles.helper} maxFontSizeMultiplier={MAX_SCALE}>
            {SPOT_HELPER}
          </Text>
        </View>
        <OnboardingTextField
          label="Favorite spot for a first date, optional"
          hideLabel
          placeholder={SPOT_PLACEHOLDER}
          value={draft.spotText}
          onChangeText={(spotText) => update({ spotText })}
          maxLength={SPOT_MAX_LENGTH}
          autoCapitalize="sentences"
          autoCorrect={false}
          returnKeyType="done"
          clearButtonMode="while-editing"
        />
      </View>
    </View>
  );
}

// 2 — When are you free? (days + time, both required, single choice each)
export function DaysTimeFields({ draft, update }: Props) {
  const oneRow = useTimeOneRow();
  const summary = datesSummary(draft);
  return (
    <View style={styles.wrap}>
      <View style={styles.stack}>
        <Text style={styles.groupTitle} accessibilityRole="header" maxFontSizeMultiplier={MAX_SCALE}>
          {DAYS_GROUP_TITLE}
        </Text>
        <View style={styles.options} accessibilityRole="radiogroup">
          {DAY_OPTIONS.map((o) => (
            <OnboardingOptionCard
              key={o.key}
              label={o.title}
              mode="single"
              selectedFill
              selected={draft.days === o.key}
              onPress={() => update({ days: o.key })}
            />
          ))}
        </View>
      </View>

      <View style={styles.stack}>
        <Text style={styles.groupTitle} accessibilityRole="header" maxFontSizeMultiplier={MAX_SCALE}>
          {TIME_GROUP_TITLE}
        </Text>
        <View style={oneRow ? styles.timeRow : styles.options} accessibilityRole="radiogroup">
          {TIME_OPTIONS.map((o) => {
            const selected = draft.time === o.key;
            return (
              <TouchableOpacity
                key={o.key}
                onPress={() => update({ time: o.key })}
                activeOpacity={0.8}
                accessibilityRole="radio"
                accessibilityLabel={o.title}
                accessibilityState={{ selected }}
                style={[styles.timeOption, oneRow && styles.timeOptionRow, selected && styles.cardSelected]}>
                <Text style={styles.timeText} maxFontSizeMultiplier={MAX_SCALE}>
                  {o.title}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {summary ? (
        <View style={styles.summary} accessibilityLiveRegion="polite">
          <Text style={styles.summaryText} maxFontSizeMultiplier={MAX_SCALE}>
            {summary}
          </Text>
          <Text style={styles.summaryHelper} maxFontSizeMultiplier={MAX_SCALE}>
            {SUMMARY_HELPER}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: obSpacing.xxl,
  },
  stack: {
    gap: obSpacing.md,
  },
  options: {
    gap: obSpacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: GRID_GAP,
  },
  card: {
    minHeight: 84,
    gap: obSpacing.sm,
    padding: CARD_PAD,
    borderWidth: 1,
    borderColor: obColors.border,
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  cardHalf: {
    width: '48.5%',
  },
  cardFull: {
    width: '100%',
  },
  cardSelected: {
    backgroundColor: obColors.selectedFill,
    borderColor: obColors.cta,
  },
  cardBlocked: {
    opacity: 0.45,
  },
  cardText: {
    fontFamily: obFonts.bodyMedium,
    fontSize: 16,
    lineHeight: 21,
    color: obColors.textPrimary,
  },
  check: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: CHECK,
    height: CHECK,
    borderRadius: CHECK / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: {
    backgroundColor: obColors.cta,
  },
  count: {
    fontFamily: obFonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: obColors.textSecondary,
  },
  spot: {
    gap: obSpacing.sm,
  },
  spotHeading: {
    gap: 2,
  },
  groupTitle: {
    fontFamily: obFonts.bodySemiBold,
    fontSize: 16,
    lineHeight: 22,
    color: obColors.textPrimary,
  },
  helper: {
    fontFamily: obFonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: obColors.textSecondary,
  },
  timeRow: {
    flexDirection: 'row',
    gap: obSpacing.sm,
  },
  timeOption: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: obSpacing.md,
    paddingVertical: obSpacing.md,
    borderWidth: 1,
    borderColor: obColors.border,
    borderRadius: 12,
  },
  timeOptionRow: {
    flex: 1,
  },
  timeText: {
    fontFamily: obFonts.bodyMedium,
    fontSize: 16,
    lineHeight: 21,
    color: obColors.textPrimary,
    textAlign: 'center',
  },
  summary: {
    backgroundColor: obColors.selectedFill,
    borderRadius: 12,
    padding: obSpacing.lg,
    gap: 2,
  },
  summaryText: {
    fontFamily: obFonts.bodySemiBold,
    fontSize: 17,
    lineHeight: 22,
    color: obColors.textPrimary,
  },
  summaryHelper: {
    fontFamily: obFonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: obColors.textSecondary,
  },
});
