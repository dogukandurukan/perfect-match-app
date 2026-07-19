/**
 * Icebreaker suggestions for empty chats.
 * Signature is stable for a future Supabase Edge Function → Claude swap.
 */

export type IcebreakerProfile = {
  hobbies: string[] | null | undefined;
  favorite_book: string | null | undefined;
  favorite_movie: string | null | undefined;
  favorite_music: string | null | undefined;
  district: string | null | undefined;
};

const HOBBY_PRIORITY = ['Gaming', 'Reading', 'Cooking', 'Fitness', 'Travel'] as const;

type HobbyKey = (typeof HOBBY_PRIORITY)[number];

const HOBBY_LINES: Record<HobbyKey, string> = {
  Gaming: 'Fellow gamer 🎮 what are you playing right now?',
  Cooking: 'Fellow cook 🍳 what\'s the one dish you actually nail?',
  Fitness: 'Both into fitness 💪 gym, run, or something else?',
  Travel: 'Both travel people ✈️ last trip that was actually worth it?',
  Reading: 'You read a lot too 📚 last book you couldn\'t put down?',
};

/** Split free-text lists like "Jazz, Radiohead, Daft Punk" into normalized tokens. */
export function parseFreeTextList(raw: string | null | undefined): string[] {
  if (!raw || typeof raw !== 'string') return [];
  return raw
    .split(/[,;/|]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function normKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

function sharedTitles(a: string | null | undefined, b: string | null | undefined): string[] {
  const left = parseFreeTextList(a);
  const right = parseFreeTextList(b);
  if (!left.length || !right.length) return [];
  const rightKeys = new Set(right.map(normKey));
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of left) {
    const key = normKey(item);
    if (rightKeys.has(key) && !seen.has(key)) {
      seen.add(key);
      out.push(item.trim());
    }
  }
  return out;
}

function normalizeHobby(raw: string): HobbyKey | null {
  const k = normKey(raw);
  for (const h of HOBBY_PRIORITY) {
    if (k === normKey(h) || k.includes(normKey(h))) return h;
  }
  // common aliases
  if (k.includes('game') || k.includes('gaming')) return 'Gaming';
  if (k.includes('read') || k.includes('book')) return 'Reading';
  if (k.includes('cook') || k.includes('baking')) return 'Cooking';
  if (k.includes('fit') || k.includes('gym') || k.includes('workout') || k.includes('run')) {
    return 'Fitness';
  }
  if (k.includes('travel') || k.includes('trip')) return 'Travel';
  return null;
}

function sharedHobbies(me: IcebreakerProfile, them: IcebreakerProfile): HobbyKey[] {
  const mine = new Set(
    (me.hobbies ?? []).map(normalizeHobby).filter((h): h is HobbyKey => h !== null),
  );
  const theirs = new Set(
    (them.hobbies ?? []).map(normalizeHobby).filter((h): h is HobbyKey => h !== null),
  );
  return HOBBY_PRIORITY.filter((h) => mine.has(h) && theirs.has(h));
}

type Category =
  | 'book'
  | 'movie'
  | 'music'
  | 'hobby'
  | 'district'
  | 'fallback';

/**
 * Template-based icebreakers. Returns 2–3 unique lines.
 * Most specific categories first; at most one tip per category.
 */
export async function generateIcebreakers(
  me: IcebreakerProfile,
  them: IcebreakerProfile,
  matchPercentage: number,
): Promise<string[]> {
  // Keep async for the future Claude Edge Function swap.
  await Promise.resolve();

  const picked: { category: Category; text: string }[] = [];
  const usedText = new Set<string>();

  const push = (category: Category, text: string) => {
    if (picked.length >= 3) return;
    if (picked.some((p) => p.category === category)) return;
    const t = text.trim();
    if (!t || usedText.has(t)) return;
    usedText.add(t);
    picked.push({ category, text: t });
  };

  const sharedBooks = sharedTitles(me.favorite_book, them.favorite_book);
  if (sharedBooks[0]) {
    push('book', `Wait — you also put ${sharedBooks[0]}? Which one stayed with you? 📖`);
  }

  const sharedMovies = sharedTitles(me.favorite_movie, them.favorite_movie);
  if (sharedMovies[0]) {
    push('movie', `You're into ${sharedMovies[0]} too — what did you make of it? 🎬`);
  }

  const myMusic = parseFreeTextList(me.favorite_music);
  const theirMusic = parseFreeTextList(them.favorite_music);
  if (myMusic.length && theirMusic.length) {
    const sharedMusic = sharedTitles(me.favorite_music, them.favorite_music);
    if (sharedMusic[0]) {
      push('music', `Another ${sharedMusic[0]} fan 🎵 what's on repeat?`);
    } else {
      push(
        'music',
        `${theirMusic[0]} ↔ ${myMusic[0]}... our playlists would get along 🎵 what's on repeat?`,
      );
    }
  }

  const hobbies = sharedHobbies(me, them);
  if (hobbies[0]) {
    push('hobby', HOBBY_LINES[hobbies[0]]);
  }

  const myDistrict = me.district?.trim() ?? '';
  const theirDistrict = them.district?.trim() ?? '';
  if (myDistrict && theirDistrict) {
    if (normKey(myDistrict) === normKey(theirDistrict)) {
      push('district', `We're both around ${theirDistrict} — got a favourite spot? ☕`);
    } else {
      push(
        'district',
        `You're ${theirDistrict}, I'm ${myDistrict} — which side wins? 😏`,
      );
    }
  }

  const pct = Number.isFinite(matchPercentage) ? Math.round(matchPercentage) : 0;
  const fallbacks = [
    `You came up as a ${pct}% match 👀 let's find out why`,
    "Curious what stood out on your profile — what's a good place to start?",
  ];

  for (const line of fallbacks) {
    if (picked.length >= 2) break;
    if (usedText.has(line)) continue;
    // Allow multiple fallbacks only to satisfy the minimum of 2
    usedText.add(line);
    picked.push({ category: 'fallback', text: line });
  }

  return picked.slice(0, 3).map((p) => p.text);
}
