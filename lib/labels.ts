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

/** Relative time for alerts / messages rows. */
export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';

  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(diffMs / (1000 * 60 * 60));

  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  if (date >= startOfYesterday && date < startOfToday) return 'yesterday';

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export type NotificationKind =
  | 'new_invite'
  | 'invite_accepted'
  | 'like'
  | 'new_like'
  | 'new_message'
  | 'message'
  | 'checkin'
  | 'check_in'
  | 'match_expiring'
  | 'match_expiry'
  | 'new_match'
  | string;

/** English notification copy from type + optional name. */
export function formatNotificationText(
  type: NotificationKind,
  name: string | null | undefined,
): string {
  const displayName = name?.trim() || 'Someone';

  switch (type) {
    case 'new_invite':
    case 'meeting_invite':
      return `${displayName} wants to meet ☕`;
    case 'invite_accepted':
      return `${displayName} said yes 🎉 Pick a time`;
    case 'like':
    case 'new_like':
    case 'someone_liked':
      return 'Someone likes you 👀';
    case 'new_message':
    case 'message':
      return `${displayName} sent you a message 💬`;
    case 'checkin':
    case 'check_in':
    case 'post_date':
      return `How did it go with ${displayName}?`;
    case 'match_expiring':
    case 'match_expiry':
    case 'expires_soon':
      return `Your match with ${displayName} expires soon ⏳`;
    case 'new_match':
      return 'Someone likes you 👀';
    default:
      return 'New notification';
  }
}

/**
 * Prefer type-based English copy; fall back to translating known Turkish
 * system strings so old rows never show Turkish.
 */
export function resolveNotificationDisplayText(
  type: string,
  name: string | null | undefined,
  storedText: string | null | undefined,
): string {
  const knownTypes = new Set([
    'new_invite',
    'meeting_invite',
    'invite_accepted',
    'like',
    'new_like',
    'someone_liked',
    'new_message',
    'message',
    'checkin',
    'check_in',
    'post_date',
    'match_expiring',
    'match_expiry',
    'expires_soon',
    'new_match',
  ]);

  if (knownTypes.has(type)) {
    return formatNotificationText(type, name);
  }

  const raw = storedText?.trim() ?? '';
  if (!raw) return formatNotificationText(type, name);

  const lower = raw.toLowerCase();
  const displayName = name?.trim() || 'Someone';

  if (lower.includes('kabul') || lower.includes('said yes')) {
    return formatNotificationText('invite_accepted', displayName);
  }
  if (lower.includes('davet') || lower.includes('buluşmak') || lower.includes('wants to meet')) {
    return formatNotificationText('new_invite', displayName);
  }
  if (lower.includes('beğen') || lower.includes('likes you')) {
    return formatNotificationText('like', displayName);
  }
  if (lower.includes('mesaj') || lower.includes('message')) {
    return formatNotificationText('new_message', displayName);
  }
  if (lower.includes('nasıl geçti') || lower.includes('check-in') || lower.includes('checkin')) {
    return formatNotificationText('checkin', displayName);
  }
  if (lower.includes('süre') || lower.includes('bitiyor') || lower.includes('expires')) {
    return formatNotificationText('match_expiring', displayName);
  }

  // Avoid showing leftover Turkish; use generic English.
  if (/[ğüşıöçĞÜŞİÖÇ]/.test(raw)) {
    return 'New notification';
  }

  return raw;
}
