/**
 * Shared English UI labels for profile fields (intent, lifestyle, availability).
 * Single source — screens must not redefine these mappings.
 */

const DAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

const DAY_SHORT: Record<string, string> = {
  Mon: 'Mon',
  Tue: 'Tue',
  Wed: 'Wed',
  Thu: 'Thu',
  Fri: 'Fri',
  Sat: 'Sat',
  Sun: 'Sun',
  Monday: 'Mon',
  Tuesday: 'Tue',
  Wednesday: 'Wed',
  Thursday: 'Thu',
  Friday: 'Fri',
  Saturday: 'Sat',
  Sunday: 'Sun',
  Pzt: 'Mon',
  Sal: 'Tue',
  Çar: 'Wed',
  Per: 'Thu',
  Cum: 'Fri',
  Cmt: 'Sat',
  Paz: 'Sun',
};

const INTENT_LABELS: Record<string, string> = {
  keeping_it_casual: '😎 Just casual',
  open_to_relationship: '🤍 Open to something real',
  not_sure_yet: '✨ Still figuring it out',
  just_friends: '🤝 Just friends',
};

const DRINKING_LABELS: Record<string, string> = {
  Yes: '🍷 I drink',
  Socially: '🥂 Socially',
  No: "🚫 Don't drink",
};

const SMOKING_LABELS: Record<string, string> = {
  Yes: '🚬 I smoke',
  Socially: '🚬 Socially',
  No: '🚭 Non-smoker',
};

function normalizeDayToken(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const mapped = DAY_SHORT[t] ?? DAY_SHORT[t.slice(0, 3)];
  if (mapped) return mapped;
  const lower = t.toLowerCase();
  for (const [key, short] of Object.entries(DAY_SHORT)) {
    if (key.toLowerCase() === lower) return short;
  }
  return null;
}

/** Intent chip / row label. Returns null when missing. */
export function formatIntentLabel(intent: string | null | undefined): string | null {
  if (!intent || !intent.trim()) return null;
  return INTENT_LABELS[intent] ?? intent;
}

/** Drinking lifestyle chip. Returns null when missing/unknown empty. */
export function formatDrinkingLabel(value: string | null | undefined): string | null {
  if (!value || !value.trim()) return null;
  return DRINKING_LABELS[value] ?? null;
}

/** Smoking lifestyle chip. Returns null when missing. */
export function formatSmokingLabel(value: string | null | undefined): string | null {
  if (!value || !value.trim()) return null;
  return SMOKING_LABELS[value] ?? null;
}

/**
 * Availability chip from day list.
 * 7 days → free all week; only Sat/Sun → weekends; else sorted short days.
 * Returns null when empty.
 */
export function formatAvailabilityLabel(days: string[] | null | undefined): string | null {
  if (!days?.length) return null;

  const normalized = [
    ...new Set(days.map(normalizeDayToken).filter((d): d is string => d !== null)),
  ];
  if (normalized.length === 0) return null;

  const ordered = DAY_ORDER.filter((d) => normalized.includes(d));
  if (ordered.length === 0) return null;

  if (ordered.length === 7) return '🙌 Free all week';

  const onlyWeekend =
    ordered.length > 0 && ordered.every((d) => d === 'Sat' || d === 'Sun');
  if (onlyWeekend) return '☕ Free on weekends';

  return `📅 Free ${ordered.join(', ')}`;
}

/** Combined lifestyle line for info rows (skips null parts). */
export function formatLifestyleLine(
  drinking: string | null | undefined,
  smoking: string | null | undefined,
): string | null {
  const parts = [formatDrinkingLabel(drinking), formatSmokingLabel(smoking)].filter(
    (x): x is string => !!x,
  );
  if (parts.length === 0) return null;
  return parts.join(' · ');
}
