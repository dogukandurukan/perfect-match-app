// Section 7.3 Your profile (P07, R1): the public profile assembled from every
// section's in-memory draft (buildProfilePreview) as one scrolling page. Never
// shows surname, exact DOB, email, phone or the private selfie. No note/send
// controls here: contextual notes belong to the future visitor profile (D45).
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { obColors, obFonts, obSpacing } from '@/lib/onboardingV2/theme';
import type { PreviewBlock } from '@/lib/onboardingV2/yourProfile';
import type { TasteItem } from '@/lib/onboardingV2/yourWorld';

export function DevNotice({ text }: { text: string }) {
  return (
    <View style={styles.dev} accessibilityRole="text">
      <Ionicons name="construct-outline" size={16} color={obColors.textSecondary} importantForAccessibility="no" />
      <Text style={styles.devText} maxFontSizeMultiplier={1.6}>
        {text}
      </Text>
    </View>
  );
}

const TASTE_ICON = { artist: 'musical-notes-outline', book: 'book-outline', screen: 'film-outline' } as const;

/** Artist photos aren't provided by the current catalog (MusicBrainz); books
 * may carry an Open Library cover. Otherwise a neutral placeholder — never an
 * invented image. */
function TasteThumb({ kind, item }: { kind: 'artist' | 'book' | 'screen'; item: TasteItem }) {
  const round = kind === 'artist';
  if (item.imageUrl) {
    return (
      <Image
        source={{ uri: item.imageUrl }}
        style={[styles.thumb, round ? styles.thumbRound : styles.thumbTall]}
        contentFit="cover"
        accessible={false}
      />
    );
  }
  return (
    <View style={[styles.thumb, round ? styles.thumbRound : styles.thumbTall, styles.thumbEmpty]}>
      {round ? (
        <Text style={styles.thumbInitial} maxFontSizeMultiplier={1.2}>
          {item.title.trim().charAt(0).toUpperCase()}
        </Text>
      ) : (
        <Ionicons name={TASTE_ICON[kind]} size={20} color={obColors.cta} importantForAccessibility="no" />
      )}
    </View>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <Text style={styles.sectionTitle} accessibilityRole="header" maxFontSizeMultiplier={1.6}>
      {children}
    </Text>
  );
}

