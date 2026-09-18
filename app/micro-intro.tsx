// Screen: Plan your date (Place -> Time -> Review) | Status: stable | Last updated: 2026-09-19 (3-step rewrite)
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
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

import { DateOptionChip } from '@/components/matches/DateOptionChip';
import { DatePlanProgress, type DatePlanStep } from '@/components/matches/DatePlanProgress';
import { MatchScoreBadge } from '@/components/matches/MatchScoreBadge';
import { PersonAvatar } from '@/components/matches/PersonAvatar';
import { TimeOptionChip } from '@/components/matches/TimeOptionChip';
import { VenueOptionCard } from '@/components/matches/VenueOptionCard';
import { ThemedText } from '@/components/themed-text';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { homeColors, homeRadius, homeSpacing } from '@/lib/homeTheme';
import {
  combineDateAndTime,
  formatDateChipParts,
  formatIntroLines,
  formatMeetingTime,
  sendMatchInvite,
  upcomingDateOptions,
  type IntroAnswers,
} from '@/lib/matchInvite';
import { GOOGLE_PLACES_CONFIGURED, searchPlaces, type PlaceSearchResult } from '@/lib/placeSearch';
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

/** Prefer a venue near both people over one only near you — otherwise the
 * suggestion ignores where the other person actually is (2026-08-24). */
