// Section 7.3 Your profile (P07): the public profile assembled from the
// current in-memory drafts (buildProfilePreview). Never shows surname, exact
// DOB, email, phone or the private selfie.
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { obColors, obFonts, obSpacing } from '@/lib/onboardingV2/theme';
import type { PreviewBlock } from '@/lib/onboardingV2/yourProfile';

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

export function ProfilePreview({ blocks }: { blocks: PreviewBlock[] }) {
  return (
    <View style={styles.wrap}>
      {blocks.map((b, i) => {
        if (b.type === 'hero') {
          const title = b.age !== null ? `${b.name}, ${b.age}` : b.name;
          return (
            <View key={i} style={styles.card}>
              {b.photo ? (
                <Image source={{ uri: b.photo.uri }} style={styles.photo} contentFit="cover" accessibilityLabel="Main photo" />
              ) : (
                <View style={[styles.photo, styles.photoMissing]}>
                  <Text style={styles.muted}>No photo yet</Text>
                </View>
              )}
              <View style={styles.heroText}>
                <Text style={styles.name} accessibilityRole="header" maxFontSizeMultiplier={1.4}>
                  {title || 'Your first name'}
                </Text>
              </View>
            </View>
          );
        }
        if (b.type === 'facts') {
          return (
            <View key={i} style={[styles.card, styles.pad]}>
              {b.facts.map((f) => (
                <View key={f.text} style={styles.fact}>
                  <Ionicons name={f.icon as keyof typeof Ionicons.glyphMap} size={16} color={obColors.cta} importantForAccessibility="no" />
                  <Text style={styles.factText} maxFontSizeMultiplier={1.6}>
                    {f.text}
                  </Text>
                </View>
              ))}
              {b.interests.length ? (
                <View style={styles.chips}>
                  {b.interests.map((t) => (
                    <View key={t} style={styles.chip}>
                      <Text style={styles.chipText} maxFontSizeMultiplier={1.6}>
                        {t}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
              {b.favorites.map((f) => (
                <Text key={f.label} style={styles.factText} maxFontSizeMultiplier={1.6}>
                  <Text style={styles.favLabel}>{f.label}: </Text>
                  {f.items.join(' · ')}
                </Text>
              ))}
            </View>
          );
        }
        if (b.type === 'prompt') {
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
        }
        return (
          <View key={i} style={styles.card}>
            <Image source={{ uri: b.photo.uri }} style={styles.photo} contentFit="cover" accessibilityLabel="Profile photo" />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: obSpacing.md,
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
  photo: {
    width: '100%',
    aspectRatio: 4 / 5,
  },
  photoMissing: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: obColors.notice,
  },
  heroText: {
    padding: obSpacing.lg,
  },
  name: {
    fontFamily: obFonts.heading,
    fontSize: 24,
    lineHeight: 30,
    color: obColors.textPrimary,
  },
  fact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: obSpacing.sm,
  },
  factText: {
    flexShrink: 1,
    fontFamily: obFonts.body,
    fontSize: 15,
    lineHeight: 21,
    color: obColors.textPrimary,
  },
  favLabel: {
    fontFamily: obFonts.bodySemiBold,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  chip: {
    borderRadius: 14,
    backgroundColor: obColors.selectedFill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: {
    fontFamily: obFonts.bodyMedium,
    fontSize: 13,
    lineHeight: 18,
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
    fontSize: 20,
    lineHeight: 27,
    color: obColors.textPrimary,
  },
  muted: {
    fontFamily: obFonts.body,
    fontSize: 14,
    color: obColors.textSecondary,
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
