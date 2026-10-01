// Time ideas for "Suggest a date" from the V2 first-date preferences
// (Section 6, DECISIONS D57: Days = Weekdays / Weekends / Either, Time =
// Daytime / Evening / Either — GENERAL preferences, "Choose the exact time
// together", not availability). They are only starting points: the sheet
// labels them as ideas from date preferences, never as "available" or as
// something the other person agreed to. No preference → no ideas (just the
// date/time picker). Pure module (Node-testable).
import type { DaysKey, TimeKey } from './yourDates';

export type DatePrefs = { days: DaysKey | null; time: TimeKey | null };

// Representative local clock times for the two broad time preferences.
export const DAYTIME_HOUR = { h: 13, m: 0 };
export const EVENING_HOUR = { h: 19, m: 30 };
export const MAX_IDEAS = 3;

const WEEKDAYS = [1, 2, 3, 4, 5];
const WEEKENDS = [0, 6];

function daySet(d: DaysKey | null): number[] | null {
  if (d === 'weekdays') return WEEKDAYS;
  if (d === 'weekends') return WEEKENDS;
  if (d === 'either') return [...WEEKDAYS, ...WEEKENDS];
  return null;
}

function timeSet(t: TimeKey | null): { h: number; m: number }[] | null {
  if (t === 'daytime') return [DAYTIME_HOUR];
  if (t === 'evening') return [EVENING_HOUR];
  if (t === 'either') return [DAYTIME_HOUR, EVENING_HOUR];
  return null;
}

function intersect<T>(a: T[] | null, b: T[] | null, key: (x: T) => string): T[] | null {
  if (!a) return b;
  if (!b) return a;
  const kb = new Set(b.map(key));
  const both = a.filter((x) => kb.has(key(x)));
  return both.length > 0 ? both : a; // no overlap → keep the caller's own preference
}

export type DateIdeas = { times: string[]; basis: 'both' | 'mine' | null };

/**
 * Up to MAX_IDEAS upcoming slots (ISO, built in the device's local time zone),
 * starting TOMORROW so an idea can never be in the past when the sheet opens.
 * Uses the overlap of both people's preferences when both are known and
 * overlap, otherwise the caller's own. Nothing known → no ideas.
 */
export function dateIdeas(mine: DatePrefs | null, theirs: DatePrefs | null, now: Date = new Date()): DateIdeas {
  const myDays = daySet(mine?.days ?? null);
  const myTimes = timeSet(mine?.time ?? null);
  if (!myDays || !myTimes) return { times: [], basis: null };
  const days = intersect(myDays, daySet(theirs?.days ?? null), String) ?? myDays;
  const times = intersect(myTimes, timeSet(theirs?.time ?? null), (x) => `${x.h}:${x.m}`) ?? myTimes;
  const theirsKnown = !!theirs?.days && !!theirs?.time;
  const usedBoth = theirsKnown && days.length > 0 && times.length > 0
    && days.every((d) => (daySet(theirs!.days) ?? []).includes(d))
    && times.every((t) => (timeSet(theirs!.time) ?? []).some((x) => x.h === t.h && x.m === t.m));

  const out: string[] = [];
  for (let offset = 1; offset <= 21 && out.length < MAX_IDEAS; offset += 1) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    if (!days.includes(day.getDay())) continue;
    for (const t of times) {
      if (out.length >= MAX_IDEAS) break;
      const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), t.h, t.m, 0, 0);
      if (at.getTime() > now.getTime()) out.push(at.toISOString());
    }
  }
  return { times: out, basis: out.length === 0 ? null : usedBoth ? 'both' : 'mine' };
}

/** A suggestion must be at least a few minutes in the future when sent. */
export const MIN_LEAD_MS = 5 * 60 * 1000;
export function isSendableTime(iso: string | null, now: Date = new Date()): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t - now.getTime() >= MIN_LEAD_MS;
}
