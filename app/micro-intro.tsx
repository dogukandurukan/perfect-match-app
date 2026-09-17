// Screen: Plan your date (invite: place + 1-3 time slots) | Status: stable | Last updated: 2026-09-18 (Warm Editorial redesign)
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DatePlanProgress, type DatePlanStep } from '@/components/matches/DatePlanProgress';
import { MatchScoreBadge } from '@/components/matches/MatchScoreBadge';
import { PersonAvatar } from '@/components/matches/PersonAvatar';
import { TimeOptionChip } from '@/components/matches/TimeOptionChip';
import { VenueOptionCard } from '@/components/matches/VenueOptionCard';
import { ThemedText } from '@/components/themed-text';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { homeColors, homeRadius, homeSpacing } from '@/lib/homeTheme';
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

type VenueRow = {
  name: string;
  district: string;
  emoji: string | null;
};

type VenueReason = 'both' | 'you' | 'them' | null;
type PickedVenue = VenueRow & { reason: VenueReason };

/** Prefer a venue near both people over one only near you — otherwise the
 * suggestion ignores where the other person actually is (2026-08-24). */
const TR_DIACRITICS: Record<string, string> = {
  ş: 's', ğ: 'g', ı: 'i', ö: 'o', ü: 'u', ç: 'c',
  Ş: 's', Ğ: 'g', İ: 'i', I: 'i', Ö: 'o', Ü: 'u', Ç: 'c',
};

/** `venues.district` uses proper Turkish diacritics ("Beşiktaş");
 * `profiles.district` is stored ASCII-only ("Besiktas") — raw `===` never
 * matched, silently degrading every suggestion to the generic fallback
 * (2026-08-25, found via device testing). */
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
const CUSTOM_VENUE = 'custom' as const;
type VenueSelection = PickedVenue | typeof CUSTOM_VENUE | null;

