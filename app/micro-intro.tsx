// Screen: Micro-intro (invite: place + 1-3 time slots) | Status: stable | Last updated: 2026-09-11
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { colors } from '@/lib/designTokens';
import {
  formatIntroLines,
  formatMeetingTime,
  sendMatchInvite,
  suggestMeetingTimes,
  type IntroAnswers,
} from '@/lib/matchInvite';
import { supabase } from '@/lib/supabaseClient';

function firstParam(val: string | string[] | undefined): string {
  if (Array.isArray(val)) return val[0] ?? '';
  return val ?? '';
}

function capitalizeWords(text: string): string {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function normalizePlace(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(/\s*([,\-–—])\s*/g, ' $1 ')
    .replace(/\s+/g, ' ')
    .trim();
  return capitalizeWords(cleaned);
}

const CUSTOM_PLACE_OPTION = '📍 Suggest another place';

const FALLBACK_PLACE_OPTIONS = [
  '☕ Mandabatmaz — Beyoğlu',
  "☕ Walter's Coffee — Kadıköy",
  '☕ Kronotrop — Nişantaşı',
];

type VenueRow = {
  name: string;
  district: string;
  emoji: string | null;
};

type VenueReason = 'both' | 'you' | 'them' | null;
type PickedVenue = VenueRow & { reason: VenueReason };

function formatVenueOption(venue: PickedVenue, otherName: string): string {
  const base = `${venue.emoji ?? '☕'} ${venue.name} — ${venue.district}`;
  if (venue.reason === 'both') return `${base} · Near both of you`;
  if (venue.reason === 'you') return `${base} · Near you`;
  if (venue.reason === 'them') return `${base} · Near ${otherName}`;
  return base;
}

/** Prefer a venue near both people over one only near you — otherwise the
 * suggestion ignores where the other person actually is (2026-08-24). */
const TR_DIACRITICS: Record<string, string> = {
  ş: 's', ğ: 'g', ı: 'i', ö: 'o', ü: 'u', ç: 'c',
  Ş: 's', Ğ: 'g', İ: 'i', I: 'i', Ö: 'o', Ü: 'u', Ç: 'c',
};

/** `venues.district` uses proper Turkish diacritics ("Beşiktaş");
 * `profiles.district` is stored ASCII-only ("Besiktas") — raw `===` never
 * matched, silently degrading every suggestion to the generic fallback
 * (2026-08-25, found via device testing). Neighborhood-level values like
 * "Moda" still won't match a district name — that needs a neighborhood→
 * district lookup, separate/bigger fix, not attempted here. */
function normalizeDistrict(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[şğıöüçŞĞİIÖÜÇ]/g, (ch) => TR_DIACRITICS[ch] ?? ch);
}

function pickVenues(
  venues: VenueRow[],
  myDistrict: string | null,
  otherDistrict: string | null,
): PickedVenue[] {
  const picked: PickedVenue[] = [];
  const seen = new Set<string>();
  const my = myDistrict ? normalizeDistrict(myDistrict) : null;
  const other = otherDistrict ? normalizeDistrict(otherDistrict) : null;

  const addVenue = (venue: VenueRow, reason: VenueReason) => {
    const key = `${venue.name}|${venue.district}`;
    if (seen.has(key) || picked.length >= 3) return;
    seen.add(key);
    picked.push({ ...venue, reason });
  };

  if (my && my === other) {
    venues.filter((v) => normalizeDistrict(v.district) === my).forEach((v) => addVenue(v, 'both'));
  }
  if (my) {
    venues.filter((v) => normalizeDistrict(v.district) === my).forEach((v) => addVenue(v, 'you'));
  }
  if (other) {
    venues.filter((v) => normalizeDistrict(v.district) === other).forEach((v) => addVenue(v, 'them'));
  }
  venues.forEach((venue) => addVenue(venue, null));

  return picked;
}

const MAX_SLOTS = 3;

