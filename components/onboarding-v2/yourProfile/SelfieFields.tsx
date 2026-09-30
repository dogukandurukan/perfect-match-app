// Section 7.4 A quick selfie (P07). Front-camera capture through the system
// camera (expo-image-picker, already in the development build). The photo is
// kept only as a local URI in memory: not uploaded, not reviewed, not saved to
// the photo library, never shown on the public profile. No face recognition.
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { DevNotice } from '@/components/onboarding-v2/yourProfile/ProfilePreview';
import { obColors, obFonts, obSpacing } from '@/lib/onboardingV2/theme';

export type SelfieError = { message: string; openSettings?: boolean };
export type CaptureResult = { uri: string } | { error: SelfieError } | null;

/** Asks for camera access on the user's tap, then opens the front camera.
 * null = cancelled. Errors are returned, never thrown. */
export async function captureSelfie(): Promise<CaptureResult> {
  try {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      return {
        error: {
          message: 'Camera access is off. Allow it in Settings to take your selfie.',
          openSettings: true,
        },
      };
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      cameraType: ImagePicker.CameraType.front,
      allowsEditing: false,
      quality: 0.8,
      exif: false,
    });
    if (result.canceled) return null;
    const uri = result.assets?.[0]?.uri;
    if (!uri) return { error: { message: "The photo couldn't be read. Try again." } };
    return { uri };
  } catch {
    return { error: { message: "The camera isn't available on this device, so the selfie can't be taken here." } };
  }
}

type Props = {
  /** Selfie already chosen for the draft. */
  selfieUri: string | null;
  /** Freshly captured, not yet confirmed with "Use selfie". */
  candidateUri: string | null;
  error: SelfieError | null;
  /** Live mode: a selfie is already stored server-side. It can't be read back
   * (private), so show "Selfie received" instead of an empty frame. */
  savedPrivately?: boolean;
};

export function SelfieFields({ selfieUri, candidateUri, error, savedPrivately = false }: Props) {
  const shown = candidateUri ?? selfieUri;
  const received = !shown && savedPrivately;
  return (
    <View style={styles.wrap}>
      <View
        style={styles.oval}
        accessible
        accessibilityLabel={shown ? 'Your selfie preview' : received ? 'Selfie received' : 'Selfie frame'}>
        {shown ? (
          <Image source={{ uri: shown }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : received ? (
          <View style={styles.received}>
            <Ionicons name="checkmark-circle" size={56} color={obColors.cta} importantForAccessibility="no" />
            <Text style={styles.receivedText} maxFontSizeMultiplier={1.4}>
              Selfie received
            </Text>
          </View>
        ) : (
          <Ionicons name="person-outline" size={72} color={obColors.border} importantForAccessibility="no" />
        )}
      </View>
      <View style={styles.copy}>
        <Text style={styles.strong} maxFontSizeMultiplier={1.6}>
          Your selfie stays private.
        </Text>
        <Text style={styles.text} maxFontSizeMultiplier={1.6}>
          We&apos;ll review it with your profile photos.
        </Text>
      </View>
      {candidateUri ? (
        <Text style={styles.text} maxFontSizeMultiplier={1.6}>
          Happy with it? Use it or take it again.
        </Text>
      ) : null}
      {error ? (
        <View style={styles.errorBox} accessibilityLiveRegion="polite">
          <Text style={styles.error} maxFontSizeMultiplier={1.6}>
            {error.message}
          </Text>
          {error.openSettings ? (
            <TouchableOpacity
              onPress={() => void Linking.openSettings()}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Open Settings">
              <Text style={styles.link} maxFontSizeMultiplier={1.4}>
                Open Settings
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
      <DevNotice text="Preview only — this selfie is not uploaded or reviewed." />
    </View>
  );
}

const styles = StyleSheet.create({
  received: { alignItems: 'center', justifyContent: 'center', gap: 8 },
  receivedText: { fontFamily: obFonts.bodySemiBold, fontSize: 16, lineHeight: 22, color: obColors.textPrimary },
  wrap: {
    gap: obSpacing.lg,
    alignItems: 'stretch',
  },
  oval: {
    alignSelf: 'center',
    width: '72%',
    aspectRatio: 0.78,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#CDBE9C',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: obColors.notice,
  },
  copy: {
    alignItems: 'center',
    gap: 2,
  },
  strong: {
    fontFamily: obFonts.bodySemiBold,
    fontSize: 15,
    lineHeight: 21,
    color: obColors.textPrimary,
    textAlign: 'center',
  },
  text: {
    fontFamily: obFonts.body,
    fontSize: 15,
    lineHeight: 21,
    color: obColors.textSecondary,
    textAlign: 'center',
  },
  errorBox: {
    gap: obSpacing.xs,
    alignItems: 'center',
  },
  error: {
    fontFamily: obFonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: obColors.error,
    textAlign: 'center',
  },
  link: {
    fontFamily: obFonts.bodySemiBold,
    fontSize: 15,
    lineHeight: 20,
    color: obColors.cta,
    textDecorationLine: 'underline',
  },
});
