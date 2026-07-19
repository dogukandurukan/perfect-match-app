// Screen: Tab header actions | Status: stable | Last updated: Haziran 2026
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

const ACCENT = '#B8860B';

/** Profil sekmesi tab bar'dan kaldırıldı; erişim header avatarıyla. */
export function TabHeaderActions() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.iconBtn}
        activeOpacity={0.7}
        onPress={() => router.push('/settings' as Parameters<typeof router.push>[0])}
        hitSlop={8}
        accessibilityLabel="Ayarlar">
        <Ionicons name="settings-outline" size={24} color={ACCENT} />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.iconBtn}
        activeOpacity={0.7}
        onPress={() => router.push('/(tabs)/profile' as Parameters<typeof router.push>[0])}
        hitSlop={8}
        accessibilityLabel="Profil">
        <Ionicons name="person-circle-outline" size={28} color={ACCENT} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    gap: 12,
  },
  iconBtn: {
    padding: 2,
  },
});
