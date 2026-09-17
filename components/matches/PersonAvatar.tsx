import { Image } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { homeColors } from '@/lib/homeTheme';

/**
 * Real photo, or a neutral initials placeholder — never a random third-party
 * avatar (pravatar.cc etc). 2026-09-18 Matches redesign brief: "Missing
 * photo durumunda çocuk veya rastgele üçüncü taraf avatar gösterme...
 * neutral initials placeholder oluştur." `photoUrl` is expected to already
 * be null/undefined for a genuinely missing photo (see matches.tsx's
 * `photoFor` — no longer falls back to pravatar.cc itself).
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

  if (photoUrl) {
    return (
      <Image
        source={{ uri: photoUrl }}
        // ViewStyle/ImageStyle differ only in `overflow`'s type strictness
        // here, not in any actually-incompatible runtime prop — safe cast.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        style={[{ width: size, height: size, borderRadius: r }, style] as any}
        contentFit="cover"
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        { width: size, height: size, borderRadius: r },
        style,
      ]}>
      <ThemedText style={[styles.initial, { fontSize: size * 0.38 }]}>{initial}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: homeColors.mutedSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    fontWeight: '700',
    color: homeColors.textSecondary,
  },
});
