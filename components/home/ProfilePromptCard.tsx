import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ContextualNoteButton } from '@/components/home/ContextualNoteButton';
import type { NoteTarget } from '@/components/profile/HingeProfileCard';
import type { PromptCard } from '@/lib/hingeProfile';
import { homeColors, homeRadius, homeShadow, homeSpacing } from '@/lib/homeTheme';

export function ProfilePromptCard({
  card,
  onNoteTarget,
}: {
  card: PromptCard;
  onNoteTarget?: (target: NoteTarget) => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <ThemedText style={styles.label}>{card.title.toUpperCase()}</ThemedText>
        {onNoteTarget ? (
          <ContextualNoteButton
            variant="onCard"
            target={{ type: 'prompt', key: card.id, label: card.title }}
            onPress={onNoteTarget}
          />
        ) : null}
      </View>
      <ThemedText style={styles.answer}>{card.answer}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: homeSpacing.lg,
    marginTop: homeSpacing.lg,
    padding: homeSpacing.lg,
    borderRadius: homeRadius.card,
    backgroundColor: homeColors.surface,
    borderWidth: 1,
    borderColor: homeColors.border,
    ...homeShadow,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: homeSpacing.sm,
    gap: homeSpacing.sm,
  },
  label: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: homeColors.textSecondary,
    flexShrink: 1,
  },
  answer: {
    fontSize: 20,
    lineHeight: 27,
    fontWeight: '600',
    color: homeColors.textPrimary,
  },
});
