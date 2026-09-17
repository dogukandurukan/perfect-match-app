import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import {
  buildAboutMeChips,
  buildAvailabilityChip,
  buildInterestChips,
  buildLanguageChips,
  buildLookingForChips,
  type HingeProfilePerson,
  type ProfileChip,
} from '@/lib/hingeProfile';
import { homeColors, homeRadius, homeShadow, homeSpacing } from '@/lib/homeTheme';

type IconName = ComponentProps<typeof Ionicons>['name'];

// 2026-09-17 real-device finding: drinking='Socially' and smoking='Socially'
// are two independent, legitimate DB values (verified against real seed
// data) — not a field mix-up. The shared `buildAboutMeChips` (unchanged,
// still used by Matches/Profile/user-profile) strips the emoji that used to
// be the only thing telling the two chips apart, and gives smoking a
// cloud-outline icon that doesn't read as "smoking" at all — so two chips
// both just said "Socially". Fixed locally (not in the shared file, to keep
// this redesign scoped to Home): pulled drink/smoke out of the shared
// chip list and rebuilt them here with category-prefixed labels ("Drinks
// socially" / "Smokes socially") that can never collide, regardless of
// which enum value matches, plus a smoking icon that actually reads as
// smoking-related (Ionicons has no literal cigarette glyph).
function aboutMeChips(person: HingeProfilePerson): ProfileChip[] {
  const chips = buildAboutMeChips(person).filter((c) => c.key !== 'drink' && c.key !== 'smoke');

  const drinking = person.drinking?.trim();
  if (drinking) {
    const label =
      drinking === 'Yes' ? 'Drinks' : drinking === 'No' ? "Doesn't drink" : `Drinks ${drinking.toLowerCase()}`;
    chips.push({ key: 'drink', icon: 'wine-outline', label });
  }
  const smoking = person.smoking?.trim();
  if (smoking) {
    const smokeIcon: IconName = smoking === 'No' ? 'close-circle-outline' : 'flame-outline';
    const label =
      smoking === 'Yes' ? 'Smokes' : smoking === 'No' ? "Doesn't smoke" : `Smokes ${smoking.toLowerCase()}`;
    chips.push({ key: 'smoke', icon: smokeIcon, label });
  }

  return chips;
}

function ChipGrid({ chips }: { chips: ProfileChip[] }) {
  return (
    <View style={styles.grid}>
      {chips.map((chip) => (
        <View key={chip.key} style={styles.chip}>
          <Ionicons name={chip.icon} size={14} color={homeColors.textSecondary} />
          <ThemedText style={styles.chipText}>{chip.label}</ThemedText>
        </View>
      ))}
    </View>
  );
}

function ChipCard({ title, chips }: { title: string; chips: ProfileChip[] }) {
  if (chips.length === 0) return null;
  return (
    <View style={styles.card}>
      <ThemedText style={styles.heading}>{title}</ThemedText>
      <ChipGrid chips={chips} />
    </View>
  );
}

/**
 * "About {name}" — lifestyle facts (gender/zodiac/education/morning-night/
 * drinking/smoking/pets). No cap — 2026-09-17 finding: the previous
 * combined-and-capped version silently dropped hobbies/languages/
 * availability whenever About's own chips alone already filled the shared
 * limit, which was every real profile with more than a couple of fields
 * filled in. Each category now gets its own card and shows everything it
 * has.
 */
export function ProfileFacts({ name, person }: { name: string; person: HingeProfilePerson }) {
  return <ChipCard title={`About ${name}`} chips={aboutMeChips(person)} />;
}

// "I'm looking for" (intent/core_value/impressed_by) existed in the shared
// HingeProfileCard via buildLookingForChips but was dropped entirely from
// Home's first redesign pass — never wired into any component. Restored.
/** "I'm looking for" — restored (was in the shared HingeProfileCard, dropped from Home's first redesign pass). */
export function LookingForCard({ person }: { person: HingeProfilePerson }) {
  return <ChipCard title="Looking for" chips={buildLookingForChips(person)} />;
}

/** "Interests" — hobbies/favorite activity/vibe, full list (was silently capped to 2 and often crowded out entirely). */
export function InterestsCard({ person }: { person: HingeProfilePerson }) {
  return <ChipCard title="Interests" chips={buildInterestChips(person)} />;
}

/** "Languages" — restored as its own small section, same reasoning as InterestsCard. */
export function LanguagesCard({ person }: { person: HingeProfilePerson }) {
  const chips = [
    ...buildLanguageChips(person.languages),
    ...(buildAvailabilityChip(person.availability_days)
      ? [buildAvailabilityChip(person.availability_days)!]
      : []),
  ];
  return <ChipCard title="Languages & availability" chips={chips} />;
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
