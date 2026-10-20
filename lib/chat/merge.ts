// Merge server rows into the chat's message list (pure). Used for the initial
// load and for every catch-up after Realtime (re)connects or the app returns
// to the foreground: a message is never shown twice (same id), the list stays
// in time order, and when nothing is new the SAME array is returned so React
// does not re-render or scroll.

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
    } else if (JSON.stringify(old) !== JSON.stringify({ ...old, ...m })) {
      byId.set(m.id, { ...old, ...m });
      changed = true;
    }
  }
  if (!changed) return prev;
  return [...byId.values()].sort((a, b) => (a.created_at === b.created_at ? a.id.localeCompare(b.id) : a.created_at.localeCompare(b.created_at)));
}

/** How many ids in `next` were not in `prev` (new messages after a catch-up). */
export function countNew<T extends Row>(prev: T[], next: T[]): number {
  if (prev === next) return 0;
  const seen = new Set(prev.map((m) => m.id));
  return next.reduce((n, m) => (seen.has(m.id) ? n : n + 1), 0);
}
