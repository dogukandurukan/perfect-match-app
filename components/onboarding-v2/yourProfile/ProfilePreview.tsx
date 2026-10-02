// Section 7.3 Your profile (P07, R1): the public profile assembled from every
// section's in-memory draft (buildProfilePreview) as one scrolling page. Never
// shows surname, exact DOB, email, phone or the private selfie. No note/send
// controls here: contextual notes belong to the future visitor profile (D45).
// Opt-in `onLike` (DEV Matches design preview only, 2026-10-02): shows a
// heart on each photo and prompt. Without it the profile renders exactly as
// before (own preview, other members' profiles).
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { obColors, obFonts, obSpacing } from '@/lib/onboardingV2/theme';
import type { PreviewBlock, PreviewFact } from '@/lib/onboardingV2/yourProfile';
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

const FACT_ICON = 17;

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

/** Small single-colour outline icon, same size/colour everywhere (P07 R1 polish). */
function FactIcon({ fact }: { fact: PreviewFact }) {
  if (fact.family === 'mci') {
    return (
      <MaterialCommunityIcons
        name={fact.icon as keyof typeof MaterialCommunityIcons.glyphMap}
        size={FACT_ICON}
        color={obColors.cta}
        importantForAccessibility="no"
      />
    );
  }
  return (
    <Ionicons
      name={fact.icon as keyof typeof Ionicons.glyphMap}
      size={FACT_ICON}
      color={obColors.cta}
      importantForAccessibility="no"
    />
  );
}

function FactRow({ fact }: { fact: PreviewFact }) {
  return (
    <View style={styles.fact}>
      <FactIcon fact={fact} />
      <Text style={styles.factText} maxFontSizeMultiplier={1.6}>
        {fact.text}
      </Text>
    </View>
  );
}

// Soft dark fade under the name — stacked translucent bands (no gradient
// native module is installed; adding one would need a new dev build).
const FADE_STEPS = 16;
const FADE_MAX = 0.62;
function BottomFade() {
  return (
    <View pointerEvents="none" style={styles.fade}>
      {Array.from({ length: FADE_STEPS }).map((_, i) => {
        const t = (i + 1) / FADE_STEPS;
        return <View key={i} style={{ flex: 1, backgroundColor: `rgba(0,0,0,${(FADE_MAX * t * t).toFixed(3)})` }} />;
      })}
    </View>
  );
}

/** What a heart on the profile points at. Photo index 0 is the main photo. */
export type ProfileLikeTarget =
  | { kind: 'photo'; photoIndex: number; uri: string }
  | { kind: 'prompt'; label: string; answer: string };

function LikeHeart({ label, onPress, onPhoto }: { label: string; onPress: () => void; onPhoto?: boolean }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.heart, onPhoto ? styles.heartOnPhoto : styles.heartOnCard]}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}>
      <Ionicons name="heart-outline" size={22} color={obColors.cta} importantForAccessibility="no" />
    </TouchableOpacity>
  );
}

export function ProfilePreview({
  blocks,
  onLike,
}: {
  blocks: PreviewBlock[];
  onLike?: (target: ProfileLikeTarget) => void;
}) {
  let photoIndex = -1;
  return (
    <View style={styles.wrap}>
      {blocks.map((b, i) => {
        if (b.type === 'hero' || b.type === 'photo') photoIndex += 1;
        const idx = photoIndex;
        switch (b.type) {
          case 'header':
            return (
              <Text key={i} style={styles.name} accessibilityRole="header" maxFontSizeMultiplier={1.4}>
                {b.name || 'Your first name'}
                {b.age !== null ? <Text style={styles.age}>, {b.age}</Text> : null}
              </Text>
            );
          case 'hero': {
            const label = b.age !== null ? `${b.name}, ${b.age}` : b.name;
            return (
              <View key={i} style={styles.card} accessible accessibilityLabel={`Main photo. ${label}`}>
                <Image source={{ uri: b.photo.uri }} style={styles.photo} contentFit="cover" accessible={false} />
                <BottomFade />
                <View style={[styles.heroText, onLike && styles.heroTextWithHeart]} pointerEvents="none">
                  <Text style={styles.heroName} numberOfLines={2} maxFontSizeMultiplier={1.3}>
                    {b.name || 'Your first name'}
                    {b.age !== null ? <Text style={styles.heroAge}>, {b.age}</Text> : null}
                  </Text>
                </View>
                {onLike ? (
                  <LikeHeart onPhoto label="Like main photo" onPress={() => onLike({ kind: 'photo', photoIndex: idx, uri: b.photo.uri })} />
                ) : null}
              </View>
            );
          }
          case 'photo':
            return (
              <View key={i} style={styles.card}>
                <Image source={{ uri: b.photo.uri }} style={styles.photo} contentFit="cover" accessibilityLabel="Profile photo" />
                {onLike ? (
                  <LikeHeart onPhoto label={`Like photo ${idx + 1}`} onPress={() => onLike({ kind: 'photo', photoIndex: idx, uri: b.photo.uri })} />
                ) : null}
              </View>
            );
          case 'facts':
            return (
              <View key={i} style={[styles.card, styles.pad]}>
                {b.title ? <SectionTitle>{b.title}</SectionTitle> : null}
                {b.facts.map((f) => (
                  <FactRow key={f.text} fact={f} />
                ))}
              </View>
            );
          case 'groups':
            return (
              <View key={i} style={[styles.card, styles.pad, styles.chipCard]}>
                {b.groups.map((g) => (
                  <View key={g.title} style={styles.group}>
                    <SectionTitle>{g.title}</SectionTitle>
                    <View style={styles.inlineFacts}>
                      {g.items.map((f) => (
                        <FactRow key={f.text} fact={f} />
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
                <Text style={[styles.promptAnswer, onLike && styles.promptAnswerWithHeart]} maxFontSizeMultiplier={1.6}>
                  {b.answer}
                </Text>
                {onLike ? (
                  <LikeHeart label={`Like answer: ${b.label}`} onPress={() => onLike({ kind: 'prompt', label: b.label, answer: b.answer })} />
                ) : null}
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
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '42%',
  },
  heroText: {
    position: 'absolute',
    left: obSpacing.lg,
    right: obSpacing.lg,
    bottom: obSpacing.lg,
  },
  heroTextWithHeart: {
    right: 72,
  },
  heroName: {
    fontFamily: obFonts.heading,
    fontSize: 30,
    lineHeight: 37,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  heroAge: {
    fontFamily: obFonts.body,
    color: '#FFFFFF',
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
  // Same 4:5 frame for every photo; name/age sit ON the first one (hero).
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
    maxWidth: '100%',
  },
  factText: {
    flexShrink: 1,
    fontFamily: obFonts.body,
    fontSize: 16,
    lineHeight: 22,
    color: obColors.textPrimary,
  },
  // Several answers sit side by side and wrap onto the next line; each
  // keeps the exact First dates row style (icon + 16/22 DM Sans).
  inlineFacts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: obSpacing.lg,
    rowGap: obSpacing.sm,
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
  promptAnswerWithHeart: {
    paddingRight: 52,
  },
  heart: {
    position: 'absolute',
    right: obSpacing.md,
    bottom: obSpacing.md,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartOnPhoto: {
    backgroundColor: 'rgba(255,253,248,0.94)',
  },
  heartOnCard: {
    backgroundColor: obColors.selectedFill,
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