function pickVenues(venues: VenueRow[], myDistrict: string | null, otherDistrict: string | null): PickedVenue[] {
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
const FIXED_TIME_OPTIONS = ['12:00', '14:00', '15:00', '17:30', '19:00', '20:30'];
const SEARCH_DEBOUNCE_MS = 300;

type VenueSelection =
  | { kind: 'suggested'; venue: PickedVenue }
  | { kind: 'search'; result: PlaceSearchResult }
  | { kind: 'custom'; text: string }
  | null;

function venueSelectionKey(v: VenueSelection): string | null {
  if (!v) return null;
  if (v.kind === 'suggested') return `suggested|${v.venue.name}|${v.venue.district}`;
  if (v.kind === 'search') return `search|${v.result.id}`;
  return `custom|${v.text}`;
}

/** "Name — District" (or just "Name" / just the area name) — same free-text
 * `matches.confirmed_place` shape this app has always used, so
 * `plan-detail.tsx`/`matches.tsx`'s existing `splitVenueText()` parsing
 * keeps working unchanged. */
function resolvePlaceLabel(selection: VenueSelection): string | null {
  if (!selection) return null;
  if (selection.kind === 'suggested') return `${selection.venue.name} — ${selection.venue.district}`;
  if (selection.kind === 'custom') {
    const t = selection.text.trim();
    return t ? normalizePlace(t) : null;
  }
  const r = selection.result;
  if (r.source === 'area') return r.name; // an area IS the district — nothing to pair it with
  const place = r.district ?? r.city ?? null;
  return place ? `${r.name} — ${place}` : r.name;
}

export default function MicroIntroScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();

  const matchUserId = firstParam(params.matchUserId);
  const matchName = firstParam(params.matchName) || 'them';
  const matchAge = firstParam(params.matchAge);
  const matchPhoto = firstParam(params.matchPhoto);
  const matchPercentage = firstParam(params.matchPercentage);
  const matchIdParam = firstParam(params.matchId);

  const [step, setStep] = useState<DatePlanStep>('place');

  // --- Place step state ---------------------------------------------
  const [venue, setVenue] = useState<VenueSelection>(null);
  const [venueOptions, setVenueOptions] = useState<PickedVenue[]>([]);
  const [venuesLoading, setVenuesLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PlaceSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  // One token per time this screen is mounted, reused across keystrokes —
  // wired now so a real Google provider (see lib/placeSearch.ts) is a
  // drop-in later; the local fallback ignores it.
  const sessionTokenRef = useRef(Math.random().toString(36).slice(2));

  // --- Time step state -------------------------------------------------
  const [dateOptions, setDateOptions] = useState<Date[]>([]);
  const [activeDateIndex, setActiveDateIndex] = useState(0);
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerDraft, setTimePickerDraft] = useState(new Date());

  // --- Send state --------------------------------------------------------
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [chatOpened, setChatOpened] = useState(false);
  const [savedAnswers, setSavedAnswers] = useState<IntroAnswers | null>(null);
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
        let myDays: string[] = [];
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('district, gender, availability_days')
            .eq('id', user.id)
            .maybeSingle();
          if (!mounted) return;
          userDistrict = profile?.district ?? null;
          setMyGender(profile?.gender ?? null);
          myDays = ((profile?.availability_days as string[] | null) ?? []).map((d) => d.toLowerCase());
        }

        let otherDistrict: string | null = null;
        let otherDays: string[] = [];
        if (matchUserId) {
          const { data: other } = await supabase
            .from('profiles')
            .select('gender, district, availability_days')
            .eq('id', matchUserId)
            .maybeSingle();
          if (!mounted) return;
          setOtherGender(other?.gender ?? null);
          otherDistrict = other?.district ?? null;
          otherDays = ((other?.availability_days as string[] | null) ?? []).map((d) => d.toLowerCase());
        }

        // Real intersection of both people's availability when both have
        // set one — falls back to just mine, then to a generic run of
        // upcoming days (upcomingDateOptions' own fallback) rather than
        // inventing a "shared" schedule neither of them actually has.
        const intersected = myDays.filter((d) => otherDays.includes(d));
        const effectiveDays = intersected.length > 0 ? intersected : myDays.length > 0 ? myDays : otherDays;
        setDateOptions(upcomingDateOptions(effectiveDays, 4));

        const { data: venues, error } = await supabase
          .from('venues')
          .select('name, district, emoji')
          .eq('is_active', true);

        if (!mounted) return;
        if (error || !venues || venues.length === 0) {
          setVenueOptions([]);
        } else {
          setVenueOptions(pickVenues(venues as VenueRow[], userDistrict, otherDistrict));
        }
      } catch {
        if (mounted) {
          setVenueOptions([]);
          setDateOptions(upcomingDateOptions(null, 4));
        }
      } finally {
        if (mounted) setVenuesLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [matchUserId]);

  // Debounced local/Google place search — only while the user is actively
  // typing (2+ chars); cleared results otherwise so the "Near both of you"
  // suggestions show instead.
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    const id = setTimeout(() => {
      searchPlaces(q, sessionTokenRef.current)
        .then((results) => setSearchResults(results))
        .catch(() => setSearchResults([]))
        .finally(() => setSearchLoading(false));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [searchQuery]);

  const resolvedPlace = useMemo(() => resolvePlaceLabel(venue), [venue]);
  const activeDate = dateOptions[activeDateIndex] ?? null;

  function toggleTimeChip(hhmm: string) {
    if (!activeDate) return;
    const iso = combineDateAndTime(activeDate, hhmm);
    setSelectedSlots((prev) => {
      if (prev.includes(iso)) return prev.filter((s) => s !== iso);
      if (prev.length >= MAX_SLOTS) return prev;
      return [...prev, iso];
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
    if (sending) return; // guards the double-tap while the request is in flight

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
          Alert.alert("You've used your invite for today", 'Come back tomorrow, or go Premium for 3/day ✨');
          return;
        }
        Alert.alert('Invite not sent', result.error ?? 'Something went wrong.');
        return;
      }

      // Success -> the `done` screen below. matches.tsx's own Ready/Plans
      // lists are re-fetched on focus (useFocusEffect), so going back to
      // Matches after this naturally drops the invited person from Ready
      // and shows them under "Waiting for them" in Plans — no separate
      // optimistic-update/rollback bookkeeping needed here.
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

  function goBack(from: DatePlanStep) {
    if (from === 'place') {
      router.canGoBack() ? router.back() : router.replace('/(tabs)/matches');
      return;
    }
    if (from === 'time') setStep('place');
    else setStep('time');
  }

  if (done) {
    const lines = formatIntroLines(savedAnswers);
    return (
      <ScreenContainer style={styles.container}>
        <View style={styles.doneWrap}>
          <View style={styles.doneIconWrap}>
            <Ionicons
              name={chatOpened ? 'chatbubbles-outline' : 'paper-plane-outline'}
              size={30}
              color={homeColors.accent}
            />
          </View>
          <ThemedText style={styles.doneTitle}>
            {chatOpened ? `Chat with ${matchName} is open` : `Invitation sent to ${matchName}`}
          </ThemedText>
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

  const canContinueFromPlace = !!resolvedPlace && !venuesLoading;
  const canContinueFromTime = selectedSlots.length >= 1;

  return (
    <ScreenContainer style={styles.container}>
      {/* Compact header — identical across all 3 steps (2026-09-19 brief:
          "üst bölüm tüm adımlarda kompakt kalmalı"). */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => goBack(step)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={24} color={homeColors.textPrimary} />
        </TouchableOpacity>
        <PersonAvatar photoUrl={matchPhoto || null} name={matchName} size={40} />
        <View style={styles.headerInfo}>
          <ThemedText style={styles.headerName} numberOfLines={1}>
            {matchName}
            {matchAge ? `, ${matchAge}` : ''}
          </ThemedText>
          {matchPercentage ? <MatchScoreBadge percentage={Number(matchPercentage) || 0} /> : null}
        </View>
      </View>

      <View style={styles.titleBlock}>
        <ThemedText style={styles.title}>Plan your date</ThemedText>
        <ThemedText style={styles.subtitle}>Choose a place and offer a few times.</ThemedText>
      </View>
      <View style={styles.progressWrap}>
        <DatePlanProgress current={step} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        {step === 'place' ? (
          <PlaceStep
            venue={venue}
            onSelectVenue={setVenue}
            venueOptions={venueOptions}
            venuesLoading={venuesLoading}
            matchName={matchName}
            searchQuery={searchQuery}
            onChangeSearchQuery={setSearchQuery}
            searchResults={searchResults}
            searchLoading={searchLoading}
          />
        ) : step === 'time' ? (
          <TimeStep
            resolvedPlace={resolvedPlace}
            onChangePlace={() => setStep('place')}
            dateOptions={dateOptions}
            activeDateIndex={activeDateIndex}
            onSelectDateIndex={setActiveDateIndex}
            activeDate={activeDate}
            selectedSlots={selectedSlots}
            onToggleTime={toggleTimeChip}
            onOpenTimePicker={openTimePicker}
            showTimePicker={showTimePicker}
            timePickerDraft={timePickerDraft}
            onTimePickerChange={onTimePickerChange}
            onConfirmPickedTime={() => {
              addPickedSlot(timePickerDraft.toISOString());
              setShowTimePicker(false);
            }}
          />
        ) : (
          <ReviewStep
            matchPhoto={matchPhoto}
            matchName={matchName}
            matchAge={matchAge}
            resolvedPlace={resolvedPlace}
            selectedSlots={selectedSlots}
            onEditPlace={() => setStep('place')}
            onEditTimes={() => setStep('time')}
          />
        )}

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, homeSpacing.md) }]}>
          {step === 'place' ? (
            <TouchableOpacity
              style={[styles.primaryBtn, !canContinueFromPlace && styles.btnDisabled]}
              disabled={!canContinueFromPlace}
              onPress={() => setStep('time')}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Continue"
              accessibilityState={{ disabled: !canContinueFromPlace }}>
              <ThemedText style={styles.primaryBtnText}>Continue</ThemedText>
            </TouchableOpacity>
          ) : step === 'time' ? (
            <TouchableOpacity
              style={[styles.primaryBtn, !canContinueFromTime && styles.btnDisabled]}
              disabled={!canContinueFromTime}
              onPress={() => setStep('review')}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Review invitation"
              accessibilityState={{ disabled: !canContinueFromTime }}>
              <ThemedText style={styles.primaryBtnText}>Review invitation</ThemedText>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.primaryBtn, sending && styles.btnDisabled]}
              disabled={sending}
              onPress={() => void handleSendInvite()}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Send invitation"
              accessibilityState={{ disabled: sending }}>
              {sending ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <ThemedText style={styles.primaryBtnText}>Send invitation</ThemedText>
              )}
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

// --- Step renderers ------------------------------------------------------
// Top-level (not nested inside MicroIntroScreen) on purpose: a function
// declared INSIDE a component body gets a new identity every render, which
// makes React treat it as a brand-new component type each time — for
// PlaceStep specifically that would remount its <TextInput> (and drop
// keyboard focus) on every keystroke, since typing re-renders the parent.
// All state lives in the parent and is passed down as props, so these stay
// simple prop-driven renderers, not a fragmentation-for-its-own-sake split.

function PlaceStep({
    venue,
    onSelectVenue,
    venueOptions,
    venuesLoading,
    matchName,
    searchQuery,
    onChangeSearchQuery,
    searchResults,
    searchLoading,
  }: {
    venue: VenueSelection;
    onSelectVenue: (v: VenueSelection) => void;
    venueOptions: PickedVenue[];
    venuesLoading: boolean;
    matchName: string;
    searchQuery: string;
    onChangeSearchQuery: (q: string) => void;
    searchResults: PlaceSearchResult[];
    searchLoading: boolean;
  }) {
    const isSearching = searchQuery.trim().length >= 2;
    const selectedKey = venueSelectionKey(venue);
    const noSearchMatches = isSearching && !searchLoading && searchResults.length === 0;

    return (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        <ThemedText style={styles.stepTitle}>Choose a place</ThemedText>

        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color={homeColors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search cafés or neighbourhoods"
            placeholderTextColor={homeColors.textSecondary}
            value={searchQuery}
            onChangeText={onChangeSearchQuery}
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchQuery.length > 0 ? (
            <TouchableOpacity
              onPress={() => onChangeSearchQuery('')}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={18} color={homeColors.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>

        {isSearching ? (
          <View style={styles.section}>
            {searchLoading ? (
              <ActivityIndicator color={homeColors.accent} style={styles.placeLoading} />
            ) : (
              <View style={styles.venueList}>
                {searchResults.map((r) => {
                  const key = `search|${r.id}`;
                  return (
                    <VenueOptionCard
                      key={key}
                      name={r.name}
                      district={r.source === 'area' ? r.city : r.district}
                      reason={null}
                      otherName={matchName}
                      selected={selectedKey === key}
                      onPress={() => onSelectVenue({ kind: 'search', result: r })}
                    />
                  );
                })}
                {noSearchMatches ? (
                  <View style={styles.venueList}>
                    <ThemedText style={styles.emptyHint}>No matches for “{searchQuery.trim()}”.</ThemedText>
                    <TouchableOpacity
                      style={[styles.row2, selectedKey === `custom|${searchQuery.trim()}` && styles.rowSelected]}
                      onPress={() => onSelectVenue({ kind: 'custom', text: searchQuery.trim() })}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel={`Use "${searchQuery.trim()}" as your place`}>
                      <Ionicons name="add-circle-outline" size={18} color={homeColors.accent} />
                      <ThemedText style={styles.useCustomText} numberOfLines={1}>
                        Use “{normalizePlace(searchQuery.trim())}”
                      </ThemedText>
                    </TouchableOpacity>
                  </View>
                ) : null}
                {GOOGLE_PLACES_CONFIGURED ? (
                  <ThemedText style={styles.poweredByGoogle}>Powered by Google</ThemedText>
                ) : null}
              </View>
            )}
          </View>
        ) : (
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Near both of you</ThemedText>
            {venuesLoading ? (
              <ActivityIndicator color={homeColors.accent} style={styles.placeLoading} />
            ) : (
              <View style={styles.venueList}>
                {venueOptions.map((v) => {
                  const key = `suggested|${v.name}|${v.district}`;
                  return (
                    <VenueOptionCard
                      key={key}
                      name={v.name}
                      district={v.district}
                      reason={v.reason}
                      otherName={matchName}
                      selected={selectedKey === key}
                      onPress={() => onSelectVenue({ kind: 'suggested', venue: v })}
                    />
                  );
                })}
                {venueOptions.length === 0 ? (
                  <ThemedText style={styles.emptyHint}>
                    No suggested venues nearby yet — search above to pick your own place.
                  </ThemedText>
                ) : null}
              </View>
            )}
            <TouchableOpacity
              style={styles.mapAction}
              onPress={() => Alert.alert('Coming soon', 'Picking a place on the map isn’t available yet.')}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Choose on map">
              <Ionicons name="map-outline" size={17} color={homeColors.textSecondary} />
              <ThemedText style={styles.mapActionText}>Choose on map</ThemedText>
              <Ionicons name="chevron-forward" size={16} color={homeColors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    );
  }

  function TimeStep({
    resolvedPlace,
    onChangePlace,
    dateOptions,
    activeDateIndex,
    onSelectDateIndex,
    activeDate,
    selectedSlots,
    onToggleTime,
    onOpenTimePicker,
    showTimePicker,
    timePickerDraft,
    onTimePickerChange,
    onConfirmPickedTime,
  }: {
    resolvedPlace: string | null;
    onChangePlace: () => void;
    dateOptions: Date[];
    activeDateIndex: number;
    onSelectDateIndex: (i: number) => void;
    activeDate: Date | null;
    selectedSlots: string[];
    onToggleTime: (hhmm: string) => void;
    onOpenTimePicker: () => void;
    showTimePicker: boolean;
    timePickerDraft: Date;
    onTimePickerChange: (e: DateTimePickerEvent, d?: Date) => void;
    onConfirmPickedTime: () => void;
  }) {
    const { venueName, venueDistrict } = (() => {
      if (!resolvedPlace) return { venueName: null, venueDistrict: null };
      const idx = resolvedPlace.indexOf(' — ');
      if (idx === -1) return { venueName: resolvedPlace, venueDistrict: null };
      return { venueName: resolvedPlace.slice(0, idx), venueDistrict: resolvedPlace.slice(idx + 3) };
    })();

    return (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        <View style={styles.placeSummaryCard}>
          <View style={styles.placeSummaryIconWrap}>
            <Ionicons name="cafe-outline" size={18} color={homeColors.accent} />
          </View>
          <View style={styles.placeSummaryInfo}>
            <ThemedText style={styles.placeSummaryName} numberOfLines={1}>
              {venueName}
            </ThemedText>
            {venueDistrict ? (
              <View style={styles.metaRow}>
                <Ionicons name="location-outline" size={12} color={homeColors.textSecondary} />
                <ThemedText style={styles.meta}>{venueDistrict}</ThemedText>
              </View>
            ) : null}
          </View>
          <TouchableOpacity onPress={onChangePlace} hitSlop={8} accessibilityRole="button" accessibilityLabel="Change place">
            <ThemedText style={styles.changeLink}>Change</ThemedText>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.stepTitle}>When works for you?</ThemedText>
          <ThemedText style={styles.hint}>Offer up to 3 options — they’ll choose one.</ThemedText>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateRow}>
            {dateOptions.map((d, i) => {
              const { weekday, dayMonth } = formatDateChipParts(d);
              return (
                <DateOptionChip
                  key={d.toISOString()}
                  weekday={weekday}
                  dayMonth={dayMonth}
                  selected={i === activeDateIndex}
                  onPress={() => onSelectDateIndex(i)}
                />
              );
            })}
          </ScrollView>

          <View style={styles.timeGrid}>
            {FIXED_TIME_OPTIONS.map((hhmm) => {
              const iso = activeDate ? combineDateAndTime(activeDate, hhmm) : null;
              const selected = !!iso && selectedSlots.includes(iso);
              const atCap = !selected && selectedSlots.length >= MAX_SLOTS;
              return (
                <View key={hhmm} style={styles.timeGridItem}>
                  <TimeOptionChip
                    label={hhmm}
                    selected={selected}
                    onPress={() => {
                      if (atCap) return;
                      onToggleTime(hhmm);
                    }}
                  />
                </View>
              );
            })}
          </View>

          <View style={styles.timeFooterRow}>
            <ThemedText style={styles.selectedCount}>{selectedSlots.length} of {MAX_SLOTS} selected</ThemedText>
            {selectedSlots.length < MAX_SLOTS ? (
              <TouchableOpacity
                style={styles.pickAnotherBtn}
                onPress={onOpenTimePicker}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Pick another time">
                <Ionicons name="add" size={15} color={homeColors.accent} />
                <ThemedText style={styles.pickAnotherText}>Pick another time</ThemedText>
              </TouchableOpacity>
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
                  onPress={onConfirmPickedTime}
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
    );
  }

  function ReviewStep({
    matchPhoto,
    matchName,
    matchAge,
    resolvedPlace,
    selectedSlots,
    onEditPlace,
    onEditTimes,
  }: {
    matchPhoto: string;
    matchName: string;
    matchAge: string;
    resolvedPlace: string | null;
    selectedSlots: string[];
    onEditPlace: () => void;
    onEditTimes: () => void;
  }) {
    const { venueName, venueDistrict } = (() => {
      if (!resolvedPlace) return { venueName: null, venueDistrict: null };
      const idx = resolvedPlace.indexOf(' — ');
      if (idx === -1) return { venueName: resolvedPlace, venueDistrict: null };
      return { venueName: resolvedPlace.slice(0, idx), venueDistrict: resolvedPlace.slice(idx + 3) };
    })();

    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ThemedText style={styles.stepTitle}>Review your invitation</ThemedText>

        <View style={styles.reviewProfileRow}>
          <PersonAvatar photoUrl={matchPhoto || null} name={matchName} size={52} />
          <ThemedText style={styles.reviewProfileName}>
            {matchName}
            {matchAge ? `, ${matchAge}` : ''}
          </ThemedText>
        </View>

        <View style={styles.reviewCard}>
          <View style={styles.reviewCardHeaderRow}>
            <ThemedText style={styles.reviewCardHeading}>Place</ThemedText>
            <TouchableOpacity onPress={onEditPlace} hitSlop={8} accessibilityRole="button" accessibilityLabel="Edit place">
              <ThemedText style={styles.changeLink}>Edit</ThemedText>
            </TouchableOpacity>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="cafe-outline" size={15} color={homeColors.accent} />
            <ThemedText style={styles.reviewPlaceName}>{venueName}</ThemedText>
          </View>
          {venueDistrict ? (
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={13} color={homeColors.textSecondary} />
              <ThemedText style={styles.meta}>{venueDistrict}</ThemedText>
            </View>
          ) : null}
        </View>

        <View style={styles.reviewCard}>
          <View style={styles.reviewCardHeaderRow}>
            <ThemedText style={styles.reviewCardHeading}>Times offered</ThemedText>
            <TouchableOpacity onPress={onEditTimes} hitSlop={8} accessibilityRole="button" accessibilityLabel="Edit times">
              <ThemedText style={styles.changeLink}>Edit</ThemedText>
            </TouchableOpacity>
          </View>
          {selectedSlots.map((iso) => (
            <View key={iso} style={styles.reviewTimeRow}>
              <Ionicons name="calendar-outline" size={15} color={homeColors.accent} />
              <ThemedText style={styles.reviewTimeText}>{formatMeetingTime(iso)}</ThemedText>
            </View>
          ))}
        </View>

        <View style={styles.expiryHint}>
          <Ionicons name="time-outline" size={14} color={homeColors.textSecondary} />
          <ThemedText style={styles.expiryHintText}>
            {matchName} will have 24h to respond once you send this.
          </ThemedText>
        </View>
      </ScrollView>
    );
  }

const styles = StyleSheet.create({
  container: { justifyContent: 'flex-start', backgroundColor: homeColors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: homeSpacing.sm + 2,
    paddingHorizontal: homeSpacing.lg,
    paddingTop: 4,
  },
  backBtn: { padding: 6, marginLeft: -6 },
  headerInfo: { flex: 1, gap: 4 },
  headerName: { fontSize: 15.5, fontWeight: '700', color: homeColors.textPrimary },

  titleBlock: { paddingHorizontal: homeSpacing.lg, marginTop: homeSpacing.sm + 2 },
  title: { fontSize: 22, fontWeight: '800', color: homeColors.textPrimary },
  subtitle: { fontSize: 13.5, color: homeColors.textSecondary, marginTop: 2 },
  progressWrap: { paddingHorizontal: homeSpacing.lg, marginTop: homeSpacing.sm + 2, marginBottom: homeSpacing.sm },

  scroll: { flex: 1 },
  content: { paddingHorizontal: homeSpacing.lg, paddingBottom: 24, gap: homeSpacing.lg },
  stepTitle: { fontSize: 19, fontWeight: '800', color: homeColors.textPrimary },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: homeSpacing.sm,
    backgroundColor: homeColors.surface,
    borderRadius: homeRadius.cardSmall,
    borderWidth: 1.5,
    borderColor: homeColors.border,
    paddingHorizontal: 14,
    minHeight: 46,
  },
  searchInput: { flex: 1, fontSize: 14.5, color: homeColors.textPrimary, paddingVertical: 10 },

  section: { gap: homeSpacing.sm + 2 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: homeColors.textPrimary },
  hint: { fontSize: 12.5, color: homeColors.textSecondary, marginTop: -6 },
  placeLoading: { marginVertical: 12 },
  venueList: { gap: homeSpacing.sm },
  emptyHint: { fontSize: 13, color: homeColors.textSecondary, fontStyle: 'italic' },

  row2: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: homeSpacing.sm,
    minHeight: 44,
    borderRadius: homeRadius.cardSmall,
    borderWidth: 1.5,
    borderColor: homeColors.border,
    borderStyle: 'dashed',
    paddingHorizontal: homeSpacing.sm + 2,
  },
  rowSelected: { borderColor: homeColors.accent, backgroundColor: homeColors.accentSoft, borderStyle: 'solid' },
  useCustomText: { flex: 1, fontSize: 13.5, fontWeight: '600', color: homeColors.textPrimary },
  poweredByGoogle: { fontSize: 11, color: homeColors.textSecondary, textAlign: 'right', marginTop: 2 },

  mapAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: homeSpacing.sm,
    minHeight: 44,
    paddingVertical: 8,
  },
  mapActionText: { flex: 1, fontSize: 13.5, fontWeight: '600', color: homeColors.textSecondary },

  placeSummaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: homeSpacing.sm + 2,
    backgroundColor: homeColors.surface,
    borderRadius: homeRadius.cardSmall,
    borderWidth: 1,
    borderColor: homeColors.border,
    padding: homeSpacing.sm + 2,
  },
  placeSummaryIconWrap: {
    width: 36,
    height: 36,
    borderRadius: homeRadius.cardSmall - 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: homeColors.accentSoft,
  },
  placeSummaryInfo: { flex: 1, gap: 2 },
  placeSummaryName: { fontSize: 14.5, fontWeight: '700', color: homeColors.textPrimary },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  meta: { fontSize: 12.5, color: homeColors.textSecondary },
  changeLink: { fontSize: 13.5, fontWeight: '700', color: homeColors.accent },

  dateRow: { flexDirection: 'row', gap: homeSpacing.sm, paddingVertical: 2 },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: homeSpacing.sm, marginTop: homeSpacing.sm },
  timeGridItem: { width: '31%' },
  timeFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  selectedCount: { fontSize: 13, color: homeColors.textSecondary, fontWeight: '600' },
  pickAnotherBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 44,
    paddingHorizontal: 4,
  },
  pickAnotherText: { fontSize: 13, fontWeight: '700', color: homeColors.accent },

  timePickerColumn: { gap: 8, alignItems: 'stretch', marginTop: 4 },
  timePickerSpinner: { alignSelf: 'stretch', width: '100%', height: 180, backgroundColor: '#FFFFFF' },
  addSlotBtnWide: {
    backgroundColor: homeColors.accent,
    borderRadius: homeRadius.cardSmall,
    paddingVertical: 14,
    alignItems: 'center',
  },
  addSlotBtnText: { color: '#FFF', fontWeight: '600' },

  reviewProfileRow: { flexDirection: 'row', alignItems: 'center', gap: homeSpacing.sm + 2 },
  reviewProfileName: { fontSize: 17, fontWeight: '700', color: homeColors.textPrimary },
  reviewCard: {
    backgroundColor: homeColors.surface,
    borderRadius: homeRadius.card,
    borderWidth: 1,
    borderColor: homeColors.border,
    padding: homeSpacing.md,
    gap: 6,
  },
  reviewCardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reviewCardHeading: { fontSize: 13.5, fontWeight: '800', color: homeColors.textSecondary },
  reviewPlaceName: { fontSize: 16, fontWeight: '700', color: homeColors.textPrimary },
  reviewTimeRow: { flexDirection: 'row', alignItems: 'center', gap: homeSpacing.sm, paddingVertical: 2 },
  reviewTimeText: { flex: 1, fontSize: 14.5, fontWeight: '600', color: homeColors.textPrimary },

  expiryHint: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  expiryHintText: { fontSize: 12.5, color: homeColors.textSecondary, flex: 1 },

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
