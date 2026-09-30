// Section 7.1 Add your photos (P07 R2). Six fixed slots, 3 × 2 on a standard
// phone (2 columns on narrow screens / accessibility text sizes). Tap an empty
// slot to add, tap a photo to preview it (Replace / Remove / Make main / Move),
// hold and drag a photo to reorder. Library photos stay local URIs picked by
// the user (expo-image-picker, already in the dev build) — nothing uploaded.
//
// Sizes are explicit points computed from the screen width (no percentage +
// aspectRatio inside a wrapping row — the R1 root cause). Every edit goes
// through updatePhotos(fn) so late callbacks never write a stale list.
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { LinearTransition, runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useScrollLock } from '@/components/onboarding-v2/OnboardingScrollContext';
import {
  dragTargetIndex,
  gridGeometry,
  gridHeight,
  slotXY,
  type Geometry,
} from '@/lib/onboardingV2/photoGrid';
import { obColors, obFonts, obSpacing } from '@/lib/onboardingV2/theme';
import {
  MAX_PHOTOS,
  MIN_PHOTOS,
  addPhotosDetailed,
  clearPhotoBroken,
  makeMainPhoto,
  markPhotoBroken,
  movePhoto,
  movePhotoTo,
  newPhotoId,
  removePhoto,
  replacePhoto,
  usablePhotos,
  type LocalPhoto,
  type PhotoUpdater,
} from '@/lib/onboardingV2/yourProfile';

type Props = {
  photos: LocalPhoto[];
  updatePhotos: (fn: PhotoUpdater) => void;
  /** Live mode: photos without a server id are marked "Not saved yet" and
   * this line reports the save state (saving / saved / not saved + why). */
  live?: { status: string | null; statusIsError?: boolean };
};

const LONG_PRESS_MS = 280;

function toLocalPhotos(assets: ImagePicker.ImagePickerAsset[]): LocalPhoto[] {
  return assets
    .filter((a) => !!a.uri && (a.type === undefined || a.type === null || a.type === 'image'))
    .map((a) => ({
      id: newPhotoId(),
      uri: a.uri,
      assetId: a.assetId ?? null,
      width: a.width,
      height: a.height,
    }));
}

type PickResult = { photos: LocalPhoto[] } | { error: string } | null;

/** System photo picker. null = cancelled (nothing changes). Multi-select only
 * when more than one slot is free; never combined with cropping (iOS ignores
 * allowsEditing with multiple selection). */