export function ProfilePreview({ blocks }: { blocks: PreviewBlock[] }) {
  return (
    <View style={styles.wrap}>
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'header':
            return (
              <Text key={i} style={styles.name} accessibilityRole="header" maxFontSizeMultiplier={1.4}>
                {b.name || 'Your first name'}
                {b.age !== null ? <Text style={styles.age}>, {b.age}</Text> : null}
              </Text>
            );
          case 'photo':
            return (
              <View key={i} style={styles.card}>
                <Image source={{ uri: b.photo.uri }} style={styles.photo} contentFit="cover" accessibilityLabel="Profile photo" />
              </View>
            );
          case 'facts':
            return (
              <View key={i} style={[styles.card, styles.pad]}>
                {b.title ? <SectionTitle>{b.title}</SectionTitle> : null}
                {b.facts.map((f) => (
                  <View key={f.text} style={styles.fact}>
                    <Ionicons
                      name={f.icon as keyof typeof Ionicons.glyphMap}
                      size={17}
                      color={obColors.cta}
                      importantForAccessibility="no"
                    />
                    <Text style={styles.factText} maxFontSizeMultiplier={1.6}>
                      {f.text}
                    </Text>
                  </View>
                ))}
              </View>
            );
          case 'chips':
            return (
              <View key={i} style={[styles.card, styles.pad, styles.chipCard]}>
                {b.groups.map((g) => (
                  <View key={g.title} style={styles.group}>
                    <SectionTitle>{g.title}</SectionTitle>
                    <View style={styles.chips}>
                      {g.chips.map((t) => (
                        <View key={t} style={styles.chip}>
                          <Text style={styles.chipText} maxFontSizeMultiplier={1.6}>
                            {t}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            );
          case 'prompt':
            return (
              <View key={i} style={[styles.card, styles.pad]}>
                <Text style={styles.promptLabel} maxFontSizeMultiplier={1.6}>
                  {b.label}
                </Text>
                <Text style={styles.promptAnswer} maxFontSizeMultiplier={1.6}>
                  {b.answer}
                </Text>
              </View>
            );
          case 'taste':
            return (
              <View key={i} style={[styles.card, styles.pad, styles.chipCard]}>
                {b.groups.map((g) => (
                  <View key={g.label} style={styles.group}>
                    <SectionTitle>{g.label}</SectionTitle>
                    {g.items.map((it) => (
                      <View key={it.id} style={styles.tasteRow}>
                        <TasteThumb kind={g.kind} item={it} />
                        <View style={styles.tasteText}>
                          <Text style={styles.factText} maxFontSizeMultiplier={1.6}>
                            {it.title}
                          </Text>
                          {it.subtitle ? (
                            <Text style={styles.tasteSub} maxFontSizeMultiplier={1.6}>
                              {it.subtitle}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            );
          default:
            return null;
        }
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: obSpacing.md,
  },
  name: {
    fontFamily: obFonts.heading,
    fontSize: 30,
    lineHeight: 38,
    color: obColors.textPrimary,
  },
  age: {
    fontFamily: obFonts.body,
    color: obColors.textPrimary,
  },
  card: {
    backgroundColor: '#FFFDF8',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E4DCCB',
    overflow: 'hidden',
  },
  pad: {
    padding: obSpacing.lg,
    gap: obSpacing.sm,
  },
  chipCard: {
    gap: obSpacing.lg,
  },
  group: {
    gap: obSpacing.sm,
  },
  // Same 4:5 frame for every photo; name/age sit above the first one.
  photo: {
    width: '100%',
    aspectRatio: 4 / 5,
  },
  sectionTitle: {
    fontFamily: obFonts.bodySemiBold,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: obColors.textSecondary,
  },
  fact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: obSpacing.sm,
  },
  factText: {
    flexShrink: 1,
    fontFamily: obFonts.body,
    fontSize: 16,
    lineHeight: 22,
    color: obColors.textPrimary,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    borderRadius: 16,
    backgroundColor: obColors.selectedFill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: {
    fontFamily: obFonts.bodyMedium,
    fontSize: 14,
    lineHeight: 19,
    color: obColors.textPrimary,
  },
  promptLabel: {
    fontFamily: obFonts.bodySemiBold,
    fontSize: 15,
    lineHeight: 20,
    color: obColors.textPrimary,
  },
  promptAnswer: {
    fontFamily: obFonts.heading,
    fontSize: 22,
    lineHeight: 29,
    color: obColors.textPrimary,
  },
  tasteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: obSpacing.md,
  },
  tasteText: {
    flex: 1,
    gap: 1,
  },
  tasteSub: {
    fontFamily: obFonts.body,
    fontSize: 13,
    lineHeight: 18,
    color: obColors.textSecondary,
  },
  thumb: {
    backgroundColor: obColors.selectedFill,
  },
  thumbRound: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  thumbTall: {
    width: 36,
    height: 52,
    borderRadius: 6,
  },
  thumbEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbInitial: {
    fontFamily: obFonts.heading,
    fontSize: 18,
    lineHeight: 24,
    color: obColors.cta,
  },
  dev: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: obSpacing.sm,
    backgroundColor: obColors.notice,
    borderRadius: 10,
    paddingHorizontal: obSpacing.md,
    paddingVertical: obSpacing.sm,
  },
  devText: {
    flex: 1,
    fontFamily: obFonts.bodyMedium,
    fontSize: 13,
    lineHeight: 18,
    color: obColors.textSecondary,
  },
});
