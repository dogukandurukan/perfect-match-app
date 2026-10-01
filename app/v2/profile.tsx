// A V2 member's full public profile (approved preview design), reached from
// the Profile tab ("View profile"). Same data path as Home: get_profile_v2.
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PublicProfileView } from '@/components/onboarding-v2/PublicProfileView';
import { obColors, obFonts, obSpacing } from '@/lib/onboardingV2/theme';

export default function V2ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userId } = useLocalSearchParams<{ userId?: string }>();
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back" style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={obColors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.4}>
          Profile
        </Text>
        <View style={styles.back} />
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + obSpacing.xl }}>
        {userId ? <PublicProfileView userId={String(userId)} /> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: obColors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: obSpacing.lg, minHeight: 48 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: obFonts.heading, fontSize: 22, lineHeight: 28, color: obColors.textPrimary },
});
