// Step1 screen 2/9 — photos.
import { useMemo } from 'react';
import { Alert, Dimensions, Platform, Pressable, View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { QuestionScreen } from '@/components/ui/QuestionScreen';
import { colors } from '@/lib/designTokens';
import { PHOTO_SLOTS, TOTAL_SCREENS, useStep1 } from '@/lib/onboardingStep1Context';

const PHOTO_SLOT_MAX = 96;

export default function Step1Photos() {
  const router = useRouter();
  const { photos, setPhotos } = useStep1();
  const windowWidth = Dimensions.get('window').width;

  const photoSlotSize = useMemo(() => {
    const cols = 3;
    const horizontalPadding = 24 * 2;
    const gaps = 10 * (cols - 1);
    const raw = Math.floor((windowWidth - horizontalPadding - gaps) / cols);
    return Math.max(72, Math.min(PHOTO_SLOT_MAX, raw));
  }, [windowWidth]);

  const photoCount = photos.filter(Boolean).length;
  const canProceed = Platform.OS === 'web' ? true : photoCount >= 1;

  const handlePickPhoto = async (slotIndex: number) => {
    if (Platform.OS === 'web') {
      Alert.alert('Photos', 'Photo picker is not available on web in this build.');
      return;
    }

    const ImagePicker = await import('expo-image-picker');
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission', 'Please allow photo library access.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (result.canceled || result.assets.length === 0) return;

    const uri = result.assets[0].uri;
    setPhotos((prev) => {
      const next = [...prev];
      // Tapping an empty tile always fills the first empty slot (keeps
      // photos compact, left-to-right, no gaps) — tapping an already-filled
      // tile still replaces that exact photo (found via device testing,
      // 2026-09-02: tapping a later empty tile before earlier ones left
      // scattered gaps).
      const targetIndex = prev[slotIndex] ? slotIndex : prev.findIndex((p) => p === null);
      if (targetIndex === -1) return prev;
      next[targetIndex] = uri;
      return next;
    });
  };

  return (
    <QuestionScreen
      step={2}
      totalSteps={TOTAL_SCREENS}
      title="Add your photos"
      subtitle={`Add at least one to continue — you can add up to ${PHOTO_SLOTS}.`}
      onNext={() => router.push('/profile-setup/step1/verify')}
      nextDisabled={!canProceed}>
      <View style={styles.grid}>
        {photos.map((uri, idx) => {
          const isFilled = !!uri;
          const firstEmptyIndex = photos.findIndex((p) => p === null);
          const showPlus = !isFilled && idx === firstEmptyIndex;
          return (
            <Pressable
              key={idx}
              style={[styles.tile, { width: photoSlotSize, height: photoSlotSize }]}
              onPress={() => handlePickPhoto(idx)}
              accessibilityRole="button">
              {isFilled ? (
                <Image source={{ uri }} style={styles.tileImage} />
              ) : showPlus ? (
                <ThemedText style={styles.plus}>+</ThemedText>
              ) : (
                <ThemedText style={styles.emptySlot}> </ThemedText>
              )}
            </Pressable>
          );
        })}
      </View>
    </QuestionScreen>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tile: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  tileImage: {
    width: '100%',
    height: '100%',
  },
  plus: {
    fontSize: 30,
    color: colors.accent,
    fontWeight: '700',
  },
  emptySlot: {
    color: '#E5E5E5',
    fontSize: 10,
  },
});
