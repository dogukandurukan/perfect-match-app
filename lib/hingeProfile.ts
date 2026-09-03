/**
 * Shared Hinge-style profile helpers (Home + Matches + user-profile).
 */
import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';
import {
  formatAvailabilityLabel,
  formatDrinkingLabel,
  formatIntentLabel,
  formatSmokingLabel,
} from './labels';

export type ChipIcon = ComponentProps<typeof Ionicons>['name'];

/** `formatXLabel()` helpers embed an emoji glyph for text-line contexts (chat, matches);
 * chips render their own vector icon instead, so strip the glyph + leading space here. */
function stripLeadingEmoji(s: string): string {
  return s.replace(/^\p{Extended_Pictographic}️?\s*/u, '');
}

export type HingeProfilePerson = {
  first_name: string | null;
  date_of_birth: string | null;
  district: string | null;
  city: string | null;
  match_percentage?: number | null;
  intent: string | null;
  availability_days: string[] | null;
  drinking: string | null;
  smoking: string | null;
  hobbies: string[] | null;
  favorite_music: string | null;
  favorite_movie: string | null;
  favorite_book: string | null;
  bio: string | null;
  first_date_expectation: string | null;
  favorite_spots: Record<string, string> | null;
  // Bumble "About me" / "Looking for" / "Interests" bölümleri için (mevcut profiles kolonları).
  // Opsiyonel — Matches detay kartı bunları sağlamayabilir; Home besler.
  education?: string | null;
  zodiac_sign?: string | null;
  gender?: string | null;
  pets?: string | null;
  religion?: string | null;
  morning_night?: string | null;
  core_value?: string | null;
  impressed_by?: string | null;
  favorite_activity?: string | null;
  vibe?: string | null;
  languages?: string[] | null;
  photo_verified?: boolean | null;
  photoUrls: string[];
};

/** Bir "About me" / interest chip'i: vektör ikon + etiket (Bumble tarzı). Interest
 * chip'leri ayrıca `emoji` taşır — Bumble'ın "My interests" bölümü gibi renkli,
 * ilgiye özel emoji; About-me/Looking-for/Languages hâlâ sade vektör ikon. */
export type ProfileChip = { key: string; icon: ChipIcon; label: string; emoji?: string };

export type CommonSelf = {
  hobbies: string[] | null | undefined;
  favorite_music: string | null | undefined;
  favorite_movie: string | null | undefined;
  favorite_book: string | null | undefined;
  district: string | null | undefined;
};

export type PromptCard = {
  id: string;
  title: string;
  answer: string;
};

function normKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function formatFavoriteSpots(
  spots: Record<string, string> | null | undefined,
): string | null {
  if (!spots || typeof spots !== 'object') return null;
  const values = Object.values(spots)
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter((v) => v.length > 0);
  if (values.length === 0) return null;
  return values.join(' · ');
}

export function isBogusLocationToken(raw: string): boolean {
  const lower = raw.toLowerCase();
  return /\d+\s*km/.test(lower) || lower.includes('fazla') || lower.includes('away');
}

/** Readable pin line — no raw distance junk. */
export function formatFeedLocation(
  district: string | null | undefined,
  city: string | null | undefined,
  viewerCity: string | null | undefined,
): string | null {
  const dRaw = district?.trim() ?? '';
  const cRaw = city?.trim() ?? '';
  const d = dRaw && !isBogusLocationToken(dRaw) ? dRaw : '';
  const c = cRaw && !isBogusLocationToken(cRaw) ? cRaw : '';
  if (!d && !c) return null;

  const sameCity =
    !!viewerCity?.trim() && !!c && viewerCity.trim().toLowerCase() === c.toLowerCase();

  if (d && sameCity) return `📍 ${d} · nearby`;
  if (d && c) return `📍 ${d}, ${c}`;
  if (d) return `📍 ${d}`;
  return `📍 ${c}`;
}

/** Fixed prompt set — only filled profile fields become cards. */
export function buildPromptCards(person: HingeProfilePerson): PromptCard[] {
  const cards: PromptCard[] = [];

  const idealDate = person.first_date_expectation?.trim() ?? '';
  if (idealDate) {
    cards.push({ id: 'ideal_date', title: 'My ideal date', answer: idealDate });
  }

  const about = person.bio?.trim() ?? '';
  if (about) {
    cards.push({ id: 'about', title: 'A little about me', answer: about });
  }

  const spot = formatFavoriteSpots(person.favorite_spots);
  if (spot) {
    cards.push({ id: 'spot', title: 'My go-to spot', answer: spot });
  }

  const hangout = person.district?.trim() ?? '';
  if (hangout && !isBogusLocationToken(hangout)) {
    cards.push({ id: 'hangout', title: 'Where I hang out', answer: hangout });
  }

  return cards;
}

