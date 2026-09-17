import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import type { HingeProfilePerson } from '@/lib/hingeProfile';
import { homeColors, homeRadius, homeShadow, homeSpacing } from '@/lib/homeTheme';

/**
 * favorite_music/movie/book — real, often rich free-text fields (present in
 * the DB, returned by the candidate query, present in HingeProfilePerson)
 * that simply had no renderer anywhere in Home's first redesign pass. The
 * shared (untouched) HingeProfileCard still shows these as plain icon+text
 * lines — same icon choices reused here for consistency (musical-notes/
 * film/book outline), just restyled to this screen's card language.
 * Deliberately not "why you match"/comparison copy — that's WhyYouMatchCard's
 * job; this is just "here's what they're into", one row per filled field,
 * nothing invented for fields that are empty.
 */
export function PersonalTastesCard({ person }: { person: HingeProfilePerson }) {
  const rows: { key: string; icon: 'musical-notes-outline' | 'film-outline' | 'book-outline'; text: string }[] = [];
  if (person.favorite_music?.trim())
    rows.push({ key: 'music', icon: 'musical-notes-outline', text: person.favorite_music.trim() });
  if (person.favorite_movie?.trim())
    rows.push({ key: 'movie', icon: 'film-outline', text: person.favorite_movie.trim() });
  if (person.favorite_book?.trim())
    rows.push({ key: 'book', icon: 'book-outline', text: person.favorite_book.trim() });

  if (rows.length === 0) return null;

  return (
    <View style={styles.card}>
      <ThemedText style={styles.heading}>Taste</ThemedText>
      {rows.map((row, i) => (
        <View key={row.key} style={[styles.row, i === rows.length - 1 && styles.rowLast]}>
          <Ionicons name={row.icon} size={16} color={homeColors.accent} />
          <ThemedText style={styles.text} numberOfLines={2}>
            {row.text}
          </ThemedText>
        </View>
      ))}
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
    marginBottom: homeSpacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: homeSpacing.sm,
    paddingVertical: homeSpacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: homeColors.border,
  },
  rowLast: { borderBottomWidth: 0 },
  text: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: homeColors.textPrimary,
  },
});