export default function MicroIntroScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();

  const matchUserId = firstParam(params.matchUserId);
  const matchName = firstParam(params.matchName) || 'them';
  const matchAge = firstParam(params.matchAge);
  const matchCity = firstParam(params.matchCity);
  const matchPhoto = firstParam(params.matchPhoto);
  const matchPercentage = firstParam(params.matchPercentage);
  const matchIdParam = firstParam(params.matchId);

  const [venue, setVenue] = useState<VenueSelection>(null);
  const [customPlace, setCustomPlace] = useState('');
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerDraft, setTimePickerDraft] = useState(new Date());
  const [slotOptions, setSlotOptions] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [chatOpened, setChatOpened] = useState(false);
  const [savedAnswers, setSavedAnswers] = useState<IntroAnswers | null>(null);
  const [venueOptions, setVenueOptions] = useState<PickedVenue[]>([]);
  const [venuesLoading, setVenuesLoading] = useState(true);
  const [myGender, setMyGender] = useState<string | null>(null);
  const [otherGender, setOtherGender] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setVenuesLoading(true);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const user = session?.user;

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
          setVenueOptions([]);
          return;
        }

        setVenueOptions(pickVenues(venues as VenueRow[], userDistrict, otherDistrict));
      } catch {
        if (mounted) {
          setVenueOptions([]);
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

  // Persisted to `matches.confirmed_place` — same existing free-text column,
  // just a cleaner format than before (no emoji, no embedded "near who"
  // reason — that context only matters during selection, not in a saved
  // plan). "Name — District" is also what plan-detail.tsx/matches.tsx parse
  // back out to show Venue/District as separate rows.
  const resolvedPlace = useMemo(() => {
    if (!venue) return null;
    if (venue === CUSTOM_VENUE) {
      const t = customPlace.trim();
      return t ? normalizePlace(t) : null;
    }
    return `${venue.name} — ${venue.district}`;
  }, [venue, customPlace]);

  const progressStep: DatePlanStep = !resolvedPlace ? 'place' : selectedSlots.length === 0 ? 'time' : 'review';

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
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error('You need to be signed in.');

      const introAnswers: IntroAnswers = {
        place: resolvedPlace,
        slot1: selectedSlots[0],
        slot2: selectedSlots[1],
        slot3: selectedSlots[2],
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
          <View style={styles.doneIconWrap}>
            <Ionicons name={chatOpened ? 'chatbubbles-outline' : 'paper-plane-outline'} size={30} color={homeColors.accent} />
          </View>
          <ThemedText style={styles.doneTitle}>
            {chatOpened ? `Chat with ${matchName} is open` : `Invitation sent to ${matchName}`}
          </ThemedText>
          {/* Deliberately NOT styled/worded as a confirmed plan (brief:
              "Bu state'i confirmed gibi gösterme") — even when the chat
              opens immediately, the meeting time itself is only an offer
              until the other side accepts it. */}
          <ThemedText style={styles.doneSubtitle}>
            {chatOpened ? 'You can message them now.' : `Waiting for ${matchName} to accept.`}
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
                  params: { userId: matchUserId, userName: matchName, matchId: matchIdParam || '' },
                })
              }
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Open chat">
              <ThemedText style={styles.doneBtnText}>Open chat</ThemedText>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={styles.doneBtnSecondary}
            onPress={() => router.replace('/(tabs)/matches')}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Back to matches">
            <ThemedText style={styles.doneBtnSecondaryText}>Back to Matches</ThemedText>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  const canSend = !!resolvedPlace && selectedSlots.length >= 1 && !venuesLoading;
  const showCustomInput = venue === CUSTOM_VENUE;

  return (
    <ScreenContainer style={styles.container}>
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/matches'))}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Back">
        <Ionicons name="chevron-back" size={24} color={homeColors.textPrimary} />
      </TouchableOpacity>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <View style={styles.profileRow}>
            <PersonAvatar photoUrl={matchPhoto || null} name={matchName} size={56} />
            <View style={styles.profileInfo}>
              <ThemedText style={styles.profileName}>
                {matchName}
                {matchAge ? `, ${matchAge}` : ''}
              </ThemedText>
              {matchPercentage ? <MatchScoreBadge percentage={Number(matchPercentage) || 0} /> : null}
            </View>
          </View>

          <View>
            <ThemedText style={styles.title}>Plan your date</ThemedText>
            <ThemedText style={styles.subtitle}>Choose a place and offer a few times.</ThemedText>
          </View>

          <DatePlanProgress current={progressStep} />

          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Near both of you</ThemedText>
            {venuesLoading ? (
              <ActivityIndicator color={homeColors.accent} style={styles.placeLoading} />
            ) : (
              <View style={styles.venueList}>
                {venueOptions.map((v) => {
                  const key = `${v.name}|${v.district}`;
                  const selected = venue !== null && venue !== CUSTOM_VENUE && `${venue.name}|${venue.district}` === key;
                  return (
                    <VenueOptionCard
                      key={key}
                      name={v.name}
                      district={v.district}
                      reason={v.reason}
                      otherName={matchName}
                      selected={selected}
                      onPress={() => setVenue(v)}
                    />
                  );
                })}
                {venueOptions.length === 0 ? (
                  <ThemedText style={styles.emptyHint}>
                    No suggested venues nearby yet — pick your own place below.
                  </ThemedText>
                ) : null}

                <TouchableOpacity
                  style={styles.customToggle}
                  onPress={() => setVenue(CUSTOM_VENUE)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Suggest another place"
                  accessibilityState={{ selected: showCustomInput }}>
                  <Ionicons
                    name="add-circle-outline"
                    size={16}
                    color={showCustomInput ? homeColors.accent : homeColors.textSecondary}
                  />
                  <ThemedText style={[styles.customToggleText, showCustomInput && styles.customToggleTextActive]}>
                    Suggest another place
                  </ThemedText>
                </TouchableOpacity>
                {showCustomInput ? (
                  <TextInput
                    style={styles.customInput}
                    placeholder="Place name and area…"
                    placeholderTextColor={homeColors.textSecondary}
                    value={customPlace}
                    onChangeText={setCustomPlace}
                  />
                ) : null}
              </View>
            )}
          </View>

          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>When works?</ThemedText>
            <ThemedText style={styles.hint}>
              More options make it easier for them to say yes — {selectedSlots.length} of {MAX_SLOTS} selected.
            </ThemedText>
            <View style={styles.slotChipsRow}>
              {slotOptions.map((opt) => (
                <TimeOptionChip
                  key={opt}
                  label={formatMeetingTime(opt)}
                  selected={selectedSlots.includes(opt)}
                  onPress={() => toggleSlot(opt)}
                />
              ))}
              {selectedSlots
                .filter((s) => !slotOptions.includes(s))
                .map((opt) => (
                  <TimeOptionChip key={opt} label={formatMeetingTime(opt)} selected onPress={() => toggleSlot(opt)} />
                ))}
              {selectedSlots.length < MAX_SLOTS ? (
                <TimeOptionChip label="+ Pick another time" selected={false} dashed onPress={openTimePicker} />
              ) : null}
            </View>

            {showTimePicker ? (
              <View style={styles.timePickerColumn}>
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
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel="Use this time">
                    <ThemedText style={styles.addSlotBtnText}>Use this time</ThemedText>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, homeSpacing.md) }]}>
          <TouchableOpacity
            style={[styles.primaryBtn, (!canSend || sending) && styles.btnDisabled]}
            disabled={!canSend || sending}
            onPress={() => void handleSendInvite()}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Send invitation"
            accessibilityState={{ disabled: !canSend || sending }}>
            {sending ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <ThemedText style={styles.primaryBtnText}>Send invitation</ThemedText>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: 'flex-start', backgroundColor: homeColors.background },
  backBtn: { padding: 8, alignSelf: 'flex-start' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: homeSpacing.lg, paddingBottom: 24, gap: homeSpacing.lg },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: homeSpacing.sm + 2 },
  profileInfo: { flex: 1, gap: 6 },
  profileName: { fontSize: 17, fontWeight: '700', color: homeColors.textPrimary },
  title: { fontSize: 24, fontWeight: '800', color: homeColors.textPrimary },
  subtitle: { fontSize: 14.5, color: homeColors.textSecondary, marginTop: 3 },

  section: { gap: homeSpacing.sm + 2 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: homeColors.textPrimary },
  hint: { fontSize: 12.5, color: homeColors.textSecondary, marginTop: -4 },
  placeLoading: { marginVertical: 12 },
  venueList: { gap: homeSpacing.sm },
  emptyHint: { fontSize: 13, color: homeColors.textSecondary, fontStyle: 'italic' },
  customToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    minHeight: 44,
  },
  customToggleText: { fontSize: 13.5, fontWeight: '600', color: homeColors.textSecondary },
  customToggleTextActive: { color: homeColors.accent },
  customInput: {
    backgroundColor: homeColors.surface,
    borderRadius: homeRadius.cardSmall,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: homeColors.textPrimary,
    fontSize: 14.5,
    borderWidth: 1.5,
    borderColor: homeColors.accent,
  },

  slotChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timePickerColumn: { gap: 8, alignItems: 'stretch', marginTop: 4 },
  timePickerSpinner: { alignSelf: 'stretch', width: '100%', height: 180, backgroundColor: '#FFFFFF' },
  addSlotBtnWide: {
    backgroundColor: homeColors.accent,
    borderRadius: homeRadius.cardSmall,
    paddingVertical: 14,
    alignItems: 'center',
  },
  addSlotBtnText: { color: '#FFF', fontWeight: '600' },

  footer: {
    paddingTop: 10,
    paddingHorizontal: homeSpacing.lg,
    backgroundColor: homeColors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: homeColors.border,
  },
  primaryBtn: {
    minHeight: 52,
    backgroundColor: homeColors.accent,
    borderRadius: homeRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  btnDisabled: { opacity: 0.45 },

  doneWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingHorizontal: 24 },
  doneIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: homeColors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  doneTitle: { fontSize: 22, fontWeight: '800', color: homeColors.textPrimary, textAlign: 'center' },
  doneSubtitle: { fontSize: 15, color: homeColors.textSecondary, textAlign: 'center', lineHeight: 22 },
  confirmedBox: {
    width: '100%',
    backgroundColor: homeColors.surface,
    borderRadius: homeRadius.card,
    borderWidth: 1,
    borderColor: homeColors.border,
    padding: 16,
    gap: 8,
    marginTop: 8,
  },
  confirmedText: { fontSize: 14, color: homeColors.textPrimary },
  doneBtn: {
    marginTop: 16,
    backgroundColor: homeColors.accent,
    borderRadius: homeRadius.pill,
    paddingVertical: 14,
    paddingHorizontal: 24,
    width: '100%',
    alignItems: 'center',
  },
  doneBtnText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  doneBtnSecondary: { marginTop: 8, paddingVertical: 12 },
  doneBtnSecondaryText: { color: homeColors.accent, fontWeight: '600', fontSize: 15 },
});
