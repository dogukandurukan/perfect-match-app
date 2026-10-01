// "Suggest a date" form helpers (pure, Node-testable). The person picks the
// day and the time themselves; nothing is inferred from the general V2
// first-date preferences (D57 — not availability). Dates are built in the
// device's local time zone and sent as UTC ISO strings (timestamptz).

/** A suggestion must be at least a few minutes in the future when sent. */
export const MIN_LEAD_MS = 5 * 60 * 1000;
export const DAY_COUNT = 14;
/** Clock times offered as chips; any other time stays reachable ("Other time"). */
export const TIME_CHOICES: { h: number; m: number }[] = [
  { h: 10, m: 0 },
  { h: 12, m: 30 },
  { h: 15, m: 0 },
  { h: 18, m: 0 },
  { h: 19, m: 30 },
  { h: 21, m: 0 },
];

export type LocalDay = { y: number; mo: number; d: number };

/** Today and the next DAY_COUNT-1 days, local calendar. */
export function upcomingDays(now: Date = new Date(), count: number = DAY_COUNT): LocalDay[] {
  return Array.from({ length: count }, (_, i) => {
    const x = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    return { y: x.getFullYear(), mo: x.getMonth(), d: x.getDate() };
  });
}

export const sameDay = (a: LocalDay | null, b: LocalDay | null) => !!a && !!b && a.y === b.y && a.mo === b.mo && a.d === b.d;
export const dayOf = (date: Date): LocalDay => ({ y: date.getFullYear(), mo: date.getMonth(), d: date.getDate() });

/** Local day + local clock time → UTC ISO string. */
export function combineLocal(day: LocalDay, time: { h: number; m: number }): string {
  return new Date(day.y, day.mo, day.d, time.h, time.m, 0, 0).toISOString();
}

export function isSendableTime(iso: string | null, now: Date = new Date()): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t - now.getTime() >= MIN_LEAD_MS;
}

/** A time chip is usable on that day only if it is still far enough ahead. */
export function timeAvailableOn(day: LocalDay, time: { h: number; m: number }, now: Date = new Date()): boolean {
  return isSendableTime(combineLocal(day, time), now);
}

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function dayLabel(day: LocalDay, now: Date = new Date()): { top: string; bottom: string } {
  const x = new Date(day.y, day.mo, day.d);
  const today = dayOf(now);
  const tomorrow = dayOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
  const top = sameDay(day, today) ? 'Today' : sameDay(day, tomorrow) ? 'Tomorrow' : WD[x.getDay()];
  return { top, bottom: `${x.getDate()} ${MO[x.getMonth()]}` };
}

export const timeLabel = (t: { h: number; m: number }) => `${String(t.h).padStart(2, '0')}:${String(t.m).padStart(2, '0')}`;

/** Summary line, e.g. "Sat 4 Oct · 19:30 · Decide together". */
export function suggestionSummary(day: LocalDay | null, time: { h: number; m: number } | null, place: string): string | null {
  if (!day || !time) return null;
  const x = new Date(day.y, day.mo, day.d);
  return `${WD[x.getDay()]} ${x.getDate()} ${MO[x.getMonth()]} · ${timeLabel(time)} · ${place.trim() || 'Decide together'}`;
}
