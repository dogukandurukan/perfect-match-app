// Component: Hinge-style profile body (Home + Matches detail)
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { type ReactNode } from 'react';
import { Dimensions, StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { colors } from '@/lib/designTokens';
import {
  buildAboutMeChips,
  buildAvailabilityChip,
  buildInterestChips,
  buildLanguageChips,
  buildLookingForChips,
  buildPromptCards,
  formatFeedLocation,
  hingeSafeAge,
  type ChipIcon,
  type HingeProfilePerson,
  type ProfileChip,
  type PromptCard,
} from '@/lib/hingeProfile';

const ACCENT = '#1A1A1A';
const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const PHOTO1_HEIGHT = SCREEN_HEIGHT * 0.55;

function InfoLine({ icon, text }: { icon?: ChipIcon; text: string }) {
  return (
    <View style={styles.infoLine}>
      {icon ? <Ionicons name={icon} size={16} color={colors.textPrimary} /> : null}
      <ThemedText style={styles.infoLineText}>{text}</ThemedText>
    </View>
  );
}

/** Bumble bölüm kartı — kalın başlık + içerik. */
export function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.sectionCard}>
      <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
      {children}
    </View>
  );
}

/** İkon+etiket chip grid'i (About me / Looking for / Languages) — Bumble tarzı
 * monokrom vektör ikon. Interest chip'leri `emoji` alanı taşır (renkli,
 * ilgiye özel — Bumble'ın "My interests" bölümündeki gibi, 2026-09-03) ve
 * varsa vektör ikon yerine onu gösterir. */
export function ChipGrid({ chips }: { chips: ProfileChip[] }) {
  return (
    <View style={styles.chipRow}>
      {chips.map((c) => (
        <View key={c.key} style={styles.aboutChip}>
          {c.emoji ? (
            <ThemedText style={styles.aboutChipEmoji}>{c.emoji}</ThemedText>
          ) : (
            <Ionicons name={c.icon} size={14} color={colors.textPrimary} />
          )}
          <ThemedText style={styles.aboutChipText}>{c.label}</ThemedText>
        </View>
      ))}
    </View>
  );
}

/** Bağlamlı beğeni hedefi — Home Note etkileşimi + Buzz Faz B aynı `likes` şemasını besler (bkz CLAUDE.md §3/§5). */
export type NoteTarget = {
  type: 'photo' | 'prompt';
  /** likes.target_key olacak: 'photo-0' (hero), 'photo-1'… veya prompt.id */
  key: string;
  /** Composer'da bağlam metni (ör. prompt başlığı / 'this photo'). */
  label: string;
};

/** Foto üstüne bindirilen Bumble tarzı "Note" pill'i (bottom-right). */
function PhotoNoteButton({ onPress, a11yLabel }: { onPress: () => void; a11yLabel: string }) {
  return (
    <TouchableOpacity
      style={styles.photoNoteBtn}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}>
      <Ionicons name="chatbubble-ellipses-outline" size={16} color="#FFFFFF" />
      <ThemedText style={styles.photoNoteText}>Note</ThemedText>
    </TouchableOpacity>
  );
}

function PromptBlock({
  title,
  answer,
  onNote,
}: {
  title: string;
  answer: string;
  onNote?: () => void;
}) {
  return (
    <View style={styles.promptCard}>
      <ThemedText style={styles.promptTitle}>{title}</ThemedText>
      <ThemedText style={styles.promptAnswer}>{answer}</ThemedText>
      {onNote ? (
        <TouchableOpacity
          style={styles.promptNoteBtn}
          onPress={onNote}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`Like and add a note: ${title}`}>
          <Ionicons name="chatbubble-ellipses-outline" size={18} color={ACCENT} />
        </TouchableOpacity>
      ) : null}
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
  /** Verildiğinde her foto & prompt'a "Note" (bağlamlı beğeni) affordance'ı gösterilir. */
  onNoteTarget?: (target: NoteTarget) => void;
  /** Bumble tarzı edge-to-edge, ekranı kaplayan ana foto (Home discovery kartı için —
   * Matches/user-profile/kendi Profile hâlâ eski kart-görünümü kullanıyor). */
  heroFullScreen?: boolean;
};

