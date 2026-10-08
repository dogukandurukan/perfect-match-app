// Approved V2 Matches card language (3-screen mockup, D61–D66), shared by the
// real Matches screen (components/main/V2DailyMatchesScreen.tsx) and the DEV
// preview (components/dev/MatchesDesignPreview.tsx). Presentation only: the
// owner screen decides the state and what each button does.
import { Ionicons } from '@expo/vector-icons';
import { Image, type ImageSource } from 'expo-image';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { MATCHES_COPY } from '@/lib/matches/copy';
import { obColors, obFonts, obSpacing } from '@/lib/onboardingV2/theme';

const FADE = require('../../../assets/images/discover-fade.png');
const SURFACE = '#FFFDF8';
const CARD_BORDER = '#E4DCCB';

export { MATCHES_COPY };

const C = MATCHES_COPY;

/** "Matches" + the static daily line (Istanbul time, no countdown). */
export function MatchesTitle({ right }: { right?: ReactNode }) {
  return (
    <View style={styles.topRow}>
      <View style={styles.titleCol}>
        <Text style={styles.screenTitle} accessibilityRole="header" maxFontSizeMultiplier={1.4}>{C.title}</Text>
        <Text style={styles.dailyLine} maxFontSizeMultiplier={1.4}>{C.dailyLine}</Text>
      </View>
      {right}
    </View>
  );
}

export function SectionHead({ title, caption, gapAbove }: { title: string; caption: string; gapAbove?: boolean }) {
  return (
    <View style={[styles.sectionHead, gapAbove && styles.sectionGap]}>
      <Text style={styles.sectionTitle} accessibilityRole="header" maxFontSizeMultiplier={1.4}>{title}</Text>
      <Text style={styles.sectionCaption} maxFontSizeMultiplier={1.6}>{caption}</Text>
    </View>
  );
}

export function StatusLine({ text }: { text: string }) {
  return (
    <View style={styles.statusRow} accessible accessibilityLabel={text}>
      <Ionicons name="heart-outline" size={16} color={obColors.textSecondary} importantForAccessibility="no" />
      <Text style={styles.statusText}>{text}</Text>
    </View>
  );
}

export function ViewProfileButton({ name, onPress }: { name: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.outlineBtn} accessibilityRole="button" accessibilityLabel={`${C.viewProfile}, ${name}`}>
      <Text style={styles.outlineBtnText}>{C.viewProfile}</Text>
    </TouchableOpacity>
  );
}

export function SayHelloButton({ name, onPress }: { name: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.fillBtn} accessibilityRole="button" accessibilityLabel={`${C.sayHello}, ${name}`}>
      <Text style={styles.fillBtnText}>{C.sayHello}</Text>
    </TouchableOpacity>
  );
}

export function StartedBox() {
  return (
    <View style={styles.started} accessible accessibilityLabel={`${C.conversationStarted}. ${C.conversationNote}`}>
      <View style={styles.startedIcon}>
        <Ionicons name="checkmark" size={16} color={obColors.onCta} importantForAccessibility="no" />
      </View>
      <View style={styles.startedText}>
        <Text style={styles.startedTitle}>{C.conversationStarted}</Text>
        <Text style={styles.startedNote}>{C.conversationNote}</Text>
      </View>
    </View>
  );
}

/** Large photo card: the photo opens the profile; actions sit below it.
 * Same size in every state (a started conversation doesn't shrink it). */
export function PersonCard({
  name,
  age,
  location,
  photo,
  onOpenProfile,
  children,
}: {
  name: string;
  age: number | null;
  location: string | null;
  photo: ImageSource | number | null;
  onOpenProfile: () => void;
  children: ReactNode;
}) {
  return (
    <View style={styles.card}>
      <Pressable onPress={onOpenProfile} accessibilityRole="button" accessibilityLabel={`${age !== null ? `${name}, ${age}` : name}. Open profile`}>
        {photo ? (
          <Image source={photo} style={styles.cardPhoto} contentFit="cover" contentPosition="top" accessible={false} />
        ) : (
          <View style={[styles.cardPhoto, styles.cardPhotoEmpty]}>
            <Text style={styles.cardInitial}>{(name.trim()[0] ?? '?').toUpperCase()}</Text>
          </View>
        )}
        <Image source={FADE} style={styles.fade} contentFit="fill" accessible={false} />
        <View style={styles.cardNameWrap} pointerEvents="none">
          <Text style={styles.cardName} numberOfLines={1} maxFontSizeMultiplier={1.3}>
            {name}
            {age !== null ? <Text style={styles.cardAge}>, {age}</Text> : null}
          </Text>
          {location ? (
            <View style={styles.cardLoc}>
              <Ionicons name="location-outline" size={15} color="#FFFFFF" importantForAccessibility="no" />
              <Text style={styles.cardLocText} numberOfLines={1}>{location}</Text>
            </View>
          ) : null}
        </View>
      </Pressable>
      <View style={styles.cardBody}>{children}</View>
    </View>
  );
}

