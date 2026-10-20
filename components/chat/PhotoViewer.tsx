// V2 chat: full-screen photo viewer (whole photo, aspect ratio kept, dark
// background, × to close; Android back closes too).
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { Modal, Pressable, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function PhotoViewer({ url, onClose }: { url: string | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={!!url} animationType="fade" onRequestClose={onClose} presentationStyle="fullScreen">
      <StatusBar style="light" />
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close photo">
          {url ? <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="contain" accessible={false} /> : null}
        </Pressable>
        <TouchableOpacity onPress={onClose} hitSlop={10} style={[styles.close, { top: insets.top + 8 }]}
          accessibilityRole="button" accessibilityLabel="Close">
          <Ionicons name="close" size={26} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  close: { position: 'absolute', right: 12, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)' },
});
