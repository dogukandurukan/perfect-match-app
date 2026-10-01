// "Suggest a date" sheet (V2 chat, approved ivory / forest green / sage theme).
// Day, Time and an optional Place, each picked by the person — nothing is
// inferred from the general first-date preferences. No place → "Decide
// together". The summary + "Send suggestion" sit above the keyboard. Server
// rules (participants, one pending, no past times, idempotent request id) stay
// in propose_date_v2 / respond_date_v2; this is only the form.
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  MIN_LEAD_MS,
  TIME_CHOICES,
  combineLocal,
  dayLabel,
  dayOf,
  isSendableTime,
  sameDay,
  suggestionSummary,
  timeAvailableOn,
  timeLabel,
  upcomingDays,
  type LocalDay,
} from '@/lib/onboardingV2/dateSuggestions';
import { obColors, obFonts, obSpacing } from '@/lib/onboardingV2/theme';

type Props = {
  visible: boolean;
  counter: boolean;
  otherName: string;
  otherPhotoUrl: string | null;
  sending: boolean;
  onClose: () => void;
  onSend: (meetingAtIso: string, place: string | null) => void;
};

type Clock = { h: number; m: number };

export function SuggestDateSheet({ visible, counter, otherName, otherPhotoUrl, sending, onClose, onSend }: Props) {
  const insets = useSafeAreaInsets();
  const [now, setNow] = useState(() => new Date());
  const [day, setDay] = useState<LocalDay | null>(null);
  const [time, setTime] = useState<Clock | null>(null);
  const [place, setPlace] = useState('');
  const [picker, setPicker] = useState<'date' | 'time' | null>(null);
  const [draft, setDraft] = useState(new Date());

  // Fresh, empty form every time the sheet opens (no preselected day / time).
  useEffect(() => {
    if (!visible) return;
    setNow(new Date());
    setDay(null);
    setTime(null);
    setPlace('');
    setPicker(null);
  }, [visible]);

  const days = useMemo(() => upcomingDays(now), [now]);
  const extraDay = day && !days.some((d) => sameDay(d, day)) ? day : null;
  const iso = day && time ? combineLocal(day, time) : null;
  const sendable = isSendableTime(iso);
  const summary = suggestionSummary(day, time, place);
  const customTime = time && !TIME_CHOICES.some((t) => t.h === time.h && t.m === time.m) ? time : null;

  const pickDay = (d: LocalDay) => {
    setDay(d);
    if (time && !timeAvailableOn(d, time)) setTime(null);
  };

  const openPicker = (kind: 'date' | 'time') => {
    const base = kind === 'date' && day ? new Date(day.y, day.mo, day.d, 12) : new Date(Date.now() + 60 * 60 * 1000);
    if (kind === 'time' && time) base.setHours(time.h, time.m, 0, 0);
    setDraft(base);
    setPicker(kind);
  };

  const commit = (value: Date, kind: 'date' | 'time') => {
    if (kind === 'date') pickDay(dayOf(value));
    else setTime({ h: value.getHours(), m: value.getMinutes() });
  };

  const onPickerChange = (e: DateTimePickerEvent, value?: Date) => {
    if (Platform.OS === 'android') {
      const kind = picker;
      setPicker(null);
      if (e.type === 'set' && value && kind) commit(value, kind);
      return;
    }
    if (value) setDraft(value);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, obSpacing.lg) }]}>
          <View style={styles.handle} importantForAccessibility="no" />
          <View style={styles.header}>
            {otherPhotoUrl ? (
              <Image source={{ uri: otherPhotoUrl }} style={styles.avatar} contentFit="cover" accessible={false} />
            ) : (
              <View style={[styles.avatar, styles.avatarEmpty]}>
                <Text style={styles.initial}>{(otherName.trim()[0] ?? '?').toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.headerText}>
              <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.4}>
                {counter ? 'Suggest another time' : 'Suggest a date'}
              </Text>
              <Text style={styles.with} numberOfLines={1} maxFontSizeMultiplier={1.5}>
                with {otherName}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close" style={styles.close}>
              <Ionicons name="close" size={22} color={obColors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
            <Text style={styles.label} accessibilityRole="header">Day</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayRow}>
              {[...days, ...(extraDay ? [extraDay] : [])].map((d) => {
                const on = sameDay(d, day);
                const l = dayLabel(d, now);
                return (
                  <TouchableOpacity
                    key={`${d.y}-${d.mo}-${d.d}`}
                    style={[styles.dayCard, on && styles.cardOn]}
                    onPress={() => pickDay(d)}
                    accessibilityRole="button"
                    accessibilityLabel={`${l.top} ${l.bottom}`}
                    accessibilityState={{ selected: on }}>
                    <Text style={[styles.dayTop, on && styles.textOn]}>{l.top}</Text>
                    <Text style={[styles.dayBottom, on && styles.textOn]}>{l.bottom}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity onPress={() => openPicker('date')} accessibilityRole="button" hitSlop={8} style={styles.linkRow}>
              <Ionicons name="calendar-outline" size={18} color={obColors.cta} />
              <Text style={styles.link}>Another date</Text>
            </TouchableOpacity>

            <Text style={styles.label} accessibilityRole="header">Time</Text>
            <View style={styles.timeGrid}>
              {TIME_CHOICES.map((t) => {
                const on = !!time && time.h === t.h && time.m === t.m;
                const usable = !day || timeAvailableOn(day, t);
                return (
                  <TouchableOpacity
                    key={timeLabel(t)}
                    style={[styles.timeChip, on && styles.cardOn, !usable && styles.chipOff]}
                    disabled={!usable}
                    onPress={() => setTime(t)}
                    accessibilityRole="button"
                    accessibilityLabel={timeLabel(t)}
                    accessibilityState={{ selected: on, disabled: !usable }}>
                    <Text style={[styles.timeText, on && styles.textOn, !usable && styles.textOff]}>{timeLabel(t)}</Text>
                  </TouchableOpacity>
                );
              })}
              {customTime ? (
                <View style={[styles.timeChip, styles.cardOn]}>
                  <Text style={[styles.timeText, styles.textOn]}>{timeLabel(customTime)}</Text>
                </View>
              ) : null}
            </View>
            <TouchableOpacity onPress={() => openPicker('time')} accessibilityRole="button" hitSlop={8} style={styles.linkRow}>
              <Ionicons name="time-outline" size={18} color={obColors.cta} />
              <Text style={styles.link}>Other time</Text>
            </TouchableOpacity>

            {picker ? (
              <View style={styles.pickerBox}>
                <DateTimePicker
                  value={draft}
                  mode={picker}
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  minimumDate={picker === 'date' ? new Date(now.getFullYear(), now.getMonth(), now.getDate()) : undefined}
                  maximumDate={picker === 'date' ? new Date(Date.now() + 119 * 86400000) : undefined}
                  onChange={onPickerChange}
                  themeVariant="light"
                  textColor={obColors.textPrimary}
                />
                {Platform.OS === 'ios' ? (
                  <TouchableOpacity
                    style={styles.pickerDone}
                    onPress={() => {
                      commit(draft, picker);
                      setPicker(null);
                    }}
                    accessibilityRole="button">
                    <Text style={styles.pickerDoneText}>Use this {picker === 'date' ? 'date' : 'time'}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}

            <Text style={styles.label} accessibilityRole="header">Place (optional)</Text>
            <TextInput
              style={styles.input}
              value={place}
              onChangeText={setPlace}
              placeholder="Decide together"
              placeholderTextColor={obColors.textSecondary}
              maxLength={120}
              returnKeyType="done"
              accessibilityLabel="Place, optional"
            />
          </ScrollView>

          <View style={styles.footer}>
            <Text style={styles.summary} accessibilityLiveRegion="polite" maxFontSizeMultiplier={1.6}>
              {summary ?? 'Pick a day and a time.'}
            </Text>
            {iso && !sendable ? <Text style={styles.warn}>Pick a time at least a few minutes from now.</Text> : null}
            <TouchableOpacity
              style={[styles.send, (!sendable || sending) && styles.sendOff]}
              disabled={!sendable || sending}
              onPress={() => iso && onSend(iso, place.trim() || null)}
              accessibilityRole="button"
              accessibilityLabel="Send suggestion"
              accessibilityState={{ disabled: !sendable || sending }}>
              {sending ? <ActivityIndicator color={obColors.onCta} /> : <Text style={styles.sendText}>Send suggestion</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const CARD = { borderWidth: 1, borderColor: '#D9D1C0', backgroundColor: '#FFFDF8' } as const;

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(28,27,24,0.4)' },
  sheet: { maxHeight: '92%', backgroundColor: obColors.background, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingTop: 8 },
  handle: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: obColors.border, marginBottom: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: obSpacing.md, paddingHorizontal: obSpacing.gutter, paddingBottom: obSpacing.sm },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: obColors.selectedFill },
  avatarEmpty: { alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: obFonts.heading, fontSize: 18, lineHeight: 24, color: obColors.cta },
  headerText: { flex: 1 },
  title: { fontFamily: obFonts.heading, fontSize: 24, lineHeight: 30, color: obColors.textPrimary },
  with: { fontFamily: obFonts.body, fontSize: 14, lineHeight: 20, color: obColors.textSecondary },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -10 },
  body: { paddingHorizontal: obSpacing.gutter, paddingBottom: obSpacing.md, gap: obSpacing.sm },
  label: { marginTop: obSpacing.md, fontFamily: obFonts.bodySemiBold, fontSize: 13, lineHeight: 18, letterSpacing: 0.4, textTransform: 'uppercase', color: obColors.textSecondary },
  dayRow: { gap: obSpacing.sm, paddingVertical: 2 },
  dayCard: { ...CARD, width: 68, minHeight: 64, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  cardOn: { backgroundColor: obColors.selectedFill, borderColor: obColors.cta },
  dayTop: { fontFamily: obFonts.bodySemiBold, fontSize: 14, lineHeight: 19, color: obColors.textPrimary },
  dayBottom: { fontFamily: obFonts.body, fontSize: 13, lineHeight: 18, color: obColors.textSecondary },
  textOn: { color: obColors.cta },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, alignSelf: 'flex-start' },
  link: { fontFamily: obFonts.bodySemiBold, fontSize: 15, lineHeight: 20, color: obColors.cta, textDecorationLine: 'underline' },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: obSpacing.sm },
  timeChip: { ...CARD, minWidth: 76, minHeight: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  chipOff: { opacity: 0.4 },
  timeText: { fontFamily: obFonts.bodyMedium, fontSize: 15, lineHeight: 20, color: obColors.textPrimary },
  textOff: { textDecorationLine: 'line-through' },
  pickerBox: { alignItems: 'center', backgroundColor: '#FFFDF8', borderRadius: 14, borderWidth: 1, borderColor: '#E4DCCB', paddingVertical: 8 },
  pickerDone: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 16 },
  pickerDoneText: { fontFamily: obFonts.bodySemiBold, fontSize: 16, lineHeight: 22, color: obColors.cta },
  input: {
    minHeight: 48,
    borderBottomWidth: 1,
    borderBottomColor: obColors.border,
    fontFamily: obFonts.body,
    fontSize: 17,
    lineHeight: 22,
    color: obColors.textPrimary,
    paddingVertical: 10,
  },
  footer: { paddingHorizontal: obSpacing.gutter, paddingTop: obSpacing.md, gap: obSpacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E4DCCB' },
  summary: { fontFamily: obFonts.bodyMedium, fontSize: 15, lineHeight: 21, color: obColors.textPrimary, textAlign: 'center' },
  warn: { fontFamily: obFonts.body, fontSize: 13, lineHeight: 18, color: obColors.error, textAlign: 'center' },
  send: { minHeight: 52, borderRadius: 14, backgroundColor: obColors.cta, alignItems: 'center', justifyContent: 'center' },
  sendOff: { backgroundColor: obColors.ctaDisabled },
  sendText: { fontFamily: obFonts.bodySemiBold, fontSize: 17, lineHeight: 22, color: obColors.onCta },
});

// Re-exported for the chat screen's own guard.
export { MIN_LEAD_MS };
