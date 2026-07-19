import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

type HomeTopIconProps = {
  /**
   * Varsayılan olarak landing ekranına (/(tabs)) döner.
   * İstersen başka bir route verebilirsin.
   */
  to?: string;
};

export function HomeTopIcon({ to = '/(tabs)' }: HomeTopIconProps) {
  const router = useRouter();

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => router.replace(to)}
        hitSlop={12}
        style={styles.button}>
        <Ionicons name="home-outline" size={22} color="#C9A96E" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    alignItems: 'center',
    marginTop: 4,
  },
  button: {
    height: 40,
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#1C2030',
  },
});

