// Pure signed-URL cache (P0 photos, no React / Supabase imports so it can be
// tested in Node with a fake clock — scripts/p0-checks/photo_url_cache.check.mjs).
//
// Rules:
// - A signed URL is reused only while it has more than `refreshMarginSec`
//   left; after that the next request signs a fresh one (15-minute TTL means
//   a URL is at most ~14 minutes old when handed out).
// - Concurrent requests for the same path share one signing call.
// - Paths the server refuses to sign (not visible to you: hidden, blocked,
//   deleted) resolve to null and are NOT cached, so a later un-hide works.
// - `invalidateOwner(uid)` drops everything under `{uid}/` (used on block);
//   it cannot revoke URLs already handed out or images already downloaded —
//   those end when the URL expires / the device cache evicts them.

export type SignResult = { path: string; signedUrl: string | null };
export type Signer = (paths: string[], ttlSec: number) => Promise<SignResult[]>;

export type PhotoUrlCacheOptions = {
  sign: Signer;
  ttlSec: number;
  refreshMarginSec: number;
  now?: () => number; // ms
};

type Entry = { url: string; expiresAt: number };

export function createPhotoUrlCache(opts: PhotoUrlCacheOptions) {
  const now = opts.now ?? (() => Date.now());
  const cache = new Map<string, Entry>();
  const inflight = new Map<string, Promise<string | null>>();

  const isPassthrough = (ref: string) => ref.startsWith('http://') || ref.startsWith('https://');

  function fresh(path: string): string | null {
    const e = cache.get(path);
    if (!e) return null;
    if (e.expiresAt - opts.refreshMarginSec * 1000 <= now()) {
      cache.delete(path);
      return null;
    }
    return e.url;
  }

  /** Cached, still-fresh URL or null — never signs. For render-time reads after `resolveMany`. */
  function peek(ref: string | null | undefined): string | null {
    if (!ref?.trim()) return null;
    if (isPassthrough(ref)) return ref;
    return fresh(ref);
  }

  async function resolveMany(refs: (string | null | undefined)[]): Promise<Map<string, string | null>> {
    const out = new Map<string, string | null>();
    const toSign: string[] = [];
    const waits: Promise<void>[] = [];
    const seen = new Set<string>();
    for (const raw of refs) {
      const ref = raw?.trim();
      if (!ref || seen.has(ref)) continue;
      seen.add(ref);
      if (isPassthrough(ref)) {
        out.set(ref, ref);
        continue;
      }
      const hit = fresh(ref);
      if (hit) {
        out.set(ref, hit);
        continue;
      }
      const pending = inflight.get(ref);
      if (pending) {
        waits.push(pending.then((u) => void out.set(ref, u)));
        continue;
      }
      toSign.push(ref);
    }
    if (toSign.length > 0) {
      const issuedAt = now();
      const batch = opts
        .sign(toSign, opts.ttlSec)
        .then((rows) => {
          const byPath = new Map(rows.map((r) => [r.path, r.signedUrl]));
          return byPath;
        })
        .catch(() => new Map<string, string | null>());
      for (const path of toSign) {
        const p = batch.then((byPath) => {
          const url = byPath.get(path) ?? null;
          if (url) cache.set(path, { url, expiresAt: issuedAt + opts.ttlSec * 1000 });
          return url;
        });
        inflight.set(path, p);
        waits.push(
          p.then((u) => {
            out.set(path, u);
          }).finally(() => inflight.delete(path)),
        );
      }
    }
    await Promise.all(waits);
    return out;
  }

  async function resolve(ref: string | null | undefined): Promise<string | null> {
    if (!ref?.trim()) return null;
    return (await resolveMany([ref])).get(ref.trim()) ?? null;
  }

  function invalidateOwner(ownerId: string) {
    const prefix = `${ownerId}/`;
    for (const key of [...cache.keys()]) if (key.startsWith(prefix)) cache.delete(key);
  }

  return { peek, resolve, resolveMany, invalidateOwner, size: () => cache.size };
}
