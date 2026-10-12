// Real Activity feed items (D75–D77): a large single-column card per person
// with incoming interest, and a small "You and X matched" row per match.
// Same visual spec as the approved DEV preview (components/dev/activity/*,
// kept separate as the design reference). Presentational only: data and
// photos come in as props.
import { Ionicons } from '@expo/vector-icons';
import { Image, type ImageSource } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { obColors, obFonts, obSpacing } from '@/lib/onboardingV2/theme';

const FADE = require('../../assets/images/discover-fade.png');
export const ACTIVITY_SURFACE = '#FFFDF8';
export const ACTIVITY_CARD_BORDER = '#E4DCCB';
const SAGE = obColors.selectedFill;
/** Info strip under a card photo (meta + up to two comment lines). */
export const CARD_INFO = 92;
export const CARD_GAP = obSpacing.md;

function UnreadDot({ show }: { show: boolean }) {
  return show ? <View style={styles.dot} /> : null;
}

export type InterestCardProps = {
  name: string;
  age: number | null;
  place: string | null;
  photo: ImageSource | null;
  /** "Liked you" / "Liked your photo" / "Liked your answer". */
  label: string;
  /** Short ("12m") and long ("12m ago") time. */
  time: string;
  timeLong: string;
  /** My liked answer (answer likes only). */
  answer: string | null;
  comment: string | null;
  /** My liked photo (photo likes only). */
  thumb: ImageSource | null;
  unread: boolean;
  photoHeight: number;
  onPress: () => void;
};

export function InterestCard(p: InterestCardProps) {
  const title = p.age ? `${p.name}, ${p.age}` : p.name;
  const a11y = [
    `${title}${p.place ? `, ${p.place}` : ''}`,
    `${p.label}, ${p.timeLong}`,
    p.answer ? `Your answer: ${p.answer}` : null,
    p.comment ? `Comment: ${p.comment}` : null,
    p.unread ? 'New' : null,
  ].filter(Boolean).join('. ');
  return (
    <Pressable
      onPress={p.onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityHint="Opens the full profile">
      <View style={{ height: p.photoHeight }}>
        {p.photo ? <Image source={p.photo} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} /> : <View style={[StyleSheet.absoluteFill, styles.photoFallback]} />}
        <Image source={FADE} style={styles.fade} contentFit="fill" accessible={false} />
        <View style={styles.cardName}>
          <Text style={styles.cardNameText} numberOfLines={1} maxFontSizeMultiplier={1.3}>{title}</Text>
          {p.place ? (
            <View style={styles.placeRow}>
              <Ionicons name="location-sharp" size={14} color="#FFFFFF" />
              <Text style={styles.placeText} numberOfLines={1} maxFontSizeMultiplier={1.3}>{p.place}</Text>
            </View>
          ) : null}
        </View>
      </View>
      <View style={styles.cardInfo}>
        <View style={styles.cardInfoText}>
          <View style={styles.metaRow}>
            <Text style={styles.meta} numberOfLines={2}>{`${p.label} · ${p.time}`}</Text>
            <UnreadDot show={p.unread} />
          </View>
          {p.answer ? <Text style={styles.yourAnswer} numberOfLines={1}>{`Your answer: ${p.answer}`}</Text> : null}
          {p.comment ? (
            // List: max two lines + ellipsis; the full comment is in the profile.
            <Text style={styles.cardComment} numberOfLines={2} ellipsizeMode="tail">{`“${p.comment}”`}</Text>
          ) : null}
        </View>
        {p.thumb ? <Image source={p.thumb} style={[styles.thumb, { width: 76, height: 58 }]} contentFit="cover" accessible={false} /> : null}
      </View>
    </Pressable>
  );
}

export type MatchRowProps = {
  title: string;
  sub: string;
  photo: ImageSource | null;
  unread: boolean;
  onPress: () => void;
};

