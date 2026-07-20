// Component: Hinge-style profile body (Home + Matches detail)
import { Image } from 'expo-image';
import { type ReactNode } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { colors } from '@/lib/designTokens';
import {
  buildPromptCards,
  formatFeedLocation,
  hingeSafeAge,
  type HingeProfilePerson,
  type PromptCard,
} from '@/lib/hingeProfile';
import {
  formatAvailabilityLabel,
  formatDrinkingLabel,
  formatIntentLabel,
  formatSmokingLabel,
} from '@/lib/labels';

const ACCENT = '#B8860B';
const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const PHOTO1_HEIGHT = SCREEN_HEIGHT * 0.55;

function InfoLine({ icon, text }: { icon?: string; text: string }) {
  return (
    <View style={styles.infoLine}>
      {icon ? <Text style={styles.infoLineIcon}>{icon}</Text> : null}
      <ThemedText style={styles.infoLineText}>{text}</ThemedText>
    </View>
  );
}

function LifestyleChip({ label }: { label: string }) {
  return (
    <View style={styles.lifestyleChip}>
      <ThemedText style={styles.lifestyleChipText}>{label}</ThemedText>
    </View>
  );
}

function PromptBlock({ title, answer }: { title: string; answer: string }) {
  return (
    <View style={styles.promptCard}>
      <ThemedText style={styles.promptTitle}>{title}</ThemedText>
      <ThemedText style={styles.promptAnswer}>{answer}</ThemedText>
    </View>
  );
}

export type HingeProfileCardProps = {
  person: HingeProfilePerson;
  viewerCity?: string | null;
  /** Inserted after lifestyle (e.g. Home like/pass row). */
  midActions?: ReactNode;
  /** Bottom actions (e.g. Let's meet). */
  footer?: ReactNode;
};

export function HingeProfileCard({
  person,
  viewerCity = null,
  midActions,
  footer,
}: HingeProfileCardProps) {
  const prompts = buildPromptCards(person);
  const intentLabel = formatIntentLabel(person.intent);
  const availabilityLabel = formatAvailabilityLabel(person.availability_days);
  const drinkingLabel = formatDrinkingLabel(person.drinking);
  const smokingLabel = formatSmokingLabel(person.smoking);
  const locationLabel = formatFeedLocation(person.district, person.city, viewerCity);
  const lifestyleChips = [availabilityLabel, drinkingLabel, smokingLabel].filter(
    (x): x is string => !!x,
  );
  const hasThingsInCommon =
    (person.hobbies ?? []).length > 0 ||
    !!person.favorite_music ||
    !!person.favorite_movie ||
    !!person.favorite_book;

  const photoUrls = person.photoUrls.filter((u) => typeof u === 'string' && u.trim().length > 0);
  const heroUri = photoUrls[0] ?? null;
  const extraPhotos = photoUrls.slice(1);
  const age = hingeSafeAge(person.date_of_birth);
  const pct =
    typeof person.match_percentage === 'number' && Number.isFinite(person.match_percentage)
      ? Math.round(person.match_percentage)
      : null;

  const interleavedBlocks: {
    type: 'prompt' | 'photo';
    key: string;
    prompt?: PromptCard;
    uri?: string;
  }[] = [];
  const pairCount = Math.max(prompts.length, extraPhotos.length);
  for (let i = 0; i < pairCount; i += 1) {
    if (prompts[i]) {
      interleavedBlocks.push({
        type: 'prompt',
        key: `prompt-${prompts[i].id}`,
        prompt: prompts[i],
      });
    }
    if (extraPhotos[i]) {
      interleavedBlocks.push({
        type: 'photo',
        key: `photo-${i + 1}`,
        uri: extraPhotos[i],
      });
    }
  }

  return (
    <View>
      {heroUri ? (
        <View style={styles.photo1Wrap}>
          <Image source={{ uri: heroUri }} style={styles.photo1} contentFit="cover" />
          <View style={styles.nameOverlay}>
            <ThemedText style={styles.overlayName}>
              {person.first_name ?? 'Someone'}
              {age > 0 ? `, ${age}` : ''}
            </ThemedText>
            {intentLabel ? <ThemedText style={styles.intentHero}>{intentLabel}</ThemedText> : null}
          </View>
          {pct !== null ? (
            <View style={styles.matchBadge}>
              <ThemedText style={styles.matchBadgeText}>%{pct}</ThemedText>
            </View>
          ) : null}
        </View>
      ) : null}

      {hasThingsInCommon ? (
        <View style={styles.simCard}>
          <ThemedText style={styles.simCardTitle}>Things in common 🤝</ThemedText>
          {(person.hobbies ?? []).length > 0 ? (
            <View style={styles.chipRow}>
              {(person.hobbies ?? []).map((hobby) => (
                <View key={hobby} style={styles.hobbyChip}>
                  <ThemedText style={styles.hobbyChipText}>{hobby}</ThemedText>
                </View>
              ))}
            </View>
          ) : null}
          {person.favorite_music ? <InfoLine icon="🎵" text={person.favorite_music} /> : null}
          {person.favorite_movie ? <InfoLine icon="🎬" text={person.favorite_movie} /> : null}
          {person.favorite_book ? <InfoLine icon="📚" text={person.favorite_book} /> : null}
        </View>
      ) : null}

      {lifestyleChips.length > 0 || locationLabel ? (
        <View style={styles.infoCard}>
          {lifestyleChips.length > 0 ? (
            <View style={styles.chipRow}>
              {lifestyleChips.map((label) => (
                <LifestyleChip key={label} label={label} />
              ))}
            </View>
          ) : null}
          {locationLabel ? (
            <ThemedText style={styles.locationText}>{locationLabel}</ThemedText>
          ) : null}
        </View>
      ) : null}

      {midActions ?? null}

      {interleavedBlocks.map((block) =>
        block.type === 'prompt' && block.prompt ? (
          <PromptBlock key={block.key} title={block.prompt.title} answer={block.prompt.answer} />
        ) : block.uri ? (
          <Image
            key={block.key}
            source={{ uri: block.uri }}
            style={styles.inlinePhoto}
            contentFit="cover"
          />
        ) : null,
      )}

      {footer ?? null}
    </View>
  );
}

const styles = StyleSheet.create({
  photo1Wrap: {
    width: '100%',
    height: PHOTO1_HEIGHT,
    backgroundColor: '#DDDDDD',
    position: 'relative',
  },
  photo1: { width: '100%', height: '100%' },
  nameOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 6,
  },
  overlayName: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  intentHero: {
    color: ACCENT,
    fontSize: 17,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  matchBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: ACCENT,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  matchBadgeText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },

  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginHorizontal: 14,
    marginTop: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  lifestyleChip: {
    backgroundColor: '#F7F3EB',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  lifestyleChipText: { fontSize: 13, color: colors.textPrimary, fontWeight: '500' },
  locationText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    lineHeight: 22,
  },
  infoLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  infoLineIcon: { fontSize: 16, width: 24 },
  infoLineText: { flex: 1, fontSize: 14, color: colors.textPrimary, lineHeight: 20 },

  promptCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 14,
    marginTop: 14,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  promptTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888888',
    letterSpacing: 0.2,
  },
  promptAnswer: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    lineHeight: 26,
  },

  simCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 12,
    marginTop: 12,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  simCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  hobbyChip: {
    borderWidth: 1,
    borderColor: ACCENT,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  hobbyChipText: { color: ACCENT, fontSize: 13 },

  inlinePhoto: {
    width: '100%',
    height: 300,
    marginTop: 14,
    backgroundColor: '#DDDDDD',
  },
});
