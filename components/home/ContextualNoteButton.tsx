import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, TouchableOpacity } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import type { NoteTarget } from '@/components/profile/HingeProfileCard';
import { homeColors, homeRadius, homeSpacing } from '@/lib/homeTheme';

// Real 44x44 touch target via hitSlop, not visual padding — 'onPhoto' has
// no visible box anymore (2026-09-17 brief: "koyu gri capsule arka planını
// kaldır"), so the touch area can't come from a large visible surface.
const ON_PHOTO_HIT_SLOP = { top: 12, bottom: 12, left: 14, right: 14 };

/**
 * Same contextual-like target contract the shared `likes` write path
 * already expects (see HingeProfileCard's NoteTarget) — only 'photo' and
 * 'prompt' targets are supported by the data model, matching the existing
 * behavior exactly (no new backend capability implied here).
 */
export function ContextualNoteButton({
  target,
  onPress,
  variant = 'onPhoto',
}: {
  target: NoteTarget;
  onPress: (target: NoteTarget) => void;
  /** 'onPhoto' sits over a photo (no background, just white text/icon + shadow); 'onCard' sits on a white card (light pill). */
  variant?: 'onPhoto' | 'onCard';
}) {
  const isOnCard = variant === 'onCard';
  return (
    <TouchableOpacity
      style={[styles.btn, isOnCard ? styles.btnOnCard : styles.btnOnPhoto]}
      onPress={() => onPress(target)}
      activeOpacity={0.85}
      hitSlop={isOnCard ? undefined : ON_PHOTO_HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel={`Leave a note on ${target.label}`}>
      <Ionicons
        name="chatbubble-ellipses-outline"
        size={isOnCard ? 14 : 17}
        color={isOnCard ? homeColors.accent : '#FFFFFF'}
        style={isOnCard ? undefined : styles.iconShadow}
      />
      <ThemedText style={isOnCard ? styles.textOnCard : styles.textOnPhoto}>Note</ThemedText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: homeSpacing.xs,
  },
  // No background, border, or pill anymore — plain white icon + text
  // directly on the photo (2026-09-17 brief), readability comes entirely
  // from the text/icon shadow, matching how the name/location text below
  // it already reads on any photo without a surface behind it.
  btnOnPhoto: {},
  btnOnCard: {
    paddingHorizontal: homeSpacing.md,
    paddingVertical: homeSpacing.xs + 3,
    borderRadius: homeRadius.pill,
    backgroundColor: homeColors.accentSoft,
  },
  textOnPhoto: {
    fontSize: 16.5,
    fontWeight: '600',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  textOnCard: { fontSize: 13, fontWeight: '700', color: homeColors.accent },
  iconShadow: {
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
});
