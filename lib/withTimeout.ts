// Bounds a pending network/auth call so a screen can never stay in a
// loading state forever: rejects with a TimeoutError after `ms`. The original
// request is not cancelled (supabase-js has no abort for auth calls); its late
// result is ignored by the caller.
export class TimeoutError extends Error {
  constructor(public readonly step: string, ms: number) {
    super(`${step} timed out after ${ms} ms`);
    this.name = 'TimeoutError';
  }
}

export function withTimeout<T>(promise: PromiseLike<T>, ms: number, step: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new TimeoutError(step, ms)), ms);
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/** Short user-facing text for a failed step. */
export function friendlyNetworkError(e: unknown, fallback: string): string {
  if (e instanceof TimeoutError) return 'This is taking too long. Check your connection and try again.';
  const m = e instanceof Error ? e.message : String(e ?? '');
  if (/Network request failed|fetch failed|network/i.test(m)) return 'No connection. Check your internet and try again.';
  return fallback;
}