export function MatchRow(p: MatchRowProps) {
  return (
    <Pressable
      onPress={p.onPress}
      style={({ pressed }) => [styles.matchRow, pressed && { opacity: 0.9 }]}
      accessibilityRole="button"
      accessibilityLabel={`${p.title}. ${p.sub}${p.unread ? '. New' : ''}`}
      accessibilityHint="Opens your chat">
      {p.photo ? <Image source={p.photo} style={styles.matchAvatar} contentFit="cover" accessible={false} /> : <View style={styles.matchAvatar} />}
      <View style={styles.matchText}>
        <Text style={styles.matchTitle} numberOfLines={2} maxFontSizeMultiplier={1.4}>{p.title}</Text>
        <Text style={styles.meta} numberOfLines={1}>{p.sub}</Text>
      </View>
      <UnreadDot show={p.unread} />
      <Ionicons name="chevron-forward" size={20} color={obColors.textSecondary} importantForAccessibility="no" />
    </Pressable>
  );
}

/** Liked-content context inside the profile (full comment, no line limit). */
export function InterestContext({ label, answer, comment, thumb, a11y }: { label: string; answer: string | null; comment: string | null; thumb: ImageSource | null; a11y: string }) {
  return (
    <View style={styles.profileContext} accessible accessibilityLabel={a11y}>
      {thumb ? <Image source={thumb} style={[styles.thumb, { width: 84, height: 64 }]} contentFit="cover" accessible={false} /> : null}
      <View style={styles.cardInfoText}>
        <Text style={styles.meta}>{label}</Text>
        {answer ? <Text style={styles.yourAnswer}>{`Your answer: ${answer}`}</Text> : null}
        {comment ? <Text style={styles.profileComment}>{`“${comment}”`}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, overflow: 'hidden', backgroundColor: ACTIVITY_SURFACE, borderWidth: 1, borderColor: ACTIVITY_CARD_BORDER },
  photoFallback: { backgroundColor: obColors.notice },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%' },
  cardName: { position: 'absolute', left: obSpacing.md + 2, right: obSpacing.md, bottom: obSpacing.md },
  cardNameText: { fontFamily: obFonts.heading, fontSize: 26, lineHeight: 33, color: '#FFFFFF' },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  placeText: { flexShrink: 1, fontFamily: obFonts.bodyMedium, fontSize: 15, lineHeight: 20, color: '#FFFFFF' },
  cardInfo: { flexDirection: 'row', alignItems: 'center', gap: obSpacing.md, paddingHorizontal: obSpacing.md + 2, paddingVertical: obSpacing.md, backgroundColor: SAGE },
  cardInfoText: { flex: 1, minWidth: 0, gap: 3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: obSpacing.sm },
  meta: { flexShrink: 1, fontFamily: obFonts.body, fontSize: 14, lineHeight: 19, color: obColors.textSecondary },
  yourAnswer: { fontFamily: obFonts.body, fontSize: 14, lineHeight: 19, color: obColors.textSecondary },
  cardComment: { fontFamily: obFonts.body, fontSize: 15, lineHeight: 21, color: obColors.textPrimary },
  profileComment: { fontFamily: obFonts.body, fontSize: 16, lineHeight: 22, color: obColors.textPrimary },
  thumb: { borderRadius: 8, backgroundColor: obColors.notice },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: obColors.cta },
  matchRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: obSpacing.md,
    paddingHorizontal: obSpacing.md,
    paddingVertical: obSpacing.sm + 2,
    borderRadius: 16,
    backgroundColor: ACTIVITY_SURFACE,
    borderWidth: 1,
    borderColor: ACTIVITY_CARD_BORDER,
  },
  matchAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: obColors.notice },
  matchText: { flex: 1, minWidth: 0, gap: 2 },
  matchTitle: { fontFamily: obFonts.bodyMedium, fontSize: 16, lineHeight: 21, color: obColors.textPrimary },
  profileContext: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: obSpacing.md,
    marginHorizontal: obSpacing.md,
    marginTop: obSpacing.md,
    padding: obSpacing.md,
    borderRadius: 14,
    backgroundColor: SAGE,
  },
});
