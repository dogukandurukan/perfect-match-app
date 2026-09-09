// Screen: Hey tab (activity + likes teaser) | Status: test | Last updated: Ağustos 2026
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  SectionList,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { ErrorState } from '@/components/ErrorState';
import { ThemedText } from '@/components/themed-text';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { colors, radius } from '@/lib/designTokens';
import { formatRelativeTime } from '@/lib/labels';
import {
  acceptMatchInvite,
  formatIntroLines,
  formatMeetingTime,
  introAnswersForUser,
} from '@/lib/matchInvite';
import { emitUnreadNotificationCount } from '@/lib/unreadNotificationCount';
import { resolveProfilePhotoUrl } from '@/lib/userPhotosStorage';
import { supabase } from '@/lib/supabaseClient';

type NotificationType = string;

type NotificationRow = {
  id: string;
  type: NotificationType;
  text: string;
  is_read: boolean;
  related_user_id: string | null;
  created_at: string;
  relatedName: string | null;
  // Client-only, set right when the user acts (accept/decline/pick time) so a
  // handled featured card demotes into the feed as a small trace of what
  // happened, instead of just vanishing — otherwise Buzz goes straight back
  // to "just the likes box" the moment you use it. Not persisted; a fresh
  // fetch falls back to the generic per-type copy in feedRowText.
  resolvedSummary?: string;
};

// A single row from the `get_my_likers` RPC. Non-premium callers get every
// identity field back as null (server-side gate) — only `totalCount` is safe
// to use unconditionally.
type LikerRow = {
  likerId: string | null;
  firstName: string | null;
  photoPath: string | null;
  targetType: string | null;
  targetKey: string | null;
  note: string | null;
  createdAt: string;
};

// Resolved-for-render version of a premium (unlocked) liker tile.
type UnlockedLiker = { likerId: string; firstName: string | null; photoUrl: string | null };

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];
type IconSpec = { name: IoniconName; color: string; bg: string };

// --- Notification classification (single source of truth) --------------------
// Phase B: the LIKE teaser (count + avatars) is now sourced from the real
// `likes` table via `get_my_likers`, not from `notifications`. These types are
// kept only to filter any legacy like-flavored notification rows out of the
// compact feed, so they don't show twice.
const LIKE_TYPES = new Set(['like', 'new_like', 'someone_liked', 'new_match']);
const FEATURED_TYPES = new Set([
  'invite_accepted',
  'mutual_match',
  'new_invite',
  'meeting_invite',
  'meetup_reminder',
  'meetup_reminder_morning',
]);
const isLikeType = (t: NotificationType) => LIKE_TYPES.has(t);
const isFeaturedType = (t: NotificationType) => FEATURED_TYPES.has(t);

// Blurred face tiles shown before the "+N" counter tile in the likes strip.
const LIKE_FACE_TILES = 3;

function typeIcon(type: NotificationType): IconSpec {
  switch (type) {
    case 'new_message':
    case 'message':
      return { name: 'chatbubble-ellipses', color: '#3B7DD8', bg: '#E6EEFB' };
    case 'checkin':
    case 'check_in':
    case 'post_date':
      return { name: 'location', color: '#0FA3A3', bg: '#E0F5F5' };
    case 'match_expiring':
    case 'match_expiry':
    case 'expires_soon':
      return { name: 'hourglass', color: '#E08A00', bg: '#FCEFD6' };
    // "Your activity" rows (demoted invites, likes sent) — one warm
    // accent-gold tone shared across both, distinguished by icon shape only,
    // instead of a mismatched green/red pair.
    case 'new_invite':
    case 'meeting_invite':
      return { name: 'checkmark-circle-outline', color: colors.accent, bg: '#FBF3DF' };
    case 'mutual_match':
      return { name: 'heart-circle', color: '#FF3B5C', bg: '#FFE7EC' };
    case 'like_sent':
      return { name: 'heart-outline', color: colors.accent, bg: '#FBF3DF' };
    case 'meetup_reminder':
      return { name: 'cafe-outline', color: colors.accent, bg: '#FBF3DF' };
    case 'meetup_reminder_morning':
      return { name: 'sunny-outline', color: colors.accent, bg: '#FBF3DF' };
    default:
      return { name: 'notifications', color: colors.textMuted, bg: '#F0F0F0' };
  }
}

// Compact feed rows handle non-like items, plus already-handled (read)
// featured items demoted here instead of vanishing (see NotificationRow.resolvedSummary).
// Instagram-style date grouping for the compact feed (CLAUDE.md §4 —
// "activity history" visual pass; the data-layer half, pulling in `likes`
// sent, is a separate follow-up).
const DATE_BUCKET_ORDER = ['Today', 'Yesterday', 'This week', 'Earlier'] as const;

function dateBucketLabel(iso: string): (typeof DATE_BUCKET_ORDER)[number] {
  const d = new Date(iso);
  const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor(
    (startOfDay(new Date()).getTime() - startOfDay(d).getTime()) / 86_400_000,
  );
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays <= 6) return 'This week';
  return 'Earlier';
}

function feedRowText(
  item: NotificationRow,
  place?: string,
  confirmedSlot?: string,
  confirmedPlace?: string,
): string {
  const who = item.relatedName?.trim() || 'Someone';
  const effectivePlace = confirmedPlace || place;

  // Live, just-acted-on summary ("You said yes to X — Saturday morning") —
  // already complete, don't also append place/time again below it (that was
  // the duplicated-looking text bug).
  if (item.resolvedSummary) return item.resolvedSummary;

  switch (item.type) {
    case 'new_message':
    case 'message':
      return `${who} sent you a message`;
    case 'checkin':
    case 'check_in':
    case 'post_date':
      return `How did it go with ${who}?`;
    case 'match_expiring':
    case 'match_expiry':
    case 'expires_soon':
      return `Your match with ${who} expires soon`;
    case 'mutual_match':
      return `You matched with ${who}! Say hi 👋`;
    // Demoted featured cards without a fresh in-session summary (e.g. after
    // reload) — rebuilt from persisted data (matches.meeting_at/confirmed_place),
    // not just the raw proposal, so a reload doesn't lose what was decided.
    case 'new_invite':
    case 'meeting_invite':
      if (confirmedSlot) {
        return effectivePlace
          ? `You said yes to ${who} — ${confirmedSlot} at ${effectivePlace}`
          : `You said yes to ${who} — ${confirmedSlot}`;
      }
      return effectivePlace
        ? `You responded to ${who}'s invite — ${effectivePlace}`
        : `You responded to ${who}'s invite`;
    case 'meetup_reminder':
      return `You responded to today's reminder about ${who}`;
    case 'meetup_reminder_morning':
      return `You confirmed this morning's plan with ${who}`;
    default:
      return 'New notification';
  }
}