async function pickFromLibrary(limit: number): Promise<PickResult> {
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: limit > 1,
      selectionLimit: limit,
      orderedSelection: true,
      allowsEditing: false,
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

function PhotoTile({
  photo,
  index,
  count,
  geometry,
  retryKey,
  onOpen,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onBroken,
  onAction,
  unsaved = false,
}: {
  unsaved?: boolean;
  photo: LocalPhoto;
  index: number;
  count: number;
  geometry: Geometry;
  retryKey: number;
  onOpen: (id: string) => void;
  onDragStart: (index: number) => void;
  onDragOver: (target: number) => void;
  onDrop: (id: string, target: number) => void;
  onDragEnd: () => void;
  onBroken: (id: string) => void;
  onAction: (id: string, action: string) => void;
}) {
  const { tileW, tileH } = geometry;
  const origin = slotXY(index, geometry);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const dragging = useSharedValue(false);
  const target = useSharedValue(index);
  const id = photo.id;

  // Hold (LONG_PRESS_MS) then drag; a quick tap opens the preview instead.
  const pan = Gesture.Pan()
    .activateAfterLongPress(LONG_PRESS_MS)
    .onStart(() => {
      dragging.value = true;
      target.value = index;
      runOnJS(onDragStart)(index);
    })
    .onUpdate((e) => {
      tx.value = e.translationX;
      ty.value = e.translationY;
      const t = dragTargetIndex(index, e.translationX, e.translationY, geometry, count);
      if (t !== target.value) {
        target.value = t;
        runOnJS(onDragOver)(t);
      }
    })
    .onEnd(() => {
      runOnJS(onDrop)(id, target.value);
    })
    .onFinalize(() => {
      tx.value = 0;
      ty.value = 0;
      dragging.value = false;
      runOnJS(onDragEnd)();
    });
  const tap = Gesture.Tap()
    .maxDuration(LONG_PRESS_MS + 150)
    .onEnd((_e, success) => {
      if (success) runOnJS(onOpen)(id);
    });
  const gesture = Gesture.Exclusive(pan, tap);

  const lifted = useAnimatedStyle(() => ({
    zIndex: dragging.value ? 20 : 1,
    shadowOpacity: dragging.value ? 0.25 : 0,
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: dragging.value ? 1.06 : 1 }],
  }));

  const label = index === 0 ? `Main photo, 1 of ${count}` : `Photo ${index + 1} of ${count}`;
  const actions = [
    { name: 'activate', label: 'Preview photo' },
    ...(index > 0
      ? [
          { name: 'main', label: 'Make main photo' },
          { name: 'earlier', label: 'Move earlier' },
        ]
      : []),
    ...(index < count - 1 ? [{ name: 'later', label: 'Move later' }] : []),
    { name: 'replace', label: 'Replace photo' },
    { name: 'remove', label: 'Remove photo' },
  ];

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        layout={LinearTransition.duration(180)}
        accessible
        accessibilityRole="imagebutton"
        accessibilityLabel={`${photo.broken ? `${label}, couldn't load` : label}${unsaved ? ', not saved yet' : ''}`}
        accessibilityHint="Opens the photo. Hold and drag to reorder."
        accessibilityActions={actions}
        onAccessibilityAction={(e) =>
          e.nativeEvent.actionName === 'activate' ? onOpen(id) : onAction(id, e.nativeEvent.actionName)
        }
        style={[styles.tile, { left: origin.x, top: origin.y, width: tileW, height: tileH }, lifted]}>
        {photo.broken ? (
          <View style={styles.broken}>
            <Ionicons name="alert-circle-outline" size={22} color={obColors.error} />
            <Text style={styles.brokenText} maxFontSizeMultiplier={1.3}>
              Couldn&apos;t load
            </Text>
          </View>
        ) : (
          <Image
            key={`${id}-${retryKey}`}
            source={{ uri: photo.uri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            onError={() => onBroken(id)}
            accessible={false}
          />
        )}
        {unsaved ? (
          <View style={styles.unsavedTag} pointerEvents="none" accessibilityElementsHidden>
            <Ionicons name="cloud-upload-outline" size={13} color="#FFFFFF" />
            <Text style={styles.unsavedTagText} maxFontSizeMultiplier={1.2}>
              Not saved yet
            </Text>
          </View>
        ) : null}
        {index === 0 ? (
          <View style={styles.mainTag} pointerEvents="none">
            <Text style={styles.mainTagText} maxFontSizeMultiplier={1.2}>
              Main photo
            </Text>
          </View>
        ) : null}
      </Animated.View>
    </GestureDetector>
  );
}

export function PhotosFields({ photos, updatePhotos, live }: Props) {
  const { width, fontScale } = useWindowDimensions();
  const geometry = gridGeometry(width, fontScale);
  const insets = useSafeAreaInsets();
  const setScrollLock = useScrollLock();
  const pickingRef = useRef(false);
  const [picking, setPicking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [dragTarget, setDragTarget] = useState<number | null>(null);
  const [retry, setRetry] = useState<Record<string, number>>({});

  const usable = usablePhotos(photos).length;
  const gridH = gridHeight(MAX_PHOTOS, geometry);
  const open = photos.find((p) => p.id === openId) ?? null;
  const openIndex = open ? photos.indexOf(open) : -1;
  // Keep the last title while the sheet slides out (after Remove the photo
  // is already gone, which would otherwise read "Photo 0 of N").
  const sheetTitle = useRef('');
  if (open) sheetTitle.current = openIndex === 0 ? 'Main photo' : `Photo ${openIndex + 1} of ${photos.length}`;
  const targetXY = dragTarget !== null ? slotXY(dragTarget, geometry) : null;

  // One picker at a time — a ref, so two taps in the same frame can't both pass.
  const withPicker = async (limit: number): Promise<PickResult> => {
    if (pickingRef.current || limit <= 0) return null;
    pickingRef.current = true;
    setPicking(true);
    try {
      return await pickFromLibrary(limit);
    } finally {
      pickingRef.current = false;
      setPicking(false);
    }
  };

  const addMore = async () => {
    const r = await withPicker(MAX_PHOTOS - photos.length);
    if (!r) return;
    if ('error' in r) return setError(r.error);
    setError(null);
    const counts = addPhotosDetailed(photos, r.photos); // for the notice only
    updatePhotos((list) => addPhotosDetailed(list, r.photos).list);
    const parts = [];
    if (counts.duplicates) parts.push(`${counts.duplicates} already added`);
    if (counts.overflow) parts.push(`${counts.overflow} over the limit of ${MAX_PHOTOS}`);
    setNotice(parts.length ? `Skipped: ${parts.join(', ')}.` : null);
  };

  const replace = async (id: string) => {
    const r = await withPicker(1);
    if (!r) return;
    if ('error' in r) return setError(r.error);
    setError(null);
    const next = r.photos[0];
    if (next.assetId && photos.some((p) => p.id !== id && p.assetId === next.assetId)) {
      setNotice('That photo is already added.');
      return;
    }
    setNotice(null);
    // The new photo keeps the slot's id, so its position and the open preview stay.
    updatePhotos((list) => replacePhoto(list, id, { ...next, id }));
    setRetry((m) => ({ ...m, [id]: (m[id] ?? 0) + 1 }));
  };

  const act = (id: string, action: string) => {
    if (action === 'main') updatePhotos((l) => makeMainPhoto(l, id));
    if (action === 'earlier') updatePhotos((l) => movePhoto(l, id, -1));
    if (action === 'later') updatePhotos((l) => movePhoto(l, id, 1));
    if (action === 'replace') void replace(id);
    if (action === 'remove') {
      updatePhotos((l) => removePhoto(l, id));
      setOpenId(null);
    }
    if (action === 'retry') {
      updatePhotos((l) => clearPhotoBroken(l, id));
      setRetry((m) => ({ ...m, [id]: (m[id] ?? 0) + 1 }));
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={{ height: gridH }}>
        {targetXY ? (
          <View
            pointerEvents="none"
            style={[
              styles.dropTarget,
              { left: targetXY.x, top: targetXY.y, width: geometry.tileW, height: geometry.tileH },
            ]}
          />
        ) : null}
        {Array.from({ length: MAX_PHOTOS }).map((_, i) => {
          const p = photos[i];
          if (p) {
            return (
              <PhotoTile
                key={p.id}
                photo={p}
                index={i}
                count={photos.length}
                geometry={geometry}
                retryKey={retry[p.id] ?? 0}
                onOpen={setOpenId}
                onDragStart={(from) => {
                  setScrollLock(true);
                  setDragTarget(from);
                }}
                onDragOver={setDragTarget}
                onDrop={(id, t) => updatePhotos((l) => movePhotoTo(l, id, t))}
                onDragEnd={() => {
                  setDragTarget(null);
                  setScrollLock(false);
                }}
                onBroken={(id) => updatePhotos((l) => markPhotoBroken(l, id))}
                onAction={act}
                unsaved={!!live && !p.serverId}
              />
            );
          }
          const xy = slotXY(i, geometry);
          return (
            <TouchableOpacity
              key={`empty-${i}`}
              onPress={addMore}
              disabled={picking}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Add photos, slot ${i + 1} of ${MAX_PHOTOS}`}
              accessibilityState={{ disabled: picking }}
              style={[styles.empty, { left: xy.x, top: xy.y, width: geometry.tileW, height: geometry.tileH }]}>
              <Ionicons name="add" size={26} color={obColors.cta} />
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.count} accessibilityLiveRegion="polite" maxFontSizeMultiplier={1.6}>
        {usable} of {MAX_PHOTOS} photos{usable < MIN_PHOTOS ? ` · add at least ${MIN_PHOTOS}` : ''}
      </Text>
      {photos.length > 0 ? (
        <Text style={styles.hint} maxFontSizeMultiplier={1.6}>
          Tap a photo to preview it. Hold and drag to reorder.
        </Text>
      ) : null}
      {live?.status ? (
        <Text
          style={[styles.liveStatus, live.statusIsError && styles.liveStatusError]}
          accessibilityLiveRegion="polite"
          maxFontSizeMultiplier={1.6}>
          {live.status}
        </Text>
      ) : null}
      {notice ? (
        <Text style={styles.hint} accessibilityLiveRegion="polite" maxFontSizeMultiplier={1.6}>
          {notice}
        </Text>
      ) : null}
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite" maxFontSizeMultiplier={1.6}>
          {error}
        </Text>
      ) : null}

      <Modal visible={!!open} animationType="slide" onRequestClose={() => setOpenId(null)}>
        <View
          style={[
            styles.sheet,
            { paddingTop: insets.top + obSpacing.sm, paddingBottom: Math.max(insets.bottom, obSpacing.lg) },
          ]}>
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle} accessibilityRole="header" maxFontSizeMultiplier={1.4}>
              {sheetTitle.current}
            </Text>
            <Pressable onPress={() => setOpenId(null)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
              <Ionicons name="close" size={26} color={obColors.textPrimary} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.sheetBody}>
            {open ? (
              open.broken ? (
                <View style={[styles.large, styles.broken]}>
                  <Ionicons name="alert-circle-outline" size={30} color={obColors.error} />
                  <Text style={styles.brokenText} maxFontSizeMultiplier={1.4}>
                    This photo couldn&apos;t be loaded.
                  </Text>
                </View>
              ) : (
                <Image
                  key={`${open.id}-${retry[open.id] ?? 0}-large`}
                  source={{ uri: open.uri }}
                  style={styles.large}
                  contentFit="cover"
                  accessibilityLabel="Selected photo"
                />
              )
            ) : null}
            {open ? (
              <View style={styles.actions}>
                {open.broken ? <SheetAction icon="refresh" label="Try again" onPress={() => act(open.id, 'retry')} /> : null}
                {openIndex > 0 ? (
                  <SheetAction icon="star-outline" label="Make main photo" onPress={() => act(open.id, 'main')} />
                ) : null}
                <View style={styles.moveRow}>
                  <SheetAction
                    icon="arrow-back"
                    label="Move earlier"
                    disabled={openIndex <= 0}
                    onPress={() => act(open.id, 'earlier')}
                  />
                  <SheetAction
                    icon="arrow-forward"
                    label="Move later"
                    disabled={openIndex >= photos.length - 1}
                    onPress={() => act(open.id, 'later')}
                  />
                </View>
                <SheetAction
                  icon="images-outline"
                  label="Replace photo"
                  disabled={picking}
                  onPress={() => act(open.id, 'replace')}
                />
                <SheetAction icon="trash-outline" label="Remove photo" destructive onPress={() => act(open.id, 'remove')} />
              </View>
            ) : null}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function SheetAction({
  icon,
  label,
  onPress,
  disabled = false,
  destructive = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  const color = destructive ? obColors.error : obColors.cta;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={[styles.action, disabled && styles.actionDisabled]}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={[styles.actionText, { color }]} maxFontSizeMultiplier={1.5}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: obSpacing.sm,
  },
  tile: {
    position: 'absolute',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: obColors.notice,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
  },
  empty: {
    position: 'absolute',
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: obColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropTarget: {
    position: 'absolute',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: obColors.cta,
    backgroundColor: obColors.selectedFill,
  },
  unsavedTag: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(28,27,24,0.72)',
  },
  unsavedTagText: { color: '#FFFFFF', fontSize: 11, lineHeight: 14, fontFamily: obFonts.bodySemiBold },
  liveStatus: { marginTop: 10, fontSize: 14, lineHeight: 20, color: obColors.textSecondary, fontFamily: obFonts.body },
  liveStatusError: { color: obColors.error },
  broken: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: obSpacing.xs,
    padding: obSpacing.sm,
    backgroundColor: obColors.notice,
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
    left: 6,
    bottom: 6,
    backgroundColor: 'rgba(31,58,46,0.9)',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  mainTagText: {
    fontFamily: obFonts.bodySemiBold,
    fontSize: 11,
    lineHeight: 15,
    color: obColors.onCta,
  },
  count: {
    marginTop: obSpacing.xs,
    fontFamily: obFonts.bodyMedium,
    fontSize: 14,
    lineHeight: 20,
    color: obColors.textPrimary,
  },
  hint: {
    fontFamily: obFonts.body,
    fontSize: 13,
    lineHeight: 18,
    color: obColors.textSecondary,
  },
  error: {
    fontFamily: obFonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: obColors.error,
  },
  sheet: {
    flex: 1,
    backgroundColor: obColors.background,
    paddingHorizontal: obSpacing.gutter,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  sheetTitle: {
    fontFamily: obFonts.heading,
    fontSize: 22,
    lineHeight: 28,
    color: obColors.textPrimary,
  },
  sheetBody: {
    gap: obSpacing.lg,
    paddingTop: obSpacing.md,
    paddingBottom: obSpacing.xl,
  },
  large: {
    width: '100%',
    aspectRatio: 4 / 5,
    borderRadius: 14,
  },
  actions: {
    gap: obSpacing.sm,
  },
  moveRow: {
    flexDirection: 'row',
    gap: obSpacing.sm,
  },
  action: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: obSpacing.sm,
    paddingHorizontal: obSpacing.md,
    borderWidth: 1,
    borderColor: obColors.border,
    borderRadius: 12,
  },
  actionDisabled: {
    opacity: 0.4,
  },
  actionText: {
    fontFamily: obFonts.bodySemiBold,
    fontSize: 15,
    lineHeight: 20,
  },
});
