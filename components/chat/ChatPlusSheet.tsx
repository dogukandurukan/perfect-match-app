// V2 chat "+" menu: a compact ivory bottom sheet (replaces the grey system
// alert) with two actions — Suggest a date, Add a photo. Closes with the ×
// button, a tap outside or the Android back button. It never touches the
// message draft. The chosen action runs only after the sheet has finished
// closing: on iOS a second modal (the date sheet) or an alert opened while
// this one is still dismissing would not appear.
import { Ionicons } from '@expo/vector-icons';
import { useRef } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { obColors, obFonts, obSpacing } from '@/lib/onboardingV2/theme';

type Action = 'date' | 'photo';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSuggestDate: () => void;
  onAddPhoto: () => void;
};

export function ChatPlusSheet({ visible, onClose, onSuggestDate, onAddPhoto }: Props) {
  const insets = useSafeAreaInsets();
  const pending = useRef<Action | null>(null);

  const run = () => {
    const a = pending.current;
    pending.current = null;
    if (a === 'date') onSuggestDate();
    else if (a === 'photo') onAddPhoto();
  };

  const choose = (a: Action) => {
    pending.current = a;
    onClose();
    // Android has no Modal onDismiss; its modals can stack, so run right away.
    if (Platform.OS !== 'ios') setTimeout(run, 0);
  };

  const rows: { key: Action; icon: keyof typeof Ionicons.glyphMap; title: string; sub: string }[] = [
    { key: 'date', icon: 'calendar-outline', title: 'Suggest a date', sub: 'Pick a day and a time' },
    { key: 'photo', icon: 'image-outline', title: 'Add a photo', sub: 'Choose one from your library' },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} onDismiss={run}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close menu" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, obSpacing.lg) }]}>
          <View style={styles.handle} importantForAccessibility="no" />
          <View style={styles.header}>
            <Text style={styles.title} accessibilityRole="header">
              Add to chat
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={10} style={styles.close} accessibilityRole="button" accessibilityLabel="Close">
              <Ionicons name="close" size={22} color={obColors.textPrimary} />
            </TouchableOpacity>
          </View>
          {rows.map((r, i) => (
            <TouchableOpacity
              key={r.key}
              style={[styles.row, i > 0 && styles.rowDivider]}
              onPress={() => choose(r.key)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={r.title}
              accessibilityHint={r.sub}>
              <View style={styles.icon}>
                <Ionicons name={r.icon} size={22} color={obColors.cta} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{r.title}</Text>
                <Text style={styles.rowSub} numberOfLines={1}>
                  {r.sub}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={obColors.textSecondary} />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(28,27,24,0.35)' },
  sheet: {
    backgroundColor: obColors.background,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 8,
    paddingHorizontal: obSpacing.lg,
  },
  handle: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: obColors.border, marginBottom: 4 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 4 },
  title: { fontFamily: obFonts.bodySemiBold, fontSize: 16, lineHeight: 22, color: obColors.textPrimary },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingVertical: 8, paddingHorizontal: 4 },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E4DCCB' },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: obColors.selectedFill, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontFamily: obFonts.bodySemiBold, fontSize: 16, lineHeight: 21, color: obColors.textPrimary },
  rowSub: { fontFamily: obFonts.body, fontSize: 13, lineHeight: 18, color: obColors.textSecondary },
});
