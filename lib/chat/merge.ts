// Merge server rows into the chat's message list (pure). Used for the initial
// load and for every catch-up after Realtime (re)connects or the app returns
// to the foreground: a message is never shown twice (same id), the list stays
// in time order, and when nothing is new the SAME array is returned so React
// does not re-render or scroll. A stale response never undoes newer data.

type Row = { id: string; created_at: string };

export function mergeMessages<T extends Row>(prev: T[], incoming: T[] | null | undefined): T[] {
  if (!incoming || incoming.length === 0) return prev;
  const byId = new Map<string, T>();
  for (const m of prev) byId.set(m.id, m);
  let changed = false;
  for (const m of incoming) {
    const old = byId.get(m.id);
    if (!old) {
      byId.set(m.id, m);
      changed = true;
      continue;
    }
    // A known row only gains values (e.g. read_at set later). An older
    // response can never blank a field the screen already has.
    let next: T | null = null;
    for (const k of Object.keys(m) as (keyof T)[]) {
      if ((old[k] === null || old[k] === undefined) && m[k] !== null && m[k] !== undefined) {
        next = next ?? { ...old };
        next[k] = m[k];
      }
    }
    if (next) {
      byId.set(m.id, next);
      changed = true;
    }
  }
  if (!changed) return prev;
  return [...byId.values()].sort(compareByTime);
}

// Realtime payloads and REST rows may format the same timestamptz differently
// ("…925509" vs "…925509+00:00"): compare as time first; on an equal
// millisecond fall back to the text (keeps microseconds) and then the id.
function compareByTime(a: Row, b: Row): number {
  const ta = Date.parse(a.created_at);
  const tb = Date.parse(b.created_at);
  if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return ta - tb;
  if (a.created_at !== b.created_at) return a.created_at.localeCompare(b.created_at);
  return a.id.localeCompare(b.id);
}

/** How many ids in `next` were not in `prev` (new messages after a catch-up). */
export function countNew<T extends Row>(prev: T[], next: T[]): number {
  if (prev === next) return 0;
  const seen = new Set(prev.map((m) => m.id));
  return next.reduce((n, m) => (seen.has(m.id) ? n : n + 1), 0);
}
