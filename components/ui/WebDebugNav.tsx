import { useRouter } from 'expo-router';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { colors } from '@/lib/designTokens';

export function WebDebugNav() {
  const router = useRouter();

  /** Web’de her zaman; native’de sadece __DEV__ (Setup ekranlarına hızlı geçiş). */
  if (Platform.OS !== 'web' && !__DEV__) return null;

  /** Query string ile push; `profile-setup/_layout` demo=1 + web URL ile gate bypass. */
  const go = (to: string) => {
    router.push(to as any);
  };

  return (
    <View style={styles.container} pointerEvents="box-none">
      <View style={styles.panel}>
        <Pressable style={styles.btn} onPress={() => go('/')}>
          <View style={styles.btnDot} />
          <ThemedText style={styles.btnLabel}>Home</ThemedText>
        </Pressable>

        <Pressable style={styles.btn} onPress={() => go('/login')}>
          <View style={styles.btnDot} />
          <ThemedText style={styles.btnLabel}>Login</ThemedText>
        </Pressable>

        <Pressable style={styles.btn} onPress={() => go('/register')}>
          <View style={styles.btnDot} />
          <ThemedText style={styles.btnLabel}>Sign up</ThemedText>
        </Pressable>

        <Pressable style={styles.btn} onPress={() => go('/profile-setup/step1?demo=1')}>
          <View style={styles.btnDot} />
          <ThemedText style={styles.btnLabel}>Setup-1</ThemedText>
        </Pressable>

        <Pressable style={styles.btn} onPress={() => go('/profile-setup/step2?demo=1')}>
          <View style={styles.btnDot} />
          <ThemedText style={styles.btnLabel}>Setup-2</ThemedText>
        </Pressable>

        <Pressable style={styles.btn} onPress={() => go('/profile-setup/step3?demo=1')}>
          <View style={styles.btnDot} />
          <ThemedText style={styles.btnLabel}>Setup-3</ThemedText>
        </Pressable>

        <Pressable style={styles.btn} onPress={() => go('/profile-setup/step4?demo=1')}>
          <View style={styles.btnDot} />
          <ThemedText style={styles.btnLabel}>Setup-4</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 12,
    top: 12,
    zIndex: 999,
  },
  panel: {
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: '#E5E5E5',
    borderRadius: 14,
    padding: 8,
    gap: 8,
  },
  btn: {
    width: 120,
    height: 30,
    borderRadius: 10,
    backgroundColor: colors.bgCard,
    borderWidth: 0.5,
    borderColor: '#E5E5E5',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 10,
  },
  btnDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: colors.accent,
  },
  btnLabel: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
});

