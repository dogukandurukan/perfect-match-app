import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { ContextualNoteButton } from '@/components/home/ContextualNoteButton';
import type { NoteTarget } from '@/components/profile/HingeProfileCard';
import { homeColors, homeRadius, homeSpacing } from '@/lib/homeTheme';

/** A non-hero photo further down the editorial scroll — smaller card, same Note affordance. */
export function SecondaryPhotoCard({
  uri,
  index,
  onNoteTarget,
}: {
  uri: string;
  index: number;
  onNoteTarget?: (target: NoteTarget) => void;
}) {
  return (
    <View style={styles.wrap}>
      <Image source={{ uri }} style={styles.photo} contentFit="cover" transition={150} />
      {onNoteTarget ? (
        <View style={styles.noteWrap}>
          <ContextualNoteButton
            target={{ type: 'photo', key: `photo-${index}`, label: 'this photo' }}
            onPress={onNoteTarget}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: homeSpacing.lg,
    marginTop: homeSpacing.lg,
    borderRadius: homeRadius.card,
    overflow: 'hidden',
    aspectRatio: 1.05,
    backgroundColor: homeColors.mutedSurface,
  },
  photo: { ...StyleSheet.absoluteFillObject },
  noteWrap: { position: 'absolute', right: homeSpacing.md, bottom: homeSpacing.md },
});
