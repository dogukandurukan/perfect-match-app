// Pure ruler math for the D48 height input (kept separate for testing).
export const TICK = 10; // px per cm
export const DEFAULT_WINDOW = { min: 120, max: 230 };
export const NEUTRAL_VISUAL_CM = 170; // initial ruler position only, never submitted
const HALF_WINDOW = 60;

export type Range = { min: number; max: number };

/** Viewport, not a rule: keep the current window unless the value is outside
 * it, then re-centre around the value. */
export function rangeFor(value: number | null, current: Range = DEFAULT_WINDOW): Range {
  if (value === null || (value >= current.min && value <= current.max)) return current;
  return { min: Math.max(1, value - HALF_WINDOW), max: value + HALF_WINDOW };
}

export function offsetForCm(cm: number, r: Range): number {
  return (Math.min(Math.max(cm, r.min), r.max) - r.min) * TICK;
}

export function cmForOffset(x: number, r: Range): number {
  const cm = r.min + Math.round(x / TICK);
  return Math.min(Math.max(cm, r.min), r.max);
}

/** Parsed height from the draft string, or null. */
export function heightValue(text: string): number | null {
  return /^\d{1,3}$/.test(text) && Number(text) > 0 ? Number(text) : null;
}
