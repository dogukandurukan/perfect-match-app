/**
 * Shared Hinge-style profile helpers (Home + Matches).
 */

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
  photoUrls: string[];
};

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

const HOBBY_EMOJI: Record<string, string> = {
  gaming: '🎮',
  reading: '📚',
  cooking: '🍳',
  fitness: '💪',
  travel: '✈️',
};

function hobbyEmoji(hobby: string): string {
  const key = normKey(hobby);
  for (const [k, emoji] of Object.entries(HOBBY_EMOJI)) {
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
    return `You both love ${sharedHobby} ${hobbyEmoji(sharedHobby)}`;
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
