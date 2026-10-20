// V2 chat: preview of the picked photo with an explicit "Send photo". Picking
// never sends. Cancel closes without touching the message draft. While sending
// the buttons are locked (a cancelled request could still arrive); on failure
// the error shows and "Try again" retries with the SAME request id (the chat
// screen keeps it), so a retry never makes a second message.
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { CheckedPhoto } from '@/lib/chat/photo';
import { obColors, obFonts, obSpacing } from '@/lib/onboardingV2/theme';

type Props = {
  photo: CheckedPhoto | null;
  otherName: string;
  sending: boolean;
  error: string | null;
  onCancel: () => void;
  onSend: () => void;
};

export function PhotoSendSheet({ photo, otherName, sending, error, onCancel, onSend }: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const boxW = width - obSpacing.lg * 2;
  const boxH = Math.max(200, height - insets.top - insets.bottom - 230);
  const s = photo ? Math.min(boxW / photo.width, boxH / photo.height) : 1;
  const shown = photo ? { width: Math.round(photo.width * s), height: Math.round(photo.height * s) } : { width: 0, height: 0 };

  return (
    <Modal visible={!!photo} animationType="slide" onRequestClose={sending ? () => {} : onCancel} presentationStyle="fullScreen">
      <View style={[styles.root, { paddingTop: insets.top + 4, paddingBottom: Math.max(insets.bottom, obSpacing.md) }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onCancel} disabled={sending} hitSlop={10} style={styles.close}
            accessibilityRole="button" accessibilityLabel="Cancel" accessibilityState={{ disabled: sending }}>
            <Ionicons name="close" size={24} color={sending ? obColors.ctaDisabled : obColors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>
            Send to {otherName}?
          </Text>
          <View style={styles.close} />
        </View>

        <View style={styles.stage}>
          {photo ? (
            <Image source={{ uri: photo.uri }} style={[styles.photo, shown]} contentFit="contain"
              accessible accessibilityLabel="Selected photo preview" />
          ) : null}
        </View>

        <View style={styles.footer}>
          {error ? (
            <Text style={styles.error} accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}
          <TouchableOpacity
            style={[styles.send, sending && styles.sendBusy]}
            onPress={onSend}
            disabled={sending}
            accessibilityRole="button"
            accessibilityLabel={error ? 'Try again' : 'Send photo'}
            accessibilityState={{ disabled: sending, busy: sending }}>
            {sending ? (
              <View style={styles.sendingRow}>
                <ActivityIndicator color={obColors.onCta} />
                <Text style={styles.sendText}>Sending…</Text>
              </View>
            ) : (
              <Text style={styles.sendText}>{error ? 'Try again' : 'Send photo'}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: obColors.background, paddingHorizontal: obSpacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: { width: 44, height: 44, alignItems: 'flex-start', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontFamily: obFonts.bodySemiBold, fontSize: 17, lineHeight: 22, color: obColors.textPrimary },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: obSpacing.md },
  photo: { borderRadius: 12, backgroundColor: obColors.notice },
  footer: { gap: obSpacing.sm },
  error: { fontFamily: obFonts.body, fontSize: 14, lineHeight: 19, color: obColors.error, textAlign: 'center' },
  send: { minHeight: 52, borderRadius: 14, backgroundColor: obColors.cta, alignItems: 'center', justifyContent: 'center' },
  sendBusy: { opacity: 0.85 },
  sendingRow: { flexDirection: 'row', alignItems: 'center', gap: obSpacing.sm },
  sendText: { fontFamily: obFonts.bodySemiBold, fontSize: 17, lineHeight: 22, color: obColors.onCta },
});
