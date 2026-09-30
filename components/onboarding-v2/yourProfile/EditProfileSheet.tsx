// "Edit profile" bottom sheet (replaces the long system action sheet): an
// opaque ivory panel with dark-green line icons, a short title + small
// description per section and a chevron. Counts and summaries come from the
// real draft. Scrolls on small screens; closes on backdrop tap, the close
// button or the system back gesture.
import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { obColors, obFonts, obSpacing } from '@/lib/onboardingV2/theme';

export type EditRow = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  onPress: () => void;
};

type Props = {
  visible: boolean;
  rows: EditRow[];
  onClose: () => void;
};

export function EditProfileSheet({ visible, rows, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
        <View style={[styles.panel, { maxHeight: Math.round(height * 0.85), paddingBottom: insets.bottom + obSpacing.md }]}>
          <View style={styles.handle} importantForAccessibility="no" />
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.4}>
                Edit profile
              </Text>
              <Text style={styles.subtitle} maxFontSizeMultiplier={1.6}>
                Your answers are kept.
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close" style={styles.close}>
              <Ionicons name="close" size={22} color={obColors.textPrimary} />
            </TouchableOpacity>
          </View>
          <ScrollView bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
            {rows.map((row, i) => (
              <TouchableOpacity
                key={row.key}
                onPress={row.onPress}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`${row.title}. ${row.description}`}
                style={[styles.row, i < rows.length - 1 && styles.rowDivider]}>
                <View style={styles.iconWrap}>
                  <Ionicons name={row.icon} size={22} color={obColors.cta} />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle} maxFontSizeMultiplier={1.5}>
                    {row.title}
                  </Text>
                  <Text style={styles.rowDescription} numberOfLines={2} maxFontSizeMultiplier={1.6}>
                    {row.description}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={obColors.textSecondary} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(28,27,24,0.4)' },
  panel: {
    backgroundColor: obColors.background, // opaque ivory
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 8,
  },
  handle: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: obColors.border, marginBottom: 8 },
  header: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: obSpacing.gutter, paddingBottom: 8 },
  headerText: { flex: 1 },
  title: { fontFamily: obFonts.heading, fontSize: 24, lineHeight: 30, color: obColors.textPrimary },
  subtitle: { fontFamily: obFonts.body, fontSize: 14, lineHeight: 20, color: obColors.textSecondary, marginTop: 2 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -10, marginTop: -6 },
  list: { paddingHorizontal: obSpacing.gutter },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 64, paddingVertical: 10, gap: 14 },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: obColors.border },
  iconWrap: { width: 28, alignItems: 'center' },
  rowText: { flex: 1 },
  rowTitle: { fontFamily: obFonts.bodySemiBold, fontSize: 17, lineHeight: 22, color: obColors.textPrimary },
  rowDescription: { fontFamily: obFonts.body, fontSize: 13.5, lineHeight: 18, color: obColors.textSecondary, marginTop: 2 },
});
