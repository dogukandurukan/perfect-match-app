import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { homeColors, homeSpacing } from '@/lib/homeTheme';

const BUTTON_SIZE = 56;

export function ProfileActionButtons({
  disabled,
  onPass,
  onLike,
  onBlock,
  onReport,
}: {
  disabled?: boolean;
  onPass: () => void;
  onLike: () => void;
  onBlock: () => void;
  onReport: () => void;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.circleBtn, styles.passBtn]}
          activeOpacity={0.8}
          disabled={disabled}
          onPress={onPass}
          accessibilityRole="button"
          accessibilityLabel="Pass">
          <Ionicons name="close" size={26} color={homeColors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.circleBtn, styles.likeBtn]}
          activeOpacity={0.8}
          disabled={disabled}
          onPress={onLike}
          accessibilityRole="button"
          accessibilityLabel="Like">
          <Ionicons name="heart-outline" size={26} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
      <View style={styles.secondaryRow}>
        <TouchableOpacity
          style={styles.secondaryBtn}
          activeOpacity={0.7}
          onPress={onBlock}
          accessibilityRole="button"
          accessibilityLabel="Block this person">
          <ThemedText style={styles.secondaryText}>Block</ThemedText>
        </TouchableOpacity>
        <View style={styles.secondaryDivider} />
        <TouchableOpacity
          style={styles.secondaryBtn}
          activeOpacity={0.7}
          onPress={onReport}
          accessibilityRole="button"
          accessibilityLabel="Report this person">
          <ThemedText style={[styles.secondaryText, styles.reportText]}>Report</ThemedText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: homeSpacing.xl, gap: homeSpacing.md },
  row: { flexDirection: 'row', gap: homeSpacing.xxl },
  circleBtn: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passBtn: {
    backgroundColor: homeColors.surface,
    borderWidth: 1,
    borderColor: homeColors.border,
  },
  likeBtn: {
    backgroundColor: homeColors.accent,
  },
  secondaryRow: { flexDirection: 'row', alignItems: 'center', gap: homeSpacing.sm },
  secondaryBtn: { paddingHorizontal: homeSpacing.sm, paddingVertical: homeSpacing.xs },
  secondaryText: { fontSize: 13, fontWeight: '600', color: homeColors.textSecondary },
  reportText: { color: '#B03A2E' },
  secondaryDivider: {
    width: StyleSheet.hairlineWidth,
    height: 12,
    backgroundColor: homeColors.border,
  },
});