export function HingeProfileCard({
  person,
  viewerCity = null,
  midActions,
  footer,
  onNoteTarget,
  heroFullScreen = false,
}: HingeProfileCardProps) {
  const prompts = buildPromptCards(person);
  const locationLabel = formatFeedLocation(person.district, person.city, viewerCity);

  // Bumble bölümleri (yalnızca dolu alanlar).
  const aboutMeChips: ProfileChip[] = [];
  const availabilityChip = buildAvailabilityChip(person.availability_days);
  if (availabilityChip) aboutMeChips.push(availabilityChip);
  aboutMeChips.push(...buildAboutMeChips(person));
  const lookingForChips = buildLookingForChips(person);
  const interestChips = buildInterestChips(person);
  const languages = (person.languages ?? []).filter((l) => !!l && l.trim().length > 0);
  const livesInCity = person.city?.trim() && !/^\s*$/.test(person.city) ? person.city.trim() : null;
  const verified = person.photo_verified === true;
  const universityLine =
    (person.education === 'University' || person.education === "Master's") &&
    person.education_detail?.trim()
      ? person.education_detail.trim()
      : null;
  const occupationLine = person.occupation?.trim() || null;

  const hasCommonMedia =
    !!person.favorite_music || !!person.favorite_movie || !!person.favorite_book;

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
        <View style={[styles.photo1Wrap, heroFullScreen && styles.photo1WrapFullScreen]}>
          <Image source={{ uri: heroUri }} style={styles.photo1} contentFit="cover" />
          <View style={styles.nameOverlay}>
            {verified ? (
              <View style={styles.verifiedPill}>
                <Ionicons name="checkmark-circle" size={14} color="#FFFFFF" />
                <ThemedText style={styles.verifiedText}>Photo verified</ThemedText>
              </View>
            ) : null}
            <ThemedText style={styles.overlayName}>
              {person.first_name ?? 'Someone'}
              {age > 0 ? `, ${age}` : ''}
            </ThemedText>
            {occupationLine ? (
              <View style={styles.overlayInfoRow}>
                <Ionicons name="briefcase-outline" size={14} color="#FFFFFF" />
                <ThemedText style={styles.overlayInfoText}>{occupationLine}</ThemedText>
              </View>
            ) : null}
            {universityLine ? (
              <View style={styles.overlayInfoRow}>
                <Ionicons name="school-outline" size={14} color="#FFFFFF" />
                <ThemedText style={styles.overlayInfoText}>{universityLine}</ThemedText>
              </View>
            ) : null}
          </View>
          {pct !== null ? (
            <View style={styles.matchBadge}>
              <ThemedText style={styles.matchBadgeText}>%{pct}</ThemedText>
            </View>
          ) : null}
          {onNoteTarget ? (
            <PhotoNoteButton
              onPress={() => onNoteTarget({ type: 'photo', key: 'photo-0', label: 'this photo' })}
              a11yLabel="Like this photo and add a note"
            />
          ) : null}
        </View>
      ) : null}

      {aboutMeChips.length > 0 ? (
        <SectionCard title="About me">
          <ChipGrid chips={aboutMeChips} />
        </SectionCard>
      ) : null}

      {(person.hobbies ?? []).length > 0 || hasCommonMedia ? (
        <SectionCard title="Things in common">
          {(person.hobbies ?? []).length > 0 ? (
            <View style={styles.chipRow}>
              {(person.hobbies ?? []).map((hobby) => (
                <View key={hobby} style={styles.aboutChip}>
                  <ThemedText style={styles.aboutChipText}>{hobby}</ThemedText>
                </View>
              ))}
            </View>
          ) : null}
          {person.favorite_music ? (
            <InfoLine icon="musical-notes-outline" text={person.favorite_music} />
          ) : null}
          {person.favorite_movie ? <InfoLine icon="film-outline" text={person.favorite_movie} /> : null}
          {person.favorite_book ? <InfoLine icon="book-outline" text={person.favorite_book} /> : null}
        </SectionCard>
      ) : null}

      {lookingForChips.length > 0 ? (
        <SectionCard title="I'm looking for">
          <ChipGrid chips={lookingForChips} />
        </SectionCard>
      ) : null}

      {interestChips.length > 0 ? (
        <SectionCard title="My interests">
          <ChipGrid chips={interestChips} />
        </SectionCard>
      ) : null}

      {midActions ?? null}

      {interleavedBlocks.map((block) =>
        block.type === 'prompt' && block.prompt ? (
          <PromptBlock
            key={block.key}
            title={block.prompt.title}
            answer={block.prompt.answer}
            onNote={
              onNoteTarget && block.prompt
                ? () =>
                    onNoteTarget({
                      type: 'prompt',
                      key: block.prompt!.id,
                      label: block.prompt!.title,
                    })
                : undefined
            }
          />
        ) : block.uri ? (
          <View key={block.key} style={styles.inlinePhotoWrap}>
            <Image source={{ uri: block.uri }} style={styles.inlinePhoto} contentFit="cover" />
            {onNoteTarget ? (
              <PhotoNoteButton
                onPress={() => onNoteTarget({ type: 'photo', key: block.key, label: 'this photo' })}
                a11yLabel="Like this photo and add a note"
              />
            ) : null}
          </View>
        ) : null,
      )}

      {languages.length > 0 ? (
        <SectionCard title="Languages">
          <ChipGrid chips={buildLanguageChips(languages)} />
        </SectionCard>
      ) : null}

      {locationLabel || livesInCity ? (
        <SectionCard title="My location">
          {locationLabel ? (
            <ThemedText style={styles.locationText}>📍 {locationLabel}</ThemedText>
          ) : null}
          {livesInCity ? (
            <View style={styles.chipRow}>
              <View style={styles.aboutChip}>
                <ThemedText style={styles.aboutChipText}>Lives in {livesInCity}</ThemedText>
              </View>
            </View>
          ) : null}
        </SectionCard>
      ) : null}

      {footer ?? null}
    </View>
  );
}

