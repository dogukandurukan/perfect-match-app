import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { homeColors } from '@/lib/homeTheme';

/**
 * Real photo when there is one, initials fallback only when there genuinely
 * isn't a usable image. 2026-09-18 (devam 3, corrected): an earlier version
 * of this component ALSO treated any pravatar.cc URL as "missing" — that
 * was wrong. This app's current demo/seed data legitimately uses pravatar
 * URLs as the photo; they're real, reachable images (verified with curl —
 * Ceren/Sinem/Buse's URLs all return HTTP 200 image/jpeg). Domain-name
 * guessing isn't a signal of image validity, so it's gone. The only
 * fallback triggers now are: no URL at all, or the URL failed to actually
 * load (`onError`) — verified per-instance, not by inspecting the string.
 */
export function PersonAvatar({
  photoUrl,
  name,
  size,
  radius,
  style,
}: {
  photoUrl: string | null | undefined;
  name: string | null | undefined;
  size: number;
  /** Defaults to a full circle (size / 2). Pass a smaller value for a rounded-square look. */
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const r = radius ?? size / 2;
  const initial = (name?.trim()?.[0] ?? '?').toUpperCase();
  const [loadFailed, setLoadFailed] = useState(false);

  // A new photoUrl (e.g. this card now shows a different person after a
  // list re-render) deserves a fresh attempt — otherwise a previous
  // person's load failure would permanently hide this one's real photo.
  useEffect(() => {
    setLoadFailed(false);
  }, [photoUrl]);

  const showImage = !!photoUrl && !loadFailed;

  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: r }, style]}>
      {showImage ? (
        <Image
          source={{ uri: photoUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          onError={() => setLoadFailed(true)}
        />
      ) : (
        <View style={styles.fallback}>
          <ThemedText style={[styles.initial, { fontSize: size * 0.38, lineHeight: size * 0.38 * 1.2 }]}>
            {initial}
          </ThemedText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // overflow:hidden here (not on the Image itself) is what actually clips
  // both the real photo AND the fallback to the rounded shape — and, with
  // the fallback and the Image as siblings inside this one clipped box
  // instead of the caller juggling two differently-styled elements, there
  // is never a moment where both are visually present at once (the brief's
  // "placeholder fotoğrafın üzerinde kalmamalı" requirement) — `showImage`
  // switches which single child renders, nothing stacks.
  wrap: { overflow: 'hidden' },
  fallback: {
    flex: 1,
    backgroundColor: homeColors.mutedSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    fontWeight: '700',
    color: homeColors.textSecondary,
  },
});
