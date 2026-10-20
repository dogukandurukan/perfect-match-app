// Chat message sync (no React, no app client import — the caller passes a
// Supabase client), shared by app/chat.tsx and the local soak test.
//
// Why: PostgREST caps every response at `max_rows` (1000 locally). The chat
// used to read ALL messages oldest-first with no limit, so a chat over 1000
// messages showed the OLDEST 1000 and a catch-up could never return new ones.
// Now:
//   loadLatest — the newest `limit` messages (newest-first query, then oldest
//                first for display);
//   loadSince  — everything after the newest message we already have (minus a
//                small overlap for rows committed out of order), page by page,
//                at most `maxPages` pages; `complete: false` when cut off.
// The merge (lib/chat/merge.ts) drops duplicates.

export const INITIAL_LIMIT = 500;
export const CATCHUP_PAGE = 200;
export const CATCHUP_MAX_PAGES = 10;
/** Rows can commit slightly out of created_at order; re-read this much. */
export const OVERLAP_MS = 2 * 60 * 1000;

type Row = { id: string; created_at: string; sender_id: string; receiver_id: string };
type Result<T> = { ok: true; rows: T[]; complete: boolean } | { ok: false; error: string };
// Minimal shape of the Supabase query builder used here.
type QueryClient = { from: (table: string) => any };

const pairFilter = (me: string, other: string) =>
  `and(sender_id.eq.${me},receiver_id.eq.${other}),and(sender_id.eq.${other},receiver_id.eq.${me})`;

/** Newest created_at in a list (null for an empty list). */
export function newestCreatedAt(rows: { created_at: string }[]): string | null {
  let best: number | null = null;
  let iso: string | null = null;
  for (const r of rows) {
    const t = Date.parse(r.created_at);
    if (Number.isFinite(t) && (best === null || t > best)) {
      best = t;
      iso = r.created_at;
    }
  }
  return iso;
}

export async function loadLatest<T extends Row>(client: QueryClient, me: string, other: string, limit = INITIAL_LIMIT): Promise<Result<T>> {
  const { data, error } = await client
    .from('messages')
    .select('*')
    .or(pairFilter(me, other))
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit);
  if (error) return { ok: false, error: error.message ?? String(error) };
  const rows = ((data ?? []) as T[]).slice().reverse();
  return { ok: true, rows, complete: rows.length < limit };
}

export async function loadSince<T extends Row>(
  client: QueryClient,
  me: string,
  other: string,
  sinceIso: string | null,
  page = CATCHUP_PAGE,
  maxPages = CATCHUP_MAX_PAGES,
): Promise<Result<T>> {
  if (!sinceIso || !Number.isFinite(Date.parse(sinceIso))) return loadLatest<T>(client, me, other);
  let cursor = new Date(Date.parse(sinceIso) - OVERLAP_MS).toISOString();
  const out: T[] = [];
  for (let i = 0; i < maxPages; i += 1) {
    const { data, error } = await client
      .from('messages')
      .select('*')
      .or(pairFilter(me, other))
      .gte('created_at', cursor)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .limit(page);
    if (error) return { ok: false, error: error.message ?? String(error) };
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < page) return { ok: true, rows: out, complete: true };
    const next = rows[rows.length - 1].created_at;
    // A full page of identical timestamps can't advance the cursor: stop
    // (reported incomplete) instead of looping.
    if (Date.parse(next) <= Date.parse(cursor)) return { ok: true, rows: out, complete: false };
    cursor = next;
  }
  return { ok: true, rows: out, complete: false };
}

/**
 * Runs catch-ups one at a time. A trigger while one runs schedules exactly one
 * more run, which uses the LATEST key and function (a switched chat never gets
 * the previous chat's rows, and the previous chat's pending run is dropped).
 */
export class CatchUpRunner {
  private running = false;
  private again = false;
  constructor(private readonly current: () => { key: string; run: (key: string) => Promise<void> }) {}
  async trigger(): Promise<void> {
    if (this.running) {
      this.again = true;
      return;
    }
    this.running = true;
    try {
      do {
        this.again = false;
        const { key, run } = this.current();
        await run(key);
      } while (this.again);
    } finally {
      this.running = false;
    }
  }
}