const styles = StyleSheet.create({
  photo1Wrap: {
    height: PHOTO1_HEIGHT,
    marginHorizontal: 14,
    marginTop: 12,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#DDDDDD',
    position: 'relative',
  },
  // Bumble-style edge-to-edge hero for Home's discovery card (user request,
  // 2026-09-07) — no side margin/rounding, fills basically the whole
  // viewport so About-me etc. only appear once you scroll.
  photo1WrapFullScreen: {
    height: SCREEN_HEIGHT * 0.88,
    marginHorizontal: 0,
    marginTop: 0,
    borderRadius: 0,
  },
  photo1: { width: '100%', height: '100%' },
  // Translucent dark pill + white text/icon (matches Bumble's own "Photo
  // verified" badge, used as the style reference for matchBadge too,
  // 2026-09-07 — was a light bg/dark-text pill before).
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 2,
  },
  verifiedText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  sectionCard: {
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
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  aboutChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F2EFE7',
    borderRadius: 18,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  aboutChipText: { fontSize: 13, color: colors.textPrimary, fontWeight: '500' },
  aboutChipEmoji: { fontSize: 15, lineHeight: 18 },
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
    fontSize: 25,
    // No lineHeight before — ThemedText's default (24) is smaller than a
    // 28px fontSize, so the top of tall glyphs (capital letters) got
    // clipped. Explicit lineHeight fixes it (2026-09-03, found via device
    // testing — "Ece" text screenshot showed the clipped top edge).
    lineHeight: 30,
    fontWeight: '600',
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  matchBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    // Same translucent-dark treatment as verifiedPill (was flat opaque
    // ACCENT before — read as "too black" against the photo, 2026-09-07).
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  matchBadgeText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  overlayInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  overlayInfoText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },

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
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
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
  infoLineText: { flex: 1, fontSize: 14, color: colors.textPrimary, lineHeight: 20 },

  promptCard: {
    position: 'relative',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    paddingRight: 56,
    marginHorizontal: 14,
    marginTop: 14,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  promptNoteBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F7F3EB',
    alignItems: 'center',
    justifyContent: 'center',
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
  inlinePhotoWrap: {
    position: 'relative',
    marginTop: 14,
    marginHorizontal: 14,
    borderRadius: 18,
    overflow: 'hidden',
  },
  inlinePhoto: {
    width: '100%',
    height: 300,
    backgroundColor: '#DDDDDD',
  },
  photoNoteBtn: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  photoNoteText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
});
