import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import {
  buildAboutMeChips,
  buildAvailabilityChip,
  buildInterestChips,
  buildLanguageChips,
  type HingeProfilePerson,
} from '@/lib/hingeProfile';
import { homeColors, homeRadius, homeShadow, homeSpacing } from '@/lib/homeTheme';

const MAX_CHIPS = 6;

/**
 * "About {name}" — a curated handful of facts, not every profile field.
 * Reuses the same chip-builders HingeProfileCard uses elsewhere (About-me +
 * one interest + languages + availability), just capped and re-styled for
 * Home's card language. Icons only, no emoji (interest chips normally carry
 * one — dropped here per the brief).
 */
export function ProfileFacts({
  name,
  person,
}: {
  name: string;
  person: HingeProfilePerson;
}) {
  const chips = [
    ...buildAboutMeChips(person),
    ...buildInterestChips(person).slice(0, 2),
    ...buildLanguageChips(person.languages),
    ...(buildAvailabilityChip(person.availability_days)
      ? [buildAvailabilityChip(person.availability_days)!]
      : []),
  ].slice(0, MAX_CHIPS);

  if (chips.length === 0) return null;

  return (
    <View style={styles.card}>
      <ThemedText style={styles.heading}>About {name}</ThemedText>
      <View style={styles.grid}>
        {chips.map((chip) => (
          <View key={chip.key} style={styles.chip}>
            <Ionicons name={chip.icon} size={14} color={homeColors.textSecondary} />
            <ThemedText style={styles.chipText}>{chip.label}</ThemedText>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: homeSpacing.lg,
    marginTop: homeSpacing.lg,
    padding: homeSpacing.lg,
    borderRadius: homeRadius.card,
    backgroundColor: homeColors.surface,
    borderWidth: 1,
    borderColor: homeColors.border,
    ...homeShadow,
  },
  heading: {
    fontSize: 17,
    fontWeight: '800',
    color: homeColors.textPrimary,
    marginBottom: homeSpacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: homeSpacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: homeSpacing.md,
    paddingVertical: homeSpacing.sm,
    borderRadius: homeRadius.pill,
    backgroundColor: homeColors.mutedSurface,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: homeColors.textPrimary,
  },
});
