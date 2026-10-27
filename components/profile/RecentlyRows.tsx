// "Recently" (D106): up to two small lines under the name — a book and a
// song. Empty lines are not shown; with both empty nothing is shown (others)
// or an "Add" prompt (own profile, when `onEdit` is given). The song opens
// its link outside the app only when it passes the https / music-service
// check; otherwise the line is plain text, not tappable.
import { Ionicons } from '@expo/vector-icons';
import { Alert, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { obColors, obFonts, obSpacing } from '@/lib/onboardingV2/theme';
import { openableSongUrl, recentlyLine, type PublicRecently } from '@/lib/profile/recentlyCore';

async function openSong(url: string) {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('Couldn’t open the link', 'Try again later.');
  }
}

export function RecentlyRows({
  recently,
  onEdit,
  hint,
}: {
  recently: PublicRecently | null;
  /** Own profile only: pencil / add access. */
  onEdit?: () => void;
  /** Own profile only: a small note under the lines. */
  hint?: string;
}) {
  if (!recently && !onEdit) return null;
  const songUrl = openableSongUrl(recently?.song ?? null);
  return (
    <View style={styles.wrap}>
      <View style={styles.titleRow}>
        <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.5}>
          Recently
        </Text>
        {onEdit && recently ? (
          <TouchableOpacity onPress={onEdit} hitSlop={12} accessibilityRole="button" accessibilityLabel="Edit Recently" style={styles.pencil}>
            <Ionicons name="pencil-outline" size={18} color={obColors.textPrimary} />
          </TouchableOpacity>
        ) : null}
      </View>
      {recently?.book ? (
        <View style={styles.row} accessible accessibilityLabel={`Reading: ${recentlyLine(recently.book.title, recently.book.author)}`}>
          <Ionicons name="book-outline" size={17} color={obColors.textPrimary} importantForAccessibility="no" />
          <Text style={styles.text} numberOfLines={2} maxFontSizeMultiplier={1.6}>
            {recentlyLine(recently.book.title, recently.book.author)}
          </Text>
        </View>
      ) : null}
      {recently?.song ? (
        songUrl ? (
          <TouchableOpacity
            onPress={() => void openSong(songUrl)}
            accessibilityRole="link"
            accessibilityLabel={`Listening to: ${recentlyLine(recently.song.title, recently.song.artist)}`}
            accessibilityHint="Opens the song outside Tempa"
            style={styles.row}>
            <Ionicons name="musical-note-outline" size={17} color={obColors.textPrimary} importantForAccessibility="no" />
            <Text style={styles.text} numberOfLines={2} maxFontSizeMultiplier={1.6}>
              {recentlyLine(recently.song.title, recently.song.artist)}
            </Text>
            <Ionicons name="arrow-up-outline" size={15} color={obColors.textPrimary} style={styles.external} importantForAccessibility="no" />
          </TouchableOpacity>
        ) : (
          <View style={styles.row} accessible accessibilityLabel={`Listening to: ${recentlyLine(recently.song.title, recently.song.artist)}`}>
            <Ionicons name="musical-note-outline" size={17} color={obColors.textPrimary} importantForAccessibility="no" />
            <Text style={styles.text} numberOfLines={2} maxFontSizeMultiplier={1.6}>
              {recentlyLine(recently.song.title, recently.song.artist)}
            </Text>
          </View>
        )
      ) : null}
      {!recently && onEdit ? (
        <TouchableOpacity onPress={onEdit} accessibilityRole="button" accessibilityLabel="Add a book or a song" style={styles.addRow} hitSlop={6}>
          <Ionicons name="add-circle-outline" size={18} color={obColors.cta} importantForAccessibility="no" />
          <Text style={styles.add} maxFontSizeMultiplier={1.5}>
            Add a book or a song
          </Text>
        </TouchableOpacity>
      ) : null}
      {hint ? (
        <Text style={styles.hint} maxFontSizeMultiplier={1.6}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 24 },
  title: { fontFamily: obFonts.bodyMedium, fontSize: 14, lineHeight: 19, color: obColors.textSecondary },
  pencil: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: obSpacing.sm, minHeight: 28 },
  text: { flexShrink: 1, fontFamily: obFonts.body, fontSize: 15, lineHeight: 20, color: obColors.textPrimary },
  external: { transform: [{ rotate: '45deg' }] },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, alignSelf: 'flex-start' },
  add: { fontFamily: obFonts.bodySemiBold, fontSize: 15, lineHeight: 20, color: obColors.cta },
  hint: { fontFamily: obFonts.body, fontSize: 13, lineHeight: 18, color: obColors.textSecondary },
});
