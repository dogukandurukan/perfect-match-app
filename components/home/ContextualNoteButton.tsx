import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, TouchableOpacity } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import type { NoteTarget } from '@/components/profile/HingeProfileCard';
import { homeColors, homeRadius, homeSpacing } from '@/lib/homeTheme';

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
  /** 'onPhoto' sits over a photo (dark pill); 'onCard' sits on a white card (light pill). */
  variant?: 'onPhoto' | 'onCard';
}) {
  return (
    <TouchableOpacity
      style={[styles.btn, variant === 'onCard' && styles.btnOnCard]}
      onPress={() => onPress(target)}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`Leave a note on ${target.label}`}>
      <Ionicons
        name="chatbubble-ellipses-outline"
        size={14}
        color={variant === 'onCard' ? homeColors.accent : '#FFFFFF'}
      />
      <ThemedText style={[styles.text, variant === 'onCard' && styles.textOnCard]}>Note</ThemedText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: homeSpacing.xs,
    paddingHorizontal: homeSpacing.md,
    paddingVertical: homeSpacing.xs + 3,
    borderRadius: homeRadius.pill,
    backgroundColor: 'rgba(23,23,23,0.55)',
  },
  btnOnCard: {
    backgroundColor: homeColors.accentSoft,
  },
  text: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  textOnCard: { color: homeColors.accent },
});
