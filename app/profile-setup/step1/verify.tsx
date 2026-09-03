// Step1 screen 4/8 — get verified (optional, live-camera selfie only).
import { Alert, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { QuestionScreen } from '@/components/ui/QuestionScreen';
import { colors } from '@/lib/designTokens';
import { TOTAL_SCREENS, useStep1 } from '@/lib/onboardingStep1Context';

export default function Step1Verify() {
  const router = useRouter();
  const { selfieUri, setSelfieUri } = useStep1();

  const handleTakeSelfie = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Selfie', 'Camera is not available on web in this build.');
      return;
    }

    const ImagePicker = await import('expo-image-picker');
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission', 'Please allow camera access to verify yourself.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      cameraType: ImagePicker.CameraType.front,
    });

    if (result.canceled || result.assets.length === 0) return;
    setSelfieUri(result.assets[0].uri);
  };

  return (
    <QuestionScreen
      step={3}
      totalSteps={TOTAL_SCREENS}
      title="Get verified"
      subtitle="Optional — a quick selfie helps us confirm you're really you. Reviewed manually, never shared."
      onNext={() => router.push('/profile-setup/step1/name')}>
      <View style={styles.wrap}>
        {selfieUri ? (
          <Image source={{ uri: selfieUri }} style={styles.preview} />
        ) : (
          <View style={[styles.preview, styles.previewEmpty]}>
            <ThemedText style={styles.previewIcon}>🤳</ThemedText>
          </View>
        )}
        <TouchableOpacity
          style={styles.btn}
          onPress={handleTakeSelfie}
          accessibilityRole="button"
          accessibilityLabel={selfieUri ? 'Retake selfie' : 'Take a selfie'}>
          <ThemedText style={styles.btnText}>{selfieUri ? 'Retake selfie' : 'Take a selfie'}</ThemedText>
        </TouchableOpacity>
      </View>
    </QuestionScreen>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 20 },
  preview: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#EEEEEE',
  },
  previewEmpty: { alignItems: 'center', justifyContent: 'center' },
  previewIcon: { fontSize: 48 },
  btn: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  btnText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
});
