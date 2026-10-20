// V2 chat: a photo message. Keeps the photo's aspect ratio (from the stored
// width / height), loads a short-lived signed URL (the server checks the
// viewer is a participant), shows a quiet placeholder while loading and
// "Tap to retry" if the photo can't be loaded. Tap → full-screen viewer.
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { photoBubbleSize } from '@/lib/chat/photo';
import { chatPhotoUrl } from '@/lib/chat/photoApi';
import { obColors, obFonts } from '@/lib/onboardingV2/theme';

type Props = {
  path: string;
  width: number | null | undefined;
  height: number | null | undefined;
  mine: boolean;
  label: string;
  onOpen: (url: string) => void;
};

export function PhotoBubble({ path, width, height, mine, label, onOpen }: Props) {
  const size = photoBubbleSize(width, height);
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setFailed(false);
    void chatPhotoUrl(path).then((u) => {
      if (!live) return;
      if (u) setUrl(u);
      else setFailed(true);
    });
    return () => {
      live = false;
    };
  }, [path, attempt]);

  const retry = useCallback(() => {
    setUrl(null);
    setAttempt((n) => n + 1);
  }, []);

  return (
    <Pressable
      onPress={failed ? retry : url ? () => onOpen(url) : undefined}
      style={[styles.wrap, size, mine ? styles.mine : styles.theirs]}
      accessibilityRole={failed ? 'button' : 'imagebutton'}
      accessibilityLabel={failed ? `${label}. Couldn’t load. Tap to retry` : `${label}. Opens full screen`}>
      {url && !failed ? (
        <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={120}
          onError={() => setFailed(true)} accessible={false} />
      ) : failed ? (
        <View style={styles.center}>
          <Ionicons name="refresh" size={20} color={obColors.textSecondary} />
          <Text style={styles.retry}>Tap to retry</Text>
        </View>
      ) : (
        <View style={styles.center}>
          <ActivityIndicator color={obColors.textSecondary} />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 11, overflow: 'hidden', backgroundColor: obColors.notice },
  mine: {},
  theirs: { borderWidth: StyleSheet.hairlineWidth, borderColor: '#E4DCCB' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  retry: { fontFamily: obFonts.bodyMedium, fontSize: 13, lineHeight: 17, color: obColors.textSecondary },
});
