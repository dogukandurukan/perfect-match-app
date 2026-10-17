// Chat timeline layout (pure, no React): day separators, sender groups and
// the time label shown under the last bubble of a group. Everything comes
// from the real `created_at` timestamps, shown in the device's local time.
// No online / typing / seen state exists here on purpose.

/** Consecutive messages of one sender within this gap share one group. */
export const GROUP_GAP_MS = 5 * 60 * 1000;

export type TimelineInput<T> = { key: string; at: string; senderId: string | null; item: T };

export type TimelineRow<T> =
  | { kind: 'day'; key: string; label: string }
  | {
      kind: 'item';
      key: string;
      item: T;
      /** First / last bubble of a same-sender group (date cards are their own group). */
      firstOfGroup: boolean;
      lastOfGroup: boolean;
      /** Directly under a day separator (the separator already gives the space). */
      afterDay: boolean;
      /** "20:12" under the last bubble of a group; null otherwise. */
      time: string | null;
    };

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** "20:12" (24 h, local time). Invalid input → "". */
export function formatChatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Today" · "Yesterday" · "Monday" (within the last week) · "12 Oct" · "12 Oct 2025" (other year). */
export function formatChatDay(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(d)) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days > 1 && days < 7) return WEEKDAYS[d.getDay()];
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

/**
 * Inserts a day separator before the first item of each local day and marks
 * sender groups. `senderId: null` (e.g. a date card) never groups with
 * anything. Input must already be in time order.
 */
export function buildTimeline<T>(items: TimelineInput<T>[], now: Date = new Date()): TimelineRow<T>[] {
  const rows: TimelineRow<T>[] = [];
  const sameGroup = (a: TimelineInput<T> | undefined, b: TimelineInput<T> | undefined) => {
    if (!a || !b || a.senderId === null || b.senderId === null || a.senderId !== b.senderId) return false;
    const ta = new Date(a.at);
    const tb = new Date(b.at);
    if (dayKey(ta) !== dayKey(tb)) return false;
    return Math.abs(tb.getTime() - ta.getTime()) <= GROUP_GAP_MS;
  };
  let lastDay: string | null = null;
  items.forEach((it, i) => {
    const d = new Date(it.at);
    const k = Number.isNaN(d.getTime()) ? 'invalid' : dayKey(d);
    const newDay = k !== lastDay;
    if (newDay) {
      lastDay = k;
      rows.push({ kind: 'day', key: `day-${k}`, label: formatChatDay(it.at, now) });
    }
    const first = !sameGroup(items[i - 1], it);
    const last = !sameGroup(it, items[i + 1]);
    rows.push({
      kind: 'item',
      key: it.key,
      item: it.item,
      firstOfGroup: first,
      lastOfGroup: last,
      afterDay: newDay,
      time: last && it.senderId !== null ? formatChatTime(it.at) : null,
    });
  });
  return rows;
}

/** True when the list is scrolled to (or within `threshold` pt of) its end. */
export function isNearEnd(
  m: { contentOffset: { y: number }; contentSize: { height: number }; layoutMeasurement: { height: number } },
  threshold = 80,
): boolean {
  return m.contentSize.height - (m.contentOffset.y + m.layoutMeasurement.height) <= threshold;
}