// `invite_accepted`/message types deep-link straight into that person's chat
// (not just the Chats list — otherwise "Pick time" dumps you on the list and
// you have to find them again). Falls back to the list when we don't know who.
function routeForType(
  item: NotificationRow,
): { pathname: string; params?: Record<string, string> } {
  switch (item.type) {
    case 'invite_accepted':
    case 'mutual_match':
    case 'new_message':
    case 'message':
      return item.related_user_id
        ? {
            pathname: '/chat',
            params: { userId: item.related_user_id, userName: item.relatedName ?? '' },
          }
        : { pathname: '/(tabs)/messages' };
    default:
      return { pathname: '/(tabs)/matches' };
  }
}

// --- Premium "Likes You" teaser ---------------------------------------------
// Locked (free): count only, from `get_my_likers.total_count` — the RPC gates
// identity server-side, so there is no photo/name to render here at all
// (previously this blurred a real photo client-side, which still leaked the
// liker's identity to anyone inspecting the response; anonymous tiles fix that).
// Unlocked (premium): RPC returns real liker_id/first_name/photo_path — tiles
// show the real (unblurred) photo and are tappable straight to their profile.
function LikesSection({
  count,
  unlocked,
  likers,
  onPressLocked,
  onPressLiker,
}: {
  count: number;
  unlocked: boolean;
  likers: UnlockedLiker[];
  onPressLocked: () => void;
  onPressLiker: (likerId: string) => void;
}) {
  if (count <= 0) return null;
  const title = count === 1 ? '1 person likes you' : `${count} people like you`;

  if (!unlocked) {
    const anonymousTiles = Math.min(count, LIKE_FACE_TILES);
    const remainder = count - anonymousTiles;
    return (
      <TouchableOpacity
        style={styles.likes}
        onPress={onPressLocked}
        activeOpacity={0.9}
        accessibilityRole="button"
        accessibilityLabel={`${title}. Unlock to see who.`}>
        <ThemedText style={styles.likesTitle}>{title}</ThemedText>
        <ThemedText style={styles.likesSub}>Someone new is into you — unlock to see who</ThemedText>

        <View style={styles.likesStrip}>
          {Array.from({ length: anonymousTiles }).map((_, i) => (
            <View key={i} style={[styles.likeTile, styles.likeTileFallback]}>
              <Ionicons name="heart" size={22} color="#1A1A1A" />
            </View>
          ))}
          {remainder > 0 ? (
            <View style={[styles.likeTile, styles.likeTileMore]}>
              <ThemedText style={styles.likeTileMoreText}>+{remainder}</ThemedText>
            </View>
          ) : null}
        </View>

        <View style={styles.likesUnlock}>
          <Ionicons name="lock-closed" size={15} color="#FFFFFF" />
          <ThemedText style={styles.likesUnlockText}>Unlock to see who likes you</ThemedText>
        </View>
      </TouchableOpacity>
    );
  }

  const faces = likers.slice(0, LIKE_FACE_TILES);
  const remainder = count - faces.length;
  const unlockedTitle =
    count === 1 && faces[0]?.firstName ? `${faces[0].firstName} likes you` : title;

  return (
    <View style={styles.likes}>
      <ThemedText style={styles.likesTitle}>{unlockedTitle}</ThemedText>
      <ThemedText style={styles.likesSub}>Tap someone to see their profile</ThemedText>

      <View style={styles.likesStrip}>
        {faces.map((liker) => (
          <TouchableOpacity
            key={liker.likerId}
            style={styles.likeTile}
            onPress={() => onPressLiker(liker.likerId)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`Open ${liker.firstName ?? 'their'} profile`}>
            {liker.photoUrl ? (
              <Image
                source={{ uri: liker.photoUrl }}
                style={styles.likeTileImg}
                contentFit="cover"
                transition={150}
              />
            ) : (
              <View style={[styles.likeTileImg, styles.likeTileFallback]}>
                <ThemedText style={styles.likeTileInitial}>
                  {(liker.firstName ?? '♥').charAt(0).toUpperCase()}
                </ThemedText>
              </View>
            )}
          </TouchableOpacity>
        ))}
        {remainder > 0 ? (
          <View style={[styles.likeTile, styles.likeTileMore]}>
            <ThemedText style={styles.likeTileMoreText}>+{remainder}</ThemedText>
          </View>
        ) : null}
      </View>
    </View>
  );
}

// --- Zero-activity empty state: activation checklist, not a fake/blank screen --
// UI-3 (CLAUDE.md §4/§5): no fake likes on 0-state — show a real, actionable path
// (profile completeness) instead of "nothing here yet".
type ActivationChecklist = { hasPhoto: boolean; hasPrompt: boolean; hasSentLike: boolean };

function BuzzActivationCard({
  checklist,
  onGoProfile,
  onGoHome,
}: {
  checklist: ActivationChecklist;
  onGoProfile: () => void;
  onGoHome: () => void;
}) {
  const items: { key: string; done: boolean; icon: IoniconName; label: string; onPress: () => void }[] = [
    { key: 'photo', done: checklist.hasPhoto, icon: 'camera-outline', label: 'Add a photo', onPress: onGoProfile },
    {
      key: 'prompt',
      done: checklist.hasPrompt,
      icon: 'chatbubble-ellipses-outline',
      label: 'Answer a prompt',
      onPress: onGoProfile,
    },
    { key: 'like', done: checklist.hasSentLike, icon: 'heart-outline', label: 'Send your first like', onPress: onGoHome },
  ];
  const doneCount = items.filter((i) => i.done).length;

  return (
    <View style={styles.activation}>
      <ThemedText style={styles.activationTitle}>Get your profile buzz-ready</ThemedText>
      <ThemedText style={styles.activationSub}>
        {doneCount}/{items.length} done — finish these and Buzz fills up here
      </ThemedText>
      <View style={styles.activationBar}>
        <View style={[styles.activationBarFill, { width: `${(doneCount / items.length) * 100}%` }]} />
      </View>
      {items.map((item) => (
        <TouchableOpacity
          key={item.key}
          style={styles.activationRow}
          onPress={item.onPress}
          disabled={item.done}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={item.label}
          accessibilityState={{ disabled: item.done }}>
          <Ionicons
            name={item.done ? 'checkmark-circle' : item.icon}
            size={20}
            color={item.done ? '#2E9E5B' : colors.textMuted}
          />
          <ThemedText style={[styles.activationRowText, item.done && styles.activationRowDone]}>
            {item.label}
          </ThemedText>
          {!item.done ? <Ionicons name="chevron-forward" size={16} color={colors.textMuted} /> : null}
        </TouchableOpacity>
      ))}
    </View>
  );
}