function cap(s: string): string {
  const t = s.trim().replace(/_/g, ' ');
  return t.length ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

function zodiacChip(sign: string | null | undefined): ProfileChip | null {
  const v = sign?.trim();
  if (!v) return null;
  return { key: 'zodiac', icon: 'sparkles-outline', label: cap(v) };
}

function morningNightChip(value: string | null | undefined): ProfileChip | null {
  const v = value?.trim();
  if (!v) return null;
  const k = normKey(v);
  if (k.includes('night')) return { key: 'mn', icon: 'moon-outline', label: 'Night owl' };
  if (k.includes('morning')) return { key: 'mn', icon: 'sunny-outline', label: 'Morning person' };
  return { key: 'mn', icon: 'partly-sunny-outline', label: cap(v) };
}

/** Bumble "About me" chip grid — yalnızca dolu alanlar (vektör ikon + etiket). */
export function buildAboutMeChips(person: HingeProfilePerson): ProfileChip[] {
  const chips: ProfileChip[] = [];
  const push = (c: ProfileChip | null) => {
    if (c) chips.push(c);
  };
  if (person.gender?.trim())
    push({ key: 'gender', icon: 'person-outline', label: cap(person.gender) });
  push(zodiacChip(person.zodiac_sign));
  if (person.education?.trim())
    push({ key: 'edu', icon: 'school-outline', label: cap(person.education) });
  push(morningNightChip(person.morning_night));
  const drink = formatDrinkingLabel(person.drinking);
  if (drink) push({ key: 'drink', icon: 'wine-outline', label: stripLeadingEmoji(drink) });
  const smoke = formatSmokingLabel(person.smoking);
  if (smoke) push({ key: 'smoke', icon: 'cloud-outline', label: stripLeadingEmoji(smoke) });
  if (person.pets?.trim()) push({ key: 'pets', icon: 'paw-outline', label: cap(person.pets) });
  if (person.religion?.trim())
    push({ key: 'rel', icon: 'book-outline', label: cap(person.religion) });
  return chips;
}

/** Bumble "I'm looking for" — niyet + değerler. */
export function buildLookingForChips(person: HingeProfilePerson): ProfileChip[] {
  const chips: ProfileChip[] = [];
  const intent = formatIntentLabel(person.intent);
  if (intent) chips.push({ key: 'intent', icon: 'search-outline', label: stripLeadingEmoji(intent) });
  if (person.core_value?.trim())
    chips.push({ key: 'core', icon: 'diamond-outline', label: cap(person.core_value) });
  if (person.impressed_by?.trim())
    chips.push({ key: 'impr', icon: 'flash-outline', label: cap(person.impressed_by) });
  return chips;
}

/** Bumble "My interests" — hobiler + favori aktivite + vibe. Renkli, ilgiye
 * özel emoji taşır (Bumble referansı: 🏆 Gym, ⛵ Sailing, 🏛️ Museums, 🍻 Pubs,
 * 🥃 Whisky — spesifik ve renkli, About-me'nin sade vektör ikonlarından farklı). */
export function buildInterestChips(person: HingeProfilePerson): ProfileChip[] {
  const chips: ProfileChip[] = [];
  for (const h of person.hobbies ?? []) {
    const t = h?.trim();
    if (t) chips.push({ key: `hobby-${t}`, icon: hobbyIcon(t), emoji: hobbyChipEmoji(t), label: cap(t) });
  }
  if (person.favorite_activity?.trim())
    chips.push({
      key: 'fav',
      icon: 'star-outline',
      emoji: '⭐',
      label: cap(person.favorite_activity),
    });
  if (person.vibe?.trim())
    chips.push({ key: 'vibe', icon: 'color-palette-outline', emoji: '🎨', label: cap(person.vibe) });
  return chips;
}

/** Availability chip ("Free weekends" etc.) for the About-me grid. */
export function buildAvailabilityChip(days: string[] | null | undefined): ProfileChip | null {
  const label = formatAvailabilityLabel(days);
  if (!label) return null;
  return { key: 'avail', icon: 'calendar-outline', label: stripLeadingEmoji(label) };
}

/** Bumble "Languages" chip grid. */
export function buildLanguageChips(languages: string[] | null | undefined): ProfileChip[] {
  return (languages ?? [])
    .map((l) => l?.trim())
    .filter((l): l is string => !!l)
    .map((l) => ({ key: `lang-${l}`, icon: 'chatbubble-outline' as ChipIcon, label: l }));
}

const HOBBY_ICON: Record<string, ChipIcon> = {
  gaming: 'game-controller-outline',
  reading: 'book-outline',
  cooking: 'restaurant-outline',
  fitness: 'barbell-outline',
  travel: 'airplane-outline',
};

function hobbyIcon(hobby: string): ChipIcon {
  const key = normKey(hobby);
  for (const [k, icon] of Object.entries(HOBBY_ICON)) {
    if (key.includes(k)) return icon;
  }
  return 'sparkles-outline';
}

/** Interest-chip emoji — covers step3's PRESET_HOBBIES + HOBBY_SUGGESTIONS
 * plus common free-typed interests (Bumble's own examples: gym/sailing/
 * museums/pubs/whisky), substring-matched like HOBBY_ICON above. */
const HOBBY_CHIP_EMOJI: Record<string, string> = {
  travel: '✈️',
  music: '🎵',
  gym: '💪',
  fitness: '💪',
  running: '🏃',
  read: '📚',
  book: '📚',
  gaming: '🎮',
  cook: '🍳',
  sport: '🏆',
  photo: '📸',
  hik: '🥾',
  danc: '💃',
  yoga: '🧘',
  cinema: '🎬',
  movie: '🎬',
  film: '🎬',
  coffee: '☕',
  cycl: '🚴',
  bike: '🚴',
  sail: '⛵',
  museum: '🏛️',
  galler: '🏛️',
  pub: '🍻',
  bar: '🍻',
  whisk: '🥃',
  wine: '🍷',
  swim: '🏊',
  ski: '⛷️',
  nature: '🌿',
  beach: '🏖️',
  dog: '🐾',
  pet: '🐾',
  art: '🎨',
};

function hobbyChipEmoji(hobby: string): string {
  const key = normKey(hobby);
  for (const [k, emoji] of Object.entries(HOBBY_CHIP_EMOJI)) {
    if (key.includes(k)) return emoji;
  }
  return '✨';
}

// Inline sentence copy ("You both love hiking 🥾") — not a structural chip icon,
// so an emoji here is a copy/tone choice, not the anti-pattern the chip grid fixed.
const HOBBY_EMOJI_TEXT: Record<string, string> = {
  gaming: '🎮',
  reading: '📚',
  cooking: '🍳',
  fitness: '💪',
  travel: '✈️',
};

function hobbyEmojiForText(hobby: string): string {
  const key = normKey(hobby);
  for (const [k, emoji] of Object.entries(HOBBY_EMOJI_TEXT)) {
    if (key.includes(k)) return emoji;
  }
  return '✨';
}

function parseList(raw: string | null | undefined): string[] {
  if (!raw || typeof raw !== 'string') return [];
  return raw
    .split(/[,;/|]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function sharedListItem(a: string | null | undefined, b: string | null | undefined): string | null {
  const left = parseList(a);
  const right = parseList(b);
  if (!left.length || !right.length) return null;
  const rightKeys = new Set(right.map(normKey));
  for (const item of left) {
    if (rightKeys.has(normKey(item))) return item.trim();
  }
  return null;
}

/**
 * Single strongest overlap line for compact match cards.
 * Most specific first; null when nothing shared.
 */
export function strongestCommonLine(
  me: CommonSelf | null | undefined,
  them: {
    hobbies: string[] | null | undefined;
    favorite_music: string | null | undefined;
    favorite_movie: string | null | undefined;
    favorite_book: string | null | undefined;
    district: string | null | undefined;
  },
): string | null {
  const myHobbies = (me?.hobbies ?? []).map((h) => h.trim()).filter(Boolean);
  const theirHobbies = (them.hobbies ?? []).map((h) => h.trim()).filter(Boolean);
  const myHobbyKeys = new Set(myHobbies.map(normKey));
  const sharedHobby = theirHobbies.find((h) => myHobbyKeys.has(normKey(h)));
  if (sharedHobby) {
    return `You both love ${sharedHobby} ${hobbyEmojiForText(sharedHobby)}`;
  }

  const myDistrict = me?.district?.trim() ?? '';
  const theirDistrict = them.district?.trim() ?? '';
  if (
    myDistrict &&
    theirDistrict &&
    !isBogusLocationToken(myDistrict) &&
    !isBogusLocationToken(theirDistrict) &&
    normKey(myDistrict) === normKey(theirDistrict)
  ) {
    return 'Same neighbourhood 📍';
  }

  const music = sharedListItem(me?.favorite_music, them.favorite_music);
  if (music) return `You both love ${music} 🎵`;

  const book = sharedListItem(me?.favorite_book, them.favorite_book);
  if (book) return `You both love ${book} 📚`;

  const movie = sharedListItem(me?.favorite_movie, them.favorite_movie);
  if (movie) return `You both love ${movie} 🎬`;

  return null;
}

export function hingeSafeAge(dob: string | null | undefined): number {
  if (!dob) return 0;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return 0;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return Math.max(0, age);
}

export function parseFavoriteSpots(
  raw: unknown,
): Record<string, string> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return raw as Record<string, string>;
}