export default function MicroIntroScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const matchUserId = firstParam(params.matchUserId);
  const matchName = firstParam(params.matchName) || 'them';
  const matchAge = firstParam(params.matchAge);
  const matchCity = firstParam(params.matchCity);
  const matchPhoto = firstParam(params.matchPhoto);
  const matchPercentage = firstParam(params.matchPercentage);
  const matchIdParam = firstParam(params.matchId);

  const [step, setStep] = useState<0 | 1>(0);
  const [place, setPlace] = useState<string | null>(null);
  const [customPlace, setCustomPlace] = useState('');
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerDraft, setTimePickerDraft] = useState(new Date());
  const [slotOptions, setSlotOptions] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [chatOpened, setChatOpened] = useState(false);
  const [savedAnswers, setSavedAnswers] = useState<IntroAnswers | null>(null);
  const [placeOptions, setPlaceOptions] = useState<string[]>([
    ...FALLBACK_PLACE_OPTIONS,
    CUSTOM_PLACE_OPTION,
  ]);
  const [venuesLoading, setVenuesLoading] = useState(true);
  const [myGender, setMyGender] = useState<string | null>(null);
  const [otherGender, setOtherGender] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setVenuesLoading(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        let userDistrict: string | null = null;
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('district, gender, availability_days, availability_hours')
            .eq('id', user.id)
            .maybeSingle();
          if (!mounted) return;
          userDistrict = profile?.district ?? null;
          setMyGender(profile?.gender ?? null);
          setSlotOptions(
            suggestMeetingTimes(
              (profile?.availability_days as string[] | null) ?? null,
              (profile?.availability_hours as string[] | null) ?? null,
            ),
          );
        }

        let otherDistrict: string | null = null;
        if (matchUserId) {
          const { data: other } = await supabase
            .from('profiles')
            .select('gender, district')
            .eq('id', matchUserId)
            .maybeSingle();
          if (mounted) setOtherGender(other?.gender ?? null);
          otherDistrict = other?.district ?? null;
        }

        const { data: venues, error } = await supabase
          .from('venues')
          .select('name, district, emoji')
          .eq('is_active', true);

        if (!mounted) return;

        if (error || !venues || venues.length === 0) {
          setPlaceOptions([...FALLBACK_PLACE_OPTIONS, CUSTOM_PLACE_OPTION]);
          return;
        }

        const picked = pickVenues(venues as VenueRow[], userDistrict, otherDistrict);
        if (picked.length === 0) {
          setPlaceOptions([...FALLBACK_PLACE_OPTIONS, CUSTOM_PLACE_OPTION]);
          return;
        }

        setPlaceOptions([
          ...picked.map((v) => formatVenueOption(v, matchName)),
          CUSTOM_PLACE_OPTION,
        ]);
      } catch {
        if (mounted) {
          setPlaceOptions([...FALLBACK_PLACE_OPTIONS, CUSTOM_PLACE_OPTION]);
          setSlotOptions(suggestMeetingTimes(null, null));
        }
      } finally {
        if (mounted) setVenuesLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [matchUserId]);

  const resolvedPlace = useMemo(() => {
    if (!place) return null;
    if (place === CUSTOM_PLACE_OPTION) {
      const t = customPlace.trim();
      return t ? `☕ ${normalizePlace(t)}` : null;
    }
    return place;
  }, [place, customPlace]);

  function toggleSlot(slot: string) {
    setSelectedSlots((prev) => {
      if (prev.includes(slot)) return prev.filter((s) => s !== slot);
      if (prev.length >= MAX_SLOTS) return prev;
      return [...prev, slot];
    });
  }

  function openTimePicker() {
    const draft = new Date();
    draft.setMinutes(0, 0, 0);
    draft.setHours(draft.getHours() + 1); // next full hour, not "now"
    setTimePickerDraft(draft);
    setShowTimePicker(true);
  }

  function addPickedSlot(iso: string) {
    setSelectedSlots((prev) => {
      if (prev.includes(iso) || prev.length >= MAX_SLOTS) return prev;
      return [...prev, iso];
    });
  }

  function onTimePickerChange(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
      if (event.type === 'set' && selected) addPickedSlot(selected.toISOString());
      return;
    }
    if (selected) setTimePickerDraft(selected);
  }

  async function handleSendInvite() {
    if (!resolvedPlace || selectedSlots.length < 1) return;
    if (!matchUserId) {
      Alert.alert('Missing profile', 'Could not find who to invite.');
      return;
    }

    setSending(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('You need to be signed in.');

      const introAnswers: IntroAnswers = {
        place: resolvedPlace,
        slot1: selectedSlots[0],
        slot2: selectedSlots[1],
        slot3: selectedSlots[2],
        // legacy mirrors for older readers
        kafe: resolvedPlace,
        gun: selectedSlots[0],
        saat: selectedSlots[1],
      };

      const result = await sendMatchInvite({
        currentUserId: user.id,
        otherUserId: matchUserId,
        matchScore: Number(matchPercentage) || 0,
        introAnswers,
        currentUserGender: myGender,
        otherUserGender: otherGender,
        matchId: matchIdParam || null,
      });

      if (!result.ok) {
        if (result.limitReached) {
          Alert.alert(
            "You've used your invite for today",
            'Come back tomorrow, or go Premium for 3/day ✨',
          );
          return;
        }
        Alert.alert('Invite not sent', result.error ?? 'Something went wrong.');
        return;
      }

      setSavedAnswers(introAnswers);
      setChatOpened(result.chatOpened);
      setDone(true);

      if (result.chatOpened && result.matchId) {
        // Brief confirmation then chat is available from matches; stay on done screen.
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Something went wrong.';
      Alert.alert('Invite not sent', message);
    } finally {
      setSending(false);
    }
  }

  if (done) {
    const lines = formatIntroLines(savedAnswers);
    return (
      <ScreenContainer style={styles.container}>
        <View style={styles.doneWrap}>
          <ThemedText style={styles.doneEmoji}>{chatOpened ? '💬' : '⏳'}</ThemedText>
          <ThemedText style={styles.doneTitle}>
            {chatOpened ? `Chat with ${matchName} is open` : `Invite sent to ${matchName}`}
          </ThemedText>
          <ThemedText style={styles.doneSubtitle}>
            {chatOpened
              ? 'You can message them now.'
              : `Waiting for ${matchName} to accept.`}
          </ThemedText>

          {lines.length > 0 ? (
            <View style={styles.confirmedBox}>
              {lines.map((line) => (
                <ThemedText key={line} style={styles.confirmedText}>
                  {line}
                </ThemedText>
              ))}
            </View>
          ) : null}

          {chatOpened ? (
            <TouchableOpacity
              style={styles.doneBtn}
              onPress={() =>
                router.replace({
                  pathname: '/chat',
                  params: {
                    userId: matchUserId,
                    userName: matchName,
                    matchId: matchIdParam || '',
                  },
                })
              }
              activeOpacity={0.85}>
              <ThemedText style={styles.doneBtnText}>Open chat</ThemedText>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={styles.doneBtnSecondary}
            onPress={() => router.replace('/(tabs)/matches')}
            activeOpacity={0.85}>
            <ThemedText style={styles.doneBtnSecondaryText}>Back to matches</ThemedText>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  const placeNextDisabled =
    !resolvedPlace || venuesLoading || (place === CUSTOM_PLACE_OPTION && !customPlace.trim());
  // Requiring exactly 3 was pure friction — one good time is enough to send
  // an invite, more just gives the other person options (2026-09-11).
  const slotsReady = selectedSlots.length >= 1;

  return (
    <ScreenContainer style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <View style={styles.profileRow}>
            {matchPhoto ? (
              <Image source={{ uri: matchPhoto }} style={styles.profilePhoto} />
            ) : (
              <View style={[styles.profilePhoto, styles.photoFallback]} />
            )}
            <View style={styles.profileInfo}>
              <ThemedText style={styles.profileName}>
                {matchName}
                {matchAge ? `, ${matchAge}` : ''}
              </ThemedText>
              {matchCity ? (
                <ThemedText style={styles.profileCity}>📍 {matchCity}</ThemedText>
              ) : null}
            </View>
            {matchPercentage ? (
              <View style={styles.percentBadge}>
                <ThemedText style={styles.percentText}>%{matchPercentage}</ThemedText>
              </View>
            ) : null}
          </View>

          <View style={styles.dotsRow}>
            <View style={[styles.dot, step === 0 && styles.dotActive, step > 0 && styles.dotDone]} />
            <View style={[styles.dot, step === 1 && styles.dotActive]} />
          </View>

          {step === 0 ? (
            <>
              <ThemedText style={styles.question}>Where should you meet?</ThemedText>
              <View style={styles.optionsWrap}>
                {venuesLoading ? (
                  <ThemedText style={styles.loadingText}>Loading places…</ThemedText>
                ) : (
                  placeOptions.map((opt) => (
                    <TouchableOpacity
                      key={opt}
                      style={[styles.option, place === opt && styles.optionSelected]}
                      onPress={() => setPlace(opt)}
                      activeOpacity={0.8}>
                      <ThemedText
                        style={[styles.optionText, place === opt && styles.optionTextSelected]}>
                        {opt}
                      </ThemedText>
                    </TouchableOpacity>
                  ))
                )}
                {place === CUSTOM_PLACE_OPTION ? (
                  <TextInput
                    style={styles.customInput}
                    placeholder="Place name and area…"
                    placeholderTextColor="#AAAAAA"
                    value={customPlace}
                    onChangeText={setCustomPlace}
                  />
                ) : null}
              </View>
            </>
          ) : (
            <>
              <ThemedText style={styles.question}>Pick 1-3 time options</ThemedText>
              <ThemedText style={styles.hint}>
                Suggested from your availability. More options make it easier for them to say
                yes — {selectedSlots.length}/{MAX_SLOTS} selected.
              </ThemedText>
              <View style={styles.optionsWrap}>
                {slotOptions.map((opt) => {
                  const on = selectedSlots.includes(opt);
                  return (
                    <TouchableOpacity
                      key={opt}
                      style={[styles.option, on && styles.optionSelected]}
                      onPress={() => toggleSlot(opt)}
                      activeOpacity={0.8}>
                      <ThemedText style={[styles.optionText, on && styles.optionTextSelected]}>
                        {on ? '✓ ' : ''}
                        {formatMeetingTime(opt)}
                      </ThemedText>
                    </TouchableOpacity>
                  );
                })}
                {selectedSlots
                  .filter((s) => !slotOptions.includes(s))
                  .map((opt) => (
                    <TouchableOpacity
                      key={opt}
                      style={[styles.option, styles.optionSelected]}
                      onPress={() => toggleSlot(opt)}
                      activeOpacity={0.8}>
                      <ThemedText style={[styles.optionText, styles.optionTextSelected]}>
                        ✓ {formatMeetingTime(opt)}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}

                {showTimePicker ? (
                  <View style={styles.customSlotColumn}>
                    <DateTimePicker
                      value={timePickerDraft}
                      mode="datetime"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      minimumDate={new Date()}
                      onChange={onTimePickerChange}
                      style={styles.timePickerSpinner}
                      themeVariant="light"
                      textColor="#1A1A1A"
                    />
                    {Platform.OS === 'ios' ? (
                      <TouchableOpacity
                        style={styles.addSlotBtnWide}
                        onPress={() => {
                          addPickedSlot(timePickerDraft.toISOString());
                          setShowTimePicker(false);
                        }}
                        activeOpacity={0.85}>
                        <ThemedText style={styles.addSlotBtnText}>Add this time</ThemedText>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.option, styles.customTimeOption]}
                    onPress={openTimePicker}
                    disabled={selectedSlots.length >= MAX_SLOTS}
                    activeOpacity={0.8}>
                    <ThemedText style={styles.optionText}>+ Pick another time</ThemedText>
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}
        </ScrollView>

        <View style={styles.footer}>
          {step === 1 ? (
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStep(0)} activeOpacity={0.85}>
              <ThemedText style={styles.secondaryBtnText}>Back</ThemedText>
            </TouchableOpacity>
          ) : null}
          {step === 0 ? (
            <TouchableOpacity
              style={[styles.primaryBtn, placeNextDisabled && styles.btnDisabled]}
              disabled={placeNextDisabled}
              onPress={() => setStep(1)}
              activeOpacity={0.85}>
              <ThemedText style={styles.primaryBtnText}>Next</ThemedText>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.primaryBtn, (!slotsReady || sending) && styles.btnDisabled]}
              disabled={!slotsReady || sending}
              onPress={() => void handleSendInvite()}
              activeOpacity={0.85}>
              <ThemedText style={styles.primaryBtnText}>
                {sending ? 'Sending…' : "Let's meet"}
              </ThemedText>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: 'flex-start' },
  scroll: { flex: 1 },
  content: { paddingBottom: 24, gap: 12 },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  profilePhoto: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#DDD' },
  photoFallback: { backgroundColor: '#E8E8E8' },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  profileCity: { fontSize: 13, color: '#888', marginTop: 2 },
  percentBadge: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  percentText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  dotsRow: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginVertical: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E0E0E0' },
  dotActive: { backgroundColor: colors.accent, width: 24 },
  dotDone: { backgroundColor: colors.accent, opacity: 0.4 },
  question: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  hint: { fontSize: 13, color: '#888', marginBottom: 8 },
  optionsWrap: { gap: 10 },
  option: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  // Was a pale gold fill (`#FFF8E1`) left over from before the black-identity
  // migration — clashed with the now-black accent border (2026-09-11).
  optionSelected: { borderColor: colors.accent, backgroundColor: colors.accent },
  optionText: { fontSize: 15, color: colors.textPrimary },
  optionTextSelected: { color: '#FFF', fontWeight: '700' },
  customInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.accent,
    marginTop: 4,
  },
  customSlotRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  // Picker stacked above its confirm button — side-by-side pushed the button
  // off-screen since the spinner (3 columns: day/hour/minute) is wider than
  // it looks and doesn't shrink to share a row (2026-08-25, device testing).
  customSlotColumn: { gap: 8, alignItems: 'stretch' },
  timePickerSpinner: { alignSelf: 'center' },
  customTimeOption: {
    borderStyle: 'dashed',
    borderColor: colors.accent,
    alignItems: 'center',
  },
  addSlotBtn: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  addSlotBtnWide: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  addSlotBtnText: { color: '#FFF', fontWeight: '600' },
  loadingText: { color: '#888', textAlign: 'center', marginTop: 12 },
  footer: { gap: 10, paddingTop: 8, paddingBottom: 8 },
  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  secondaryBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  secondaryBtnText: { color: colors.textPrimary, fontWeight: '600' },
  btnDisabled: { opacity: 0.45 },
  doneWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingHorizontal: 12 },
  doneEmoji: { fontSize: 48 },
  doneTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  doneSubtitle: { fontSize: 15, color: '#666', textAlign: 'center', lineHeight: 22 },
  confirmedBox: {
    width: '100%',
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 16,
    gap: 8,
    marginTop: 8,
  },
  confirmedText: { fontSize: 14, color: colors.textPrimary },
  doneBtn: {
    marginTop: 16,
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    width: '100%',
    alignItems: 'center',
  },
  doneBtnText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  doneBtnSecondary: { marginTop: 8, paddingVertical: 12 },
  doneBtnSecondaryText: { color: colors.accent, fontWeight: '600', fontSize: 15 },
});
