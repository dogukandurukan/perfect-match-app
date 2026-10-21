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

// ---- Older history (2026-10-21) ----
// Keyset paging backwards from the oldest message on screen, on the total
// order (created_at, id): no offset (no shift when messages arrive), and rows
// sharing one timestamp are split by id — never skipped or repeated.

export const OLDER_PAGE = 100;

/** Oldest row in a list by (created_at, id); null for an empty list. */
export function oldestCursor(rows: { id: string; created_at: string }[]): { created_at: string; id: string } | null {
  let best: { created_at: string; id: string } | null = null;
  for (const r of rows) {
    if (!best) { best = r; continue; }
    const a = Date.parse(r.created_at);
    const b = Date.parse(best.created_at);
    if (a < b || (a === b && (r.created_at < best.created_at || (r.created_at === best.created_at && r.id < best.id)))) best = r;
  }
  return best ? { created_at: best.created_at, id: best.id } : null;
}

export async function loadBefore<T extends Row>(
  client: QueryClient,
  me: string,
  other: string,
  cursor: { created_at: string; id: string },
  page = OLDER_PAGE,
): Promise<Result<T>> {
  const c = cursor.created_at.replace(/"/g, '');
  const { data, error } = await client
    .from('messages')
    .select('*')
    .or(pairFilter(me, other))
    .or(`created_at.lt."${c}",and(created_at.eq."${c}",id.lt.${cursor.id})`)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(page);
  if (error) return { ok: false, error: error.message ?? String(error) };
  const rows = ((data ?? []) as T[]).slice().reverse();
  return { ok: true, rows, complete: rows.length < page };
}

export type OlderState = { hasMore: boolean; loading: boolean; error: string | null };

/**
 * Loads older pages one at a time. Nothing happens while a page is loading or
 * once the history is complete. A result that comes back after the chat
 * changed (reset with another key) is dropped and touches no state. A failure
 * keeps the list and leaves `hasMore` so the user can retry.
 */
export class OlderPager {
  state: OlderState = { hasMore: false, loading: false, error: null };
  private key = '';
  constructor(private readonly onChange: (s: OlderState) => void = () => {}) {}
  reset(key: string, hasMore: boolean): void {
    this.key = key;
    this.state = { hasMore, loading: false, error: null };
    this.onChange(this.state);
  }
  async load<T>(key: string, fetchPage: () => Promise<Result<T>>, apply: (rows: T[]) => void): Promise<void> {
    if (key !== this.key || this.state.loading || !this.state.hasMore) return;
    this.state = { ...this.state, loading: true, error: null };
    this.onChange(this.state);
    let r: Result<T>;
    try {
      r = await fetchPage();
    } catch (e) {
      r = { ok: false, error: (e as Error)?.message ?? 'failed' };
    }
    if (key !== this.key) return; // chat changed meanwhile: drop
    if (!r.ok) {
      this.state = { ...this.state, loading: false, error: r.error };
    } else {
      apply(r.rows);
      this.state = { hasMore: !r.complete, loading: false, error: null };
    }
    this.onChange(this.state);
  }
}