// --- Featured high-signal event (said yes / wants to meet) -------------------
// "Wants to meet" gets inline Accept/Not now — no detour through Matches to
// answer yes/no (that's the whole point of surfacing it here). "Said yes"
// still routes to chat via the single CTA — that flow is unchanged today.
function FeaturedCard({
  item,
  photoUrl,
  introLines,
  slotOptions,
  confirmedSlot,
  confirmedPlace,
  onPress,
  onAccept,
  onDecline,
  onCheckinYes,
  onCheckinNo,
  onMorningYes,
  onMorningNo,
  responding,
}: {
  item: NotificationRow;
  photoUrl: string | null;
  introLines?: string[];
  slotOptions?: string[];
  confirmedSlot?: string;
  confirmedPlace?: string;
  onPress: () => void;
  onAccept?: (slot: string | null, place: string | null) => void;
  onDecline?: () => void;
  onCheckinYes?: () => void;
  onCheckinNo?: () => void;
  onMorningYes?: () => void;
  onMorningNo?: () => void;
  responding?: boolean;
}) {
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerDraft, setTimePickerDraft] = useState(new Date());
  const [showCustomPlace, setShowCustomPlace] = useState(false);
  const [customPlace, setCustomPlace] = useState('');
  const name = item.relatedName?.trim() || 'Someone';
  const accepted = item.type === 'invite_accepted';
  const isMutualMatch = item.type === 'mutual_match';
  // Two-stage day-of reminder (CLAUDE.md §4, 2026-08-29): a morning,
  // future-tense nudge ("are you still on?") and — separately — an
  // after-the-fact, past-tense check-in ("did you go?") once meeting_at has
  // passed. Keeping the tenses straight is the whole point of the split (an
  // earlier single-stage version asked "did you go?" before the meetup had
  // even happened, which read as nonsensical — found via device testing,
  // 2026-08-27).
  const isMorning = item.type === 'meetup_reminder_morning';
  const isReminder = item.type === 'meetup_reminder';
  const title = isMorning
    ? `Meeting ${name} today?`
    : isReminder
      ? `Did you meet up with ${name}?`
      : accepted
        ? `${name} said yes`
        : isMutualMatch
          ? `You matched with ${name}!`
          : `${name} wants to meet`;
  const sub = isMorning
    ? "Let us know if you're still on"
    : isReminder
      ? 'Let us know how it went'
      : accepted
        ? confirmedSlot
          ? `Confirmed: ${confirmedSlot}`
          : 'Pick a time to meet up'
        : isMutualMatch
          ? 'Say hi 👋'
          : 'Coffee invite';
  const badge: IconSpec = isMorning
    ? { name: 'sunny', color: colors.accent, bg: '#FBF3DF' }
    : isMutualMatch
      ? { name: 'heart-circle', color: '#FF3B5C', bg: '#FFE7EC' }
      : isReminder
      ? { name: 'cafe', color: colors.accent, bg: '#FBF3DF' }
      : accepted
        ? { name: 'checkmark-circle', color: '#2E9E5B', bg: '#E4F5EA' }
        : { name: 'cafe', color: colors.accent, bg: '#FBF3DF' };

  const place = introLines?.[0];
  const times = slotOptions ?? [];
  // Invitee isn't limited to the inviter's 3 slots — "Suggest another time"
  // opens a real date/time picker to counter-propose, same as the inviter
  // could enter a custom slot in micro-intro.tsx. Symmetric, and always a
  // real Date either way (2026-08-24 — CLAUDE.md §4 "real dates" pass).
  const effectiveSlot = selectedSlot;
  // null here means "the inviter's proposed place stands" — place always has
  // a default, so unlike time this is never required to accept.
  const effectivePlace = showCustomPlace ? customPlace.trim() || null : null;

  function openTimePicker() {
    const draft = new Date();
    draft.setMinutes(0, 0, 0);
    draft.setHours(draft.getHours() + 1);
    setTimePickerDraft(draft);
    setShowTimePicker(true);
  }

  function onTimePickerChange(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
      if (event.type === 'set' && selected) setSelectedSlot(selected.toISOString());
      return;
    }
    if (selected) setTimePickerDraft(selected);
  }

  // Accepting without picking/entering a time isn't allowed once there are
  // times to pick from — otherwise there's nothing to confirm on the
  // inviter's side later.
  const acceptDisabled = times.length > 0 && !effectiveSlot;

  // Non-accepted cards have real interactive content now (chips, text
  // inputs) — wrapping the whole thing in one giant TouchableOpacity let taps
  // meant for the TextInput get swallowed by the card's own onPress and
  // silently dismiss it. Only the accepted ("said yes" → tap-to-chat) card
  // is still a single big button; the rest is a plain View, ✕/✓ are the
  // only ways to resolve it.
  const cardBody = (
    <>
      <View style={styles.featuredMainRow}>
        <View style={styles.featuredAvatarWrap}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.featuredAvatar} contentFit="cover" transition={150} />
          ) : (
            <View style={[styles.featuredAvatar, styles.featuredAvatarFallback]}>
              <ThemedText style={styles.featuredInitial}>{name.charAt(0).toUpperCase()}</ThemedText>
            </View>
          )}
          <View style={[styles.featuredBadge, { backgroundColor: badge.bg }]}>
            <Ionicons name={badge.name} size={14} color={badge.color} />
          </View>
        </View>

        <View style={styles.featuredBody}>
          <ThemedText style={styles.featuredTitle}>{title}</ThemedText>
          <ThemedText style={styles.featuredSub}>{sub}</ThemedText>
        </View>

        {isMorning ? (
          responding ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <View style={styles.respondRow}>
              <TouchableOpacity
                style={styles.respondDecline}
                onPress={onMorningNo}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`No, not meeting ${name} today`}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={16} color={colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.respondAccept}
                onPress={onMorningYes}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={`Yes, still meeting ${name} today`}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          )
        ) : isReminder ? (
          responding ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <View style={styles.respondRow}>
              <TouchableOpacity
                style={styles.respondDecline}
                onPress={onCheckinNo}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`No, didn't meet ${name}`}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={16} color={colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.respondAccept}
                onPress={onCheckinYes}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={`Yes, met ${name}`}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          )
        ) : accepted ? (
          <View style={[styles.featuredCta, styles.featuredCtaAccepted]}>
            <ThemedText style={styles.featuredCtaText}>
              {confirmedSlot ? 'Open chat' : 'Pick time'}
            </ThemedText>
          </View>
        ) : isMutualMatch ? (
          <View style={[styles.featuredCta, styles.featuredCtaAccepted]}>
            <ThemedText style={styles.featuredCtaText}>Open chat</ThemedText>
          </View>
        ) : responding ? (
          <ActivityIndicator size="small" color={colors.accent} />
        ) : (
          <View style={styles.respondRow}>
            <TouchableOpacity
              style={styles.respondDecline}
              onPress={onDecline}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Not now, ${name}`}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={16} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.respondAccept, acceptDisabled && styles.respondAcceptDisabled]}
              onPress={() => onAccept?.(effectiveSlot, effectivePlace)}
              disabled={acceptDisabled}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={
                acceptDisabled ? `Pick a time first to accept ${name}'s invite` : `Accept ${name}'s invite`
              }
              accessibilityState={{ disabled: acceptDisabled }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="checkmark" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {!isMorning && !isReminder && !accepted && place ? (
        <View style={styles.featuredInfoBlock}>
          <View style={styles.featuredInfoRow}>
            <Ionicons name="location-outline" size={13} color={colors.accent} />
            <ThemedText style={styles.featuredInfoText} numberOfLines={1}>
              {showCustomPlace && customPlace.trim() ? customPlace.trim() : place}
            </ThemedText>
          </View>
          {showCustomPlace ? (
            <TextInput
              style={styles.slotCustomInput}
              placeholder="e.g. a place near you"
              placeholderTextColor={colors.textMuted}
              value={customPlace}
              onChangeText={setCustomPlace}
              autoFocus
            />
          ) : (
            <TouchableOpacity
              onPress={() => setShowCustomPlace(true)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Suggest a different place"
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
              <ThemedText style={styles.placeSuggestLink}>Suggest a different place</ThemedText>
            </TouchableOpacity>
          )}
          {times.length > 0 ? (
            <>
              <ThemedText style={styles.slotHint}>Pick one to accept</ThemedText>
              <View style={styles.slotChipsRow}>
                {times.map((t) => {
                  const on = selectedSlot === t;
                  return (
                    <TouchableOpacity
                      key={t}
                      style={[styles.slotChip, on && styles.slotChipSelected]}
                      onPress={() => {
                        setSelectedSlot(t);
                        setShowTimePicker(false);
                      }}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel={formatMeetingTime(t)}
                      accessibilityState={{ selected: on }}>
                      <ThemedText style={[styles.slotChipText, on && styles.slotChipTextSelected]}>
                        {formatMeetingTime(t)}
                      </ThemedText>
                    </TouchableOpacity>
                  );
                })}
                {selectedSlot && !times.includes(selectedSlot) ? (
                  <TouchableOpacity
                    style={[styles.slotChip, styles.slotChipSelected]}
                    onPress={openTimePicker}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={formatMeetingTime(selectedSlot)}
                    accessibilityState={{ selected: true }}>
                    <ThemedText style={[styles.slotChipText, styles.slotChipTextSelected]}>
                      {formatMeetingTime(selectedSlot)}
                    </ThemedText>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.slotChip, showTimePicker && styles.slotChipSelected]}
                    onPress={openTimePicker}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Suggest another time"
                    accessibilityState={{ selected: showTimePicker }}>
                    <ThemedText
                      style={[styles.slotChipText, showTimePicker && styles.slotChipTextSelected]}>
                      Suggest another time
                    </ThemedText>
                  </TouchableOpacity>
                )}
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
                  />
                  {Platform.OS === 'ios' ? (
                    <TouchableOpacity
                      style={styles.addSlotBtnWide}
                      onPress={() => {
                        setSelectedSlot(timePickerDraft.toISOString());
                        setShowTimePicker(false);
                      }}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityLabel="Use this time">
                      <ThemedText style={styles.addSlotBtnWideText}>Use this time</ThemedText>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : null}
            </>
          ) : null}
        </View>
      ) : null}

      {accepted && (confirmedPlace || place || confirmedSlot) ? (
        <View style={styles.featuredInfoBlock}>
          {confirmedPlace || place ? (
            <View style={styles.featuredInfoRow}>
              <Ionicons name="location-outline" size={13} color={colors.accent} />
              <ThemedText style={styles.featuredInfoText} numberOfLines={1}>
                {confirmedPlace || place}
              </ThemedText>
            </View>
          ) : null}
          {confirmedSlot ? (
            <View style={styles.featuredInfoRow}>
              <Ionicons name="checkmark-circle-outline" size={13} color="#2E9E5B" />
              <ThemedText style={styles.featuredInfoText} numberOfLines={1}>
                {confirmedSlot}
              </ThemedText>
            </View>
          ) : null}
        </View>
      ) : null}
    </>
  );

  if (accepted || isMutualMatch) {
    return (
      <TouchableOpacity
        style={[styles.featured, !item.is_read && styles.featuredUnread]}
        onPress={onPress}
        activeOpacity={0.9}
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${sub}`}>
        {cardBody}
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.featured, !item.is_read && styles.featuredUnread]}>{cardBody}</View>
  );
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [photoById, setPhotoById] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  // Proposed place + time slots for pending "wants to meet" invites, keyed by
  // the inviter's user id — so Accept/Decline isn't blind (Matches already
  // shows this on the incoming-invite card, Buzz didn't).
  const [introLinesById, setIntroLinesById] = useState<Record<string, string[]>>({});
  // Raw ISO datetime strings for the 3 proposed slots (formatIntroLines gives
  // display text, but the chip picker needs the real value to save on accept).
  const [slotOptionsById, setSlotOptionsById] = useState<Record<string, string[]>>({});
  // Confirmed meeting time the invitee picked at accept time (matches.meeting_at,
  // formatted for display) — shown on the inviter's "said yes" card.
  const [confirmedSlotById, setConfirmedSlotById] = useState<Record<string, string>>({});
  // Counter-proposed place (matches.confirmed_place) — set only if the
  // invitee suggested somewhere other than the inviter's original pick.
  const [confirmedPlaceById, setConfirmedPlaceById] = useState<Record<string, string>>({});
  // matchId/isUserA for the active match per related user — meetup_reminder's
  // ✓/✕ writes checkin_a/checkin_b directly, so it needs the match row id
  // (notifications has no metadata column to carry it).
  const [matchIdByOtherId, setMatchIdByOtherId] = useState<Record<string, string>>({});
  const [isUserAByOtherId, setIsUserAByOtherId] = useState<Record<string, boolean>>({});

  // Buzz Faz B: real "who likes you" teaser, sourced from `get_my_likers` —
  // gated server-side, not derived from `notifications`. Fetch failures here
  // degrade the teaser to 0 (hidden) rather than blocking the whole screen,
  // same pattern as the old `intentRows` degrade (CLAUDE.md §0.5).
  const [likeCount, setLikeCount] = useState(0);
  const [likeUnlocked, setLikeUnlocked] = useState(false);
  const [likers, setLikers] = useState<UnlockedLiker[]>([]);

  const fetchLikers = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_my_likers');
    if (error || !data || data.length === 0) {
      if (error) console.warn('get_my_likers failed', error.message);
      setLikeCount(0);
      setLikeUnlocked(false);
      setLikers([]);
      return;
    }

    const rows = data as {
      total_count: number;
      liker_id: string | null;
      first_name: string | null;
      photo_path: string | null;
      created_at: string;
    }[];
    const unlocked = rows.some((r) => r.liker_id != null);
    setLikeCount(Number(rows[0]?.total_count ?? 0));
    setLikeUnlocked(unlocked);

    if (!unlocked) {
      setLikers([]);
      return;
    }

    const resolved = await Promise.all(
      rows
        .filter((r): r is typeof r & { liker_id: string } => r.liker_id != null)
        .slice(0, LIKE_FACE_TILES)
        .map(async (r) => {
          let photoUrl: string | null = null;
          if (r.photo_path) {
            try {
              photoUrl = await resolveProfilePhotoUrl(r.photo_path, 3600);
            } catch {
              /* skip broken photo */
            }
          }
          return { likerId: r.liker_id, firstName: r.first_name, photoUrl };
        }),
    );
    setLikers(resolved);
  }, []);

  // UI-3: activation checklist for the 0-activity empty state. Cheap (one
  // profiles row + one count query) so it's fetched every focus alongside the
  // rest — no separate gating on emptiness.
  const [checklist, setChecklist] = useState<ActivationChecklist>({
    hasPhoto: false,
    hasPrompt: false,
    hasSentLike: false,
  });

  const fetchChecklist = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data: prof }, { count: sentCount }] = await Promise.all([
      supabase
        .from('profiles')
        .select('photos, bio, first_date_expectation, favorite_spots')
        .eq('id', user.id)
        .maybeSingle(),
      supabase.from('likes').select('id', { count: 'exact', head: true }).eq('liker_id', user.id),
    ]);

    const spots = prof?.favorite_spots;
    const hasSpots =
      !!spots && typeof spots === 'object' && Object.keys(spots as Record<string, unknown>).length > 0;

    setChecklist({
      hasPhoto: Array.isArray(prof?.photos) && prof.photos.length > 0,
      hasPrompt: !!prof?.bio?.trim() || !!prof?.first_date_expectation?.trim() || hasSpots,
      hasSentLike: (sentCount ?? 0) > 0,
    });
  }, []);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError(false);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setItems([]);
      setPhotoById({});
      setLoading(false);
      await emitUnreadNotificationCount();
      return;
    }

    const { data, error } = await supabase
      .from('notifications')
      .select('id, type, text, is_read, related_user_id, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error || !data) {
      setItems([]);
      setPhotoById({});
      setError(true);
      setLoading(false);
      await emitUnreadNotificationCount();
      return;
    }

    const relatedIds = [
      ...new Set(
        data
          .map((row) => row.related_user_id)
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      ),
    ];

    const nameById = new Map<string, string>();
    const photosById = new Map<string, string[]>();
    if (relatedIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, photos')
        .in('id', relatedIds);
      for (const p of profiles ?? []) {
        if (typeof p.id === 'string') {
          if (typeof p.first_name === 'string') nameById.set(p.id, p.first_name);
          if (Array.isArray(p.photos)) photosById.set(p.id, p.photos as string[]);
        }
      }
    }

    const rows: NotificationRow[] = data.map((row) => ({
      id: row.id as string,
      type: String(row.type ?? ''),
      text: typeof row.text === 'string' ? row.text : '',
      is_read: row.is_read === true,
      related_user_id: typeof row.related_user_id === 'string' ? row.related_user_id : null,
      created_at: String(row.created_at),
      relatedName: row.related_user_id
        ? (nameById.get(row.related_user_id as string) ?? null)
        : null,
    }));
    setItems(rows);

    // Resolve photos for the featured card avatars only (like-grid photos
    // now come from `fetchLikers`, resolved separately above).
    const featuredIds = [
      ...new Set(
        rows
          .filter((r) => isFeaturedType(r.type))
          .map((r) => r.related_user_id)
          .filter((id): id is string => typeof id === 'string'),
      ),
    ];

    const urlById: Record<string, string> = {};
    await Promise.all(
      featuredIds.map(async (id) => {
        const firstPhoto = photosById.get(id)?.[0];
        if (!firstPhoto) return;
        try {
          const url = await resolveProfilePhotoUrl(firstPhoto, 3600);
          if (url) urlById[id] = url;
        } catch {
          /* skip broken photo */
        }
      }),
    );
    setPhotoById(urlById);

    // Proposed place/time — for "wants to meet" cards (featured or already
    // demoted to feed) the OTHER person proposed it; for "said yes" rows I'm
    // the one who proposed it originally. Covers read rows too, so demoted
    // feed lines ("You're chatting with X") can show what was actually
    // decided instead of a bare generic sentence.
    const otherIds = [
      ...new Set(
        rows
          .filter((r) => isFeaturedType(r.type))
          .map((r) => r.related_user_id)
          .filter((id): id is string => typeof id === 'string'),
      ),
    ];
    if (otherIds.length > 0) {
      const linesById: Record<string, string[]> = {};
      const slotOptionsResult: Record<string, string[]> = {};
      const confirmedSlotResult: Record<string, string> = {};
      const confirmedPlaceResult: Record<string, string> = {};
      const matchIdResult: Record<string, string> = {};
      const isUserAResult: Record<string, boolean> = {};
      await Promise.all(
        otherIds.map(async (otherId) => {
          const { data: match } = await supabase
            .from('matches')
            .select(
              'id, user_a_id, user_b_id, user_a_intro_answers, user_b_intro_answers, meeting_at, confirmed_place',
            )
            .or(
              `and(user_a_id.eq.${user.id},user_b_id.eq.${otherId}),` +
                `and(user_a_id.eq.${otherId},user_b_id.eq.${user.id})`,
            )
            .in('status', ['pending', 'accepted'])
            .maybeSingle();
          if (!match) return;
          matchIdResult[otherId] = match.id as string;
          isUserAResult[otherId] = match.user_a_id === user.id;
          // "wants to meet" → they proposed it; "said yes" → I did. A pair
          // only has one active invite type at a time so this is unambiguous
          // per otherId even though we don't have the row's type here.
          const theirAnswers = introAnswersForUser(match, otherId);
          const myAnswers = introAnswersForUser(match, user.id);
          const proposer = formatIntroLines(theirAnswers).length > 0 ? theirAnswers : myAnswers;
          const lines = formatIntroLines(proposer);
          if (lines.length > 0) linesById[otherId] = lines;
          const rawSlots = [proposer?.slot1, proposer?.slot2, proposer?.slot3].filter(
            (s): s is string => typeof s === 'string' && s.length > 0,
          );
          if (rawSlots.length > 0) slotOptionsResult[otherId] = rawSlots;
          if (typeof match.meeting_at === 'string' && match.meeting_at)
            confirmedSlotResult[otherId] = formatMeetingTime(match.meeting_at);
          if (typeof match.confirmed_place === 'string' && match.confirmed_place)
            confirmedPlaceResult[otherId] = match.confirmed_place;
        }),
      );
      setIntroLinesById(linesById);
      setSlotOptionsById(slotOptionsResult);
      setConfirmedSlotById(confirmedSlotResult);
      setConfirmedPlaceById(confirmedPlaceResult);
      setMatchIdByOtherId(matchIdResult);
      setIsUserAByOtherId(isUserAResult);
    } else {
      setIntroLinesById({});
      setSlotOptionsById({});
      setConfirmedSlotById({});
      setConfirmedPlaceById({});
      setMatchIdByOtherId({});
      setIsUserAByOtherId({});
    }

    setLoading(false);
    await emitUnreadNotificationCount();
  }, []);

  useFocusEffect(
    useCallback(() => {
      void fetchNotifications();
      void fetchLikers();
      void fetchChecklist();
    }, [fetchNotifications, fetchLikers, fetchChecklist]),
  );

  // Derived zones — recompute on items change (read-state edits included).
  // Featured excludes already-read items: once acted on (accept/decline) or
  // even just opened, it shouldn't keep reappearing at the top every time you
  // come back to Buzz — that was the "same card keeps coming back" bug.
  const { featured, feed } = useMemo(() => {
    // `invite_accepted` never demotes into feed — once you've tapped "Pick
    // time"/"Open chat" there's nothing left to say about it here (that
    // thread now lives in Chats); user feedback confirmed it wasn't wanted.
    // `mutual_match` is different: it's the ONLY thing that would ever
    // populate Buzz's compact feed for a lot of users at this scale, so
    // unlike invite_accepted it DOES demote into feed once read instead of
    // disappearing outright — otherwise Buzz reads as permanently empty
    // right after the one high-signal event it had (user feedback,
    // 2026-09-09).
    const notificationFeed = items.filter(
      (r) =>
        !isLikeType(r.type) &&
        r.type !== 'invite_accepted' &&
        (!isFeaturedType(r.type) || r.is_read),
    );
    return {
      featured: items.filter((r) => isFeaturedType(r.type) && !r.is_read),
      feed: notificationFeed,
    };
  }, [items]);

  // `feed` is already sorted newest-first, so each bucket stays
  // chronologically ordered just by pushing in iteration order.
  const feedSections = useMemo(() => {
    const buckets = new Map<string, NotificationRow[]>();
    for (const item of feed) {
      const label = dateBucketLabel(item.created_at);
      const bucket = buckets.get(label);
      if (bucket) bucket.push(item);
      else buckets.set(label, [item]);
    }
    return DATE_BUCKET_ORDER.filter((label) => buckets.has(label)).map((label) => ({
      title: label,
      data: buckets.get(label)!,
    }));
  }, [feed]);

  async function handlePress(item: NotificationRow) {
    // "wants to meet" needs an explicit ✕/✓ decision — tapping the card body
    // (avatar/title, to glance at Matches for more context) shouldn't mark it
    // read and make it silently vanish before you've actually decided.
    const needsExplicitDecision = item.type === 'new_invite' || item.type === 'meeting_invite';
    if (!item.is_read && !needsExplicitDecision) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', item.id);
      setItems((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n)),
      );
      await emitUnreadNotificationCount();
    }
    router.push(routeForType(item) as never);
  }

  // Inline Accept/Not now on the "wants to meet" featured card — no detour
  // through Matches to answer yes/no. Mirrors matches.tsx's handleAccept
  // (acceptMatchInvite) and handleMaybeLater (local dismiss, no DB write —
  // matches.tsx doesn't persist a hard decline for incoming invites either,
  // so this stays consistent with that existing behavior).
  async function handleRespond(
    item: NotificationRow,
    accept: boolean,
    slot: string | null = null,
    place: string | null = null,
  ) {
    if (!item.related_user_id) return;

    const who = item.relatedName?.trim() || 'them';

    if (!accept) {
      setItems((prev) =>
        prev.map((n) =>
          n.id === item.id
            ? { ...n, is_read: true, resolvedSummary: `You said not now to ${who}` }
            : n,
        ),
      );
      await supabase.from('notifications').update({ is_read: true }).eq('id', item.id);
      await emitUnreadNotificationCount();
      return;
    }

    setRespondingId(item.id);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setRespondingId(null);
      return;
    }

    const otherId = item.related_user_id;
    const [{ data: match }, { data: genderRows }] = await Promise.all([
      supabase
        .from('matches')
        .select('id, invited_by, chat_opened, user_a_id, user_b_id')
        .or(
          `and(user_a_id.eq.${user.id},user_b_id.eq.${otherId}),` +
            `and(user_a_id.eq.${otherId},user_b_id.eq.${user.id})`,
        )
        .eq('status', 'pending')
        .maybeSingle(),
      supabase.from('profiles').select('id, gender').in('id', [user.id, otherId]),
    ]);

    if (!match) {
      setRespondingId(null);
      Alert.alert('Invite not found', 'This invite may have expired.');
      return;
    }

    const myGender = genderRows?.find((p) => p.id === user.id)?.gender ?? null;
    const otherGender = genderRows?.find((p) => p.id === otherId)?.gender ?? null;

    const result = await acceptMatchInvite({
      matchId: match.id,
      currentUserId: user.id,
      currentUserGender: myGender,
      otherUserGender: otherGender,
    });
    setRespondingId(null);

    if (!result.ok) {
      Alert.alert('Could not accept', result.error ?? 'Something went wrong.');
      return;
    }

    if (slot || place) {
      const patch: { meeting_at?: string; confirmed_place?: string } = {};
      if (slot) patch.meeting_at = slot; // real timestamptz — matches.meeting_at
      if (place) patch.confirmed_place = place;
      await supabase.from('matches').update(patch).eq('id', match.id);
    }

    const effectivePlace = place || (item.related_user_id ? introLinesById[item.related_user_id]?.[0] : undefined);
    const slotLabel = slot ? formatMeetingTime(slot) : null;
    const summary = !slotLabel
      ? `You said yes to ${who}`
      : effectivePlace
        ? `You said yes to ${who} — ${slotLabel} at ${effectivePlace}`
        : `You said yes to ${who} — ${slotLabel}`;
    setItems((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, is_read: true, resolvedSummary: summary } : n)),
    );
    await supabase.from('notifications').update({ is_read: true }).eq('id', item.id);
    await emitUnreadNotificationCount();

    if (result.chatOpened) {
      router.push({
        pathname: '/chat',
        params: { userId: otherId, userName: item.relatedName ?? '', matchId: match.id },
      } as never);
    } else {
      // Accepted, but the chat doesn't open on this side yet (gender-pair rule
      // in shouldOpenChatOnAccept) — say so, otherwise the tap feels like it did
      // nothing.
      Alert.alert('Invite accepted', "You're in — the chat will open once it's their turn.");
    }
  }

  // Buzz's own ✓/✕ on a "meeting today?" reminder card, mirroring the
  // push-notification deep-link into checkin.tsx (2026-08-27). ✕ writes the
  // "didn't go" outcome inline (same payload checkin.tsx's handleWent(false)
  // writes) since there's nothing further to ask; ✓ still routes to
  // checkin.tsx for the 1-10 rating step (wentThere=1 skips its "did you go?"
  // question straight to rating).
  async function handleCheckin(item: NotificationRow, went: boolean) {
    if (!item.related_user_id) return;
    const matchId = matchIdByOtherId[item.related_user_id];
    if (!matchId) {
      Alert.alert('Match not found', "We couldn't find this meetup.");
      return;
    }
    const isUserA = isUserAByOtherId[item.related_user_id] ?? true;
    const who = item.relatedName?.trim() || 'them';

    if (!went) {
      setRespondingId(item.id);
      await supabase
        .from('matches')
        .update(isUserA ? { checkin_a: false } : { checkin_b: false })
        .eq('id', matchId);
      setItems((prev) =>
        prev.map((n) =>
          n.id === item.id
            ? { ...n, is_read: true, resolvedSummary: `You said you didn't meet ${who}` }
            : n,
        ),
      );
      await supabase.from('notifications').update({ is_read: true }).eq('id', item.id);
      setRespondingId(null);
      await emitUnreadNotificationCount();
      return;
    }

    setItems((prev) =>
      prev.map((n) =>
        n.id === item.id ? { ...n, is_read: true, resolvedSummary: `You met ${who} today` } : n,
      ),
    );
    await supabase.from('notifications').update({ is_read: true }).eq('id', item.id);
    await emitUnreadNotificationCount();
    router.push({
      pathname: '/checkin',
      params: {
        matchId,
        matchName: item.relatedName ?? '',
        isUserA: isUserA ? '1' : '0',
        wentThere: '1',
      },
    } as never);
  }

  // Morning "are you still on?" reminder — purely a client-side acknowledgement,
  // no matches write (checkin_a/b means "did you actually go", which isn't
  // knowable yet in the morning — writing it here would be premature/wrong;
  // that data-write belongs to handleCheckin, stage 2) (2026-08-29).
  function handleMorningReminder(item: NotificationRow, going: boolean) {
    const who = item.relatedName?.trim() || 'them';
    setItems((prev) =>
      prev.map((n) =>
        n.id === item.id
          ? {
              ...n,
              is_read: true,
              resolvedSummary: going
                ? `You're meeting ${who} today`
                : `You said you're not meeting ${who} today`,
            }
          : n,
      ),
    );
    void supabase.from('notifications').update({ is_read: true }).eq('id', item.id);
    void emitUnreadNotificationCount();
  }

  async function handleMarkAllRead() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    setMarkingAll(true);
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setMarkingAll(false);
    await emitUnreadNotificationCount();
  }

  function renderFeedRow({ item }: { item: NotificationRow }) {
    const icon = typeIcon(item.type);
    return (
      <TouchableOpacity
        style={[styles.row, !item.is_read && styles.rowUnread]}
        onPress={() => void handlePress(item)}
        activeOpacity={0.8}>
        <View style={[styles.rowIconWrap, { backgroundColor: icon.bg }]}>
          <Ionicons name={icon.name} size={18} color={icon.color} />
        </View>
        <View style={styles.rowContent}>
          <ThemedText style={styles.rowText} numberOfLines={2}>
            {feedRowText(
              item,
              item.related_user_id ? introLinesById[item.related_user_id]?.[0] : undefined,
              item.related_user_id ? confirmedSlotById[item.related_user_id] : undefined,
              item.related_user_id ? confirmedPlaceById[item.related_user_id] : undefined,
            )}
          </ThemedText>
          <ThemedText style={styles.rowTime}>{formatRelativeTime(item.created_at)}</ThemedText>
        </View>
        {!item.is_read ? <View style={styles.unreadDot} /> : null}
      </TouchableOpacity>
    );
  }

  const hasUnread = items.some((n) => !n.is_read);

  // Top: high-signal event cards. Bottom (footer): the premium likes teaser.
  const ListHeader = (
    <View>
      {featured.map((item) => (
        <FeaturedCard
          key={item.id}
          item={item}
          photoUrl={item.related_user_id ? (photoById[item.related_user_id] ?? null) : null}
          introLines={item.related_user_id ? introLinesById[item.related_user_id] : undefined}
          slotOptions={item.related_user_id ? slotOptionsById[item.related_user_id] : undefined}
          confirmedSlot={item.related_user_id ? confirmedSlotById[item.related_user_id] : undefined}
          confirmedPlace={item.related_user_id ? confirmedPlaceById[item.related_user_id] : undefined}
          onPress={() => void handlePress(item)}
          onAccept={(slot, place) => void handleRespond(item, true, slot, place)}
          onDecline={() => void handleRespond(item, false)}
          onCheckinYes={() => void handleCheckin(item, true)}
          onCheckinNo={() => void handleCheckin(item, false)}
          onMorningYes={() => handleMorningReminder(item, true)}
          onMorningNo={() => handleMorningReminder(item, false)}
          responding={respondingId === item.id}
        />
      ))}
    </View>
  );

  const ListFooter = (
    <LikesSection
      count={likeCount}
      unlocked={likeUnlocked}
      likers={likers}
      onPressLocked={() => router.push('/premium' as never)}
      onPressLiker={(likerId) =>
        router.push({ pathname: '/user-profile', params: { userId: likerId } } as never)
      }
    />
  );

  return (
    <ScreenContainer style={styles.container}>
      <View style={styles.headerRow}>
        <ThemedText style={styles.pageTitle}>Buzz</ThemedText>
        {hasUnread ? (
          <TouchableOpacity
            onPress={() => void handleMarkAllRead()}
            disabled={markingAll}
            activeOpacity={0.8}>
            <ThemedText style={styles.markAllBtn}>
              {markingAll ? '...' : 'Mark all as read'}
            </ThemedText>
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={styles.loader} />
      ) : error ? (
        <ErrorState onRetry={() => void fetchNotifications()} />
      ) : items.length === 0 && likeCount === 0 ? (
        <BuzzActivationCard
          checklist={checklist}
          onGoProfile={() => router.push('/(tabs)/profile' as never)}
          onGoHome={() => router.push('/(tabs)' as never)}
        />
      ) : (
        <SectionList
          sections={feedSections}
          keyExtractor={(item) => item.id}
          renderItem={renderFeedRow}
          renderSectionHeader={({ section }) => (
            <ThemedText style={styles.sectionLabel}>{section.title}</ThemedText>
          )}
          ListHeaderComponent={ListHeader}
          ListFooterComponent={ListFooter}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: 'flex-start' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
  },
  markAllBtn: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accent,
  },
  loader: { marginTop: 40 },
  list: { paddingBottom: 32 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 14,
    marginBottom: 8,
  },

  // --- Likes premium teaser (footer) ---
  likes: {
    backgroundColor: '#FFFBF0',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#EBD9A6',
    padding: 16,
    marginTop: 6,
  },
  likesTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  likesSub: {
    fontSize: 12.5,
    color: '#9A7B2E',
    marginTop: 2,
    marginBottom: 14,
  },
  likesStrip: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  likeTile: {
    flex: 1,
    maxWidth: 110,
    aspectRatio: 0.9,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#EDE2C2',
  },
  likeTileImg: { width: '100%', height: '100%' },
  likeTileFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E6D6A8',
  },
  likeTileInitial: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A1A1A',
  },
  likeTileMore: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  likeTileMoreText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  likesUnlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  likesUnlockText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // --- Featured event card ---
  featured: {
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#EFE4C4',
    marginBottom: 10,
    shadowColor: '#8A6D1A',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  featuredMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featuredUnread: {
    backgroundColor: '#FFFDF6',
    borderColor: '#EBD9A6',
  },
  featuredAvatarWrap: { width: 52, height: 52 },
  featuredAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#EEE',
  },
  featuredAvatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1E6C6',
  },
  featuredInitial: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1A1A1A',
  },
  featuredBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  featuredBody: { flex: 1, gap: 3 },
  featuredTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  featuredSub: {
    fontSize: 13,
    color: colors.textMuted,
  },
  featuredInfoBlock: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#EFE4C4',
    gap: 4,
  },
  featuredInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  featuredInfoText: {
    flex: 1,
    fontSize: 12.5,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  slotHint: {
    fontSize: 11.5,
    color: colors.textMuted,
    marginTop: 6,
    marginBottom: 6,
  },
  slotChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  // Picker stacked above its confirm button — side-by-side pushed the button
  // off-screen (the spinner is wider than it looks, doesn't shrink to share
  // a row). Same fix as micro-intro.tsx (2026-08-25, device testing).
  timePickerColumn: { gap: 8, alignItems: 'stretch', marginTop: 4 },
  timePickerSpinner: { alignSelf: 'center' },
  addSlotBtnWide: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  addSlotBtnWideText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  slotChip: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#EFE4C4',
    backgroundColor: '#FFFFFF',
  },
  slotChipSelected: {
    borderColor: colors.accent,
    backgroundColor: '#FFF8E1',
  },
  slotChipText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  slotChipTextSelected: {
    color: colors.accent,
  },
  slotCustomInput: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: '#FFFBF0',
    fontSize: 13,
    color: colors.textPrimary,
  },
  placeSuggestLink: {
    fontSize: 11.5,
    fontWeight: '600',
    color: colors.accent,
    marginTop: 2,
  },
  featuredCta: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  featuredCtaAccepted: {
    backgroundColor: '#2E9E5B',
  },
  featuredCtaText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  respondRow: { flexDirection: 'row', gap: 8 },
  respondDecline: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F0F0',
  },
  respondAccept: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2E9E5B',
  },
  respondAcceptDisabled: {
    backgroundColor: '#C9C9C9',
  },

  // --- Compact feed row ---
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  rowUnread: {
    backgroundColor: '#FFF8E1',
    borderColor: '#FFE082',
  },
  rowIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowContent: { flex: 1, gap: 4 },
  rowText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textPrimary,
    lineHeight: 21,
  },
  rowTime: {
    fontSize: 12,
    color: '#888',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
    marginLeft: 4,
  },
  activation: {
    marginTop: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    padding: 18,
  },
  activationTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  activationSub: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
    marginBottom: 14,
  },
  activationBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F0F0F0',
    overflow: 'hidden',
    marginBottom: 16,
  },
  activationBarFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  activationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#F0F0F0',
  },
  activationRowText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  activationRowDone: {
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
});
