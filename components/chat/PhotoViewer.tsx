// V2 chat: full-screen photo viewer (whole photo, aspect ratio kept, dark
// background, × to close; Android back closes too). It resolves its own
// signed URL from the photo path (never reuses a possibly expired one from the
// bubble); a load error fetches a new URL once, then shows "Try again".
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { chatPhotoUrl } from '@/lib/chat/photoApi';

export function PhotoViewer({ path, onClose }: { path: string | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const autoRefreshed = useRef(false);

  useEffect(() => {
    autoRefreshed.current = false;
    setAttempt(0);
  }, [path]);

  useEffect(() => {
    if (!path) {
      setUrl(null);
      return;
    }
    let live = true;
    setFailed(false);
    setUrl(null);
    void chatPhotoUrl(path, { force: attempt > 0 }).then((u) => {
      if (!live) return;
      if (u) setUrl(u);
      else setFailed(true);
    });
    return () => {
      live = false;
    };
  }, [path, attempt]);

  const onLoadError = () => {
    if (!autoRefreshed.current) {
      autoRefreshed.current = true;
      setAttempt((n) => n + 1);
      return;
    }
    setFailed(true);
  };

  return (
    <Modal visible={!!path} animationType="fade" onRequestClose={onClose} presentationStyle="fullScreen">
      <StatusBar style="light" />
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close photo">
          {url && !failed ? (
            <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="contain" onError={onLoadError} accessible={false} />
          ) : null}
        </Pressable>
        {!url && !failed ? <ActivityIndicator style={styles.center} color="#FFFFFF" /> : null}
        {failed ? (
          <View style={styles.center} pointerEvents="box-none">
            <Text style={styles.error}>This photo couldn’t be loaded.</Text>
            <TouchableOpacity onPress={() => setAttempt((n) => n + 1)} style={styles.retry} accessibilityRole="button" accessibilityLabel="Try again">
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : null}
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
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 12 },
  error: { color: '#FFFFFF', fontSize: 16, lineHeight: 22 },
  retry: { minHeight: 44, paddingHorizontal: 20, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)', justifyContent: 'center' },
  retryText: { color: '#FFFFFF', fontSize: 16, lineHeight: 22 },
  close: { position: 'absolute', right: 12, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)' },
});
