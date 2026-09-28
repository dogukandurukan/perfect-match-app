// Section 7.1 Add your photos (P07). Library photos stay local URIs picked by
// the user (expo-image-picker, already in the development build). Nothing is
// uploaded, copied to permanent storage or logged.
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActionSheetIOS, Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { obColors, obFonts, obSpacing } from '@/lib/onboardingV2/theme';
import {
  MAX_PHOTOS,
  addPhotos,
  makeMainPhoto,
  markPhotoBroken,
  movePhoto,
  newPhotoId,
  removePhoto,
  replacePhoto,
  usablePhotos,
  type LocalPhoto,
  type ProfileDraft,
} from '@/lib/onboardingV2/yourProfile';

type Props = {
  draft: ProfileDraft;
  update: (patch: Partial<ProfileDraft>) => void;
};

function toLocalPhotos(assets: ImagePicker.ImagePickerAsset[]): LocalPhoto[] {
  return assets
    .filter((a) => !!a.uri && (a.type === undefined || a.type === null || a.type === 'image'))
    .map((a) => ({ id: newPhotoId(), uri: a.uri, width: a.width, height: a.height }));
}

type PickResult = { photos: LocalPhoto[] } | { error: string } | null;

/** Opens the system photo picker. null = cancelled (nothing changes). */
async function pickFromLibrary(limit: number): Promise<PickResult> {
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: limit > 1,
      selectionLimit: limit,
      orderedSelection: true,
      quality: 1,
      exif: false,
    });
    if (result.canceled) return null;
    const photos = toLocalPhotos(result.assets ?? []);
    if (!photos.length) return { error: "Those items couldn't be used. Choose photos instead." };
    return { photos };
  } catch {
    return { error: "Your photos couldn't be opened. Check photo access in Settings and try again." };
  }
}

function chooseAction(title: string, options: { label: string; destructive?: boolean; run: () => void }[]) {
  if (Platform.OS === 'ios') {
    const labels = [...options.map((o) => o.label), 'Cancel'];
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title,
        options: labels,
        cancelButtonIndex: labels.length - 1,
        destructiveButtonIndex: options.findIndex((o) => o.destructive),
      },
      (i) => options[i]?.run(),
    );
    return;
  }
  Alert.alert(title, undefined, [
    ...options.map((o) => ({ text: o.label, onPress: o.run, style: o.destructive ? ('destructive' as const) : undefined })),
    { text: 'Cancel', style: 'cancel' as const },
  ]);
}

export function PhotosFields({ draft, update }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const photos = draft.photos;
  const usable = usablePhotos(photos).length;

  const addMore = async () => {
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0 || busy) return;
    setBusy(true);
    const r = await pickFromLibrary(room);
    setBusy(false);
    if (!r) return;
    if ('error' in r) return setError(r.error);
    setError(null);
    update({ photos: addPhotos(photos, r.photos) });
  };

  const replace = async (id: string) => {
    if (busy) return;
    setBusy(true);
    const r = await pickFromLibrary(1);
    setBusy(false);
    if (!r) return;
    if ('error' in r) return setError(r.error);
    setError(null);
    update({ photos: replacePhoto(photos, id, r.photos[0]) });
  };

  const actions = (p: LocalPhoto, index: number) => {
    const opts: { label: string; destructive?: boolean; run: () => void }[] = [];
    if (index > 0) opts.push({ label: 'Make main photo', run: () => update({ photos: makeMainPhoto(photos, p.id) }) });
    if (index > 0) opts.push({ label: 'Move earlier', run: () => update({ photos: movePhoto(photos, p.id, -1) }) });
    if (index < photos.length - 1)
      opts.push({ label: 'Move later', run: () => update({ photos: movePhoto(photos, p.id, 1) }) });
    opts.push({ label: 'Replace photo', run: () => void replace(p.id) });
    opts.push({ label: 'Remove photo', destructive: true, run: () => update({ photos: removePhoto(photos, p.id) }) });
    return opts;
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.grid}>
        {Array.from({ length: MAX_PHOTOS }).map((_, i) => {
          const p = photos[i];
          if (!p) {
            const first = i === photos.length;
            return (
              <TouchableOpacity
                key={`empty-${i}`}
                onPress={addMore}
                disabled={busy}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={first ? 'Add photos' : `Empty photo slot ${i + 1}, add photos`}
                style={[styles.slot, styles.empty]}>
                <Ionicons name="add" size={28} color={obColors.cta} />
              </TouchableOpacity>
            );
          }
          const opts = actions(p, i);
          const label = `${i === 0 ? 'Main photo' : `Photo ${i + 1}`}${p.broken ? ", couldn't load" : ''}`;
          return (
            <View key={p.id} style={styles.slot}>
              <TouchableOpacity
                onPress={() => chooseAction(label, opts)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityHint="Opens options to reorder, replace or remove"
                accessibilityActions={opts.map((o) => ({ name: o.label, label: o.label }))}
                onAccessibilityAction={(e) => opts.find((o) => o.label === e.nativeEvent.actionName)?.run()}
                style={StyleSheet.absoluteFill}>
                {p.broken ? (
                  <View style={styles.broken}>
                    <Ionicons name="image-outline" size={22} color={obColors.textSecondary} />
                    <Text style={styles.brokenText} maxFontSizeMultiplier={1.4}>
                      Couldn&apos;t load. Tap to replace.
                    </Text>
                  </View>
                ) : (
                  <Image
                    source={{ uri: p.uri }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    onError={() => update({ photos: markPhotoBroken(photos, p.id) })}
                    accessible={false}
                  />
                )}
              </TouchableOpacity>
              {i === 0 ? (
                <View style={styles.mainTag} pointerEvents="none">
                  <Text style={styles.mainTagText} maxFontSizeMultiplier={1.3}>
                    Main photo
                  </Text>
                </View>
              ) : null}
              <TouchableOpacity
                onPress={() => update({ photos: removePhoto(photos, p.id) })}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${i === 0 ? 'main photo' : `photo ${i + 1}`}`}
                style={styles.remove}>
                <Ionicons name="close" size={16} color={obColors.textPrimary} />
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
      <Text style={styles.count} accessibilityLiveRegion="polite" maxFontSizeMultiplier={1.6}>
        {usable} of {MAX_PHOTOS} added
        {photos.length > 0 ? ' · Tap a photo to reorder, replace or remove.' : ''}
      </Text>
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite" maxFontSizeMultiplier={1.6}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: obSpacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: obSpacing.md,
  },
  slot: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: obColors.notice,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: obColors.border,
  },
  broken: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: obSpacing.xs,
    padding: obSpacing.sm,
  },
  brokenText: {
    fontFamily: obFonts.body,
    fontSize: 13,
    lineHeight: 18,
    color: obColors.textSecondary,
    textAlign: 'center',
  },
  mainTag: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    backgroundColor: 'rgba(31,58,46,0.88)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  mainTagText: {
    fontFamily: obFonts.bodySemiBold,
    fontSize: 12,
    lineHeight: 16,
    color: obColors.onCta,
  },
  remove: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: {
    fontFamily: obFonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: obColors.textSecondary,
  },
  error: {
    fontFamily: obFonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: obColors.error,
  },
});
