import { Image } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { homeColors } from '@/lib/homeTheme';

/**
 * Real photo, or a neutral initials placeholder — never a random third-party
 * avatar (pravatar.cc etc). 2026-09-18 Matches redesign brief: "Missing
 * photo durumunda çocuk veya rastgele üçüncü taraf avatar gösterme...
 * neutral initials placeholder oluştur."
 *
 * 2026-09-18 (devam) — found live via DB query: the empty-array guard alone
 * wasn't enough. Most seed profiles (~500/502, per `seed.ts`) store a
 * `https://i.pravatar.cc/...` URL DIRECTLY as `photos[0]` — not an empty
 * array — and `getProfilePhotoPublicUrl` passes any http(s) URL through
 * unchanged, so those photos were never actually caught by the "missing"
 * check upstream. This is the single enforcement point instead (every
 * screen renders avatars through this component) — a pravatar.cc URL is
 * treated exactly like a missing photo, regardless of what any caller
 * passes in. Not a seed-data or shared-helper change — scoped here only.
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
  const isRandomAvatarService = !!photoUrl && photoUrl.includes('pravatar.cc');

  if (photoUrl && !isRandomAvatarService) {
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

  // Explicit lineHeight required — same bug this app already hit on
  // MatchesHeader's title and (originally) HingeProfileCard's name line:
  // ThemedText's inherited default lineHeight is too short for this large
  // a fontSize, clipping the top of the glyph so only its bottom curve
  // showed (found from a real device screenshot, 2026-09-18 — every
  // initials fallback rendered as an unreadable partial shape).
  const initialFontSize = size * 0.38;
  return (
    <View
      style={[
        styles.fallback,
        { width: size, height: size, borderRadius: r },
        style,
      ]}>
      <ThemedText style={[styles.initial, { fontSize: initialFontSize, lineHeight: initialFontSize * 1.2 }]}>
        {initial}
      </ThemedText>
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