export function EmptyCard({ icon, title, text }: { icon: keyof typeof Ionicons.glyphMap; title: string; text: string }) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={28} color={obColors.cta} importantForAccessibility="no" />
      <Text style={styles.emptyTitle} maxFontSizeMultiplier={1.4}>{title}</Text>
      <Text style={styles.emptyText} maxFontSizeMultiplier={1.6}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', minHeight: 52, marginBottom: obSpacing.md, paddingTop: obSpacing.xs },
  titleCol: { flexShrink: 1, gap: 2 },
  screenTitle: { fontFamily: obFonts.heading, fontSize: 32, lineHeight: 40, color: obColors.textPrimary },
  dailyLine: { fontFamily: obFonts.bodyMedium, fontSize: 13, lineHeight: 18, color: obColors.textSecondary },
  sectionHead: { marginBottom: obSpacing.sm, gap: 1 },
  sectionGap: { marginTop: obSpacing.xl },
  sectionTitle: { fontFamily: obFonts.heading, fontSize: 20, lineHeight: 26, color: obColors.textPrimary },
  sectionCaption: { fontFamily: obFonts.body, fontSize: 13, lineHeight: 18, color: obColors.textSecondary },
  card: { backgroundColor: SURFACE, borderRadius: 18, borderWidth: 1, borderColor: CARD_BORDER, overflow: 'hidden' },
  // Large, nearly square photo (mockup); not shrunk to fit both cards.
  cardPhoto: { width: '100%', aspectRatio: 1, backgroundColor: obColors.selectedFill },
  cardPhotoEmpty: { alignItems: 'center', justifyContent: 'center' },
  cardInitial: { fontFamily: obFonts.heading, fontSize: 64, lineHeight: 76, color: obColors.cta },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '45%' },
  cardNameWrap: { position: 'absolute', left: obSpacing.lg, right: obSpacing.lg, bottom: obSpacing.md, gap: 2 },
  cardName: {
    fontFamily: obFonts.heading,
    fontSize: 27,
    lineHeight: 34,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  cardAge: { fontFamily: obFonts.heading, color: '#FFFFFF' },
  cardLoc: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cardLocText: { flexShrink: 1, fontFamily: obFonts.bodyMedium, fontSize: 15, lineHeight: 20, color: '#FFFFFF' },
  cardBody: { padding: obSpacing.sm + 2, gap: obSpacing.sm },
  outlineBtn: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: obColors.border, backgroundColor: SURFACE, alignItems: 'center', justifyContent: 'center' },
  outlineBtnText: { fontFamily: obFonts.bodyMedium, fontSize: 16, lineHeight: 21, color: obColors.textPrimary },
  fillBtn: { minHeight: 46, borderRadius: 12, backgroundColor: obColors.cta, alignItems: 'center', justifyContent: 'center' },
  fillBtnText: { fontFamily: obFonts.bodySemiBold, fontSize: 16, lineHeight: 21, color: obColors.onCta },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: obSpacing.xs },
  statusText: { fontFamily: obFonts.bodyMedium, fontSize: 14, lineHeight: 19, color: obColors.textSecondary },
  started: { flexDirection: 'row', alignItems: 'center', gap: obSpacing.md, borderRadius: 12, backgroundColor: obColors.selectedFill, paddingHorizontal: obSpacing.md, paddingVertical: obSpacing.sm + 2 },
  startedIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: obColors.cta, alignItems: 'center', justifyContent: 'center' },
  startedText: { flex: 1, gap: 1 },
  startedTitle: { fontFamily: obFonts.bodySemiBold, fontSize: 14, lineHeight: 19, color: obColors.textPrimary },
  startedNote: { fontFamily: obFonts.body, fontSize: 13, lineHeight: 18, color: obColors.textSecondary },
  empty: { alignItems: 'center', gap: obSpacing.sm, backgroundColor: SURFACE, borderRadius: 18, borderWidth: 1, borderColor: CARD_BORDER, paddingVertical: obSpacing.xxl, paddingHorizontal: obSpacing.xl },
  emptyTitle: { fontFamily: obFonts.heading, fontSize: 20, lineHeight: 27, color: obColors.textPrimary, textAlign: 'center' },
  emptyText: { fontFamily: obFonts.body, fontSize: 15, lineHeight: 21, color: obColors.textSecondary, textAlign: 'center' },
});
