// Signed-URL cache behaviour with a fake clock (15-minute TTL, re-sign when
// < 60 s are left, shared in-flight signing, no caching of refusals, forget
// on block). Run: node scripts/p0-checks/photo_url_cache.check.mjs
import { createPhotoUrlCache } from '../../lib/photoUrlCache.ts';

let passed = 0;
let failed = 0;
const check = (c, n) => (c ? passed++ : (failed++, console.log('FAIL', n)));

let t = 0;
let calls = 0;
const signed = [];
const visible = new Set(['u1/a.jpg', 'u1/b.jpg', 'u2/c.jpg']);
const cache = createPhotoUrlCache({
  ttlSec: 900,
  refreshMarginSec: 60,
  now: () => t,
  sign: async (paths, ttl) => {
    calls += 1;
    signed.push({ paths: [...paths], ttl, at: t });
    return paths.map((p) => ({ path: p, signedUrl: visible.has(p) ? `https://x/${p}?t=${t}` : null }));
  },
});

const u1 = await cache.resolve('u1/a.jpg');
check(u1 === 'https://x/u1/a.jpg?t=0' && calls === 1, 'first resolve signs');
check(signed[0].ttl === 900, 'TTL is 15 minutes');
t = 13 * 60 * 1000;
check((await cache.resolve('u1/a.jpg')) === u1 && calls === 1, 'reused at 13 min');
check(cache.peek('u1/a.jpg') === u1, 'peek returns the fresh URL');
t = 14 * 60 * 1000 + 1;
check(cache.peek('u1/a.jpg') === null, 'peek refuses a URL with < 60 s left');
const u2 = await cache.resolve('u1/a.jpg');
check(u2 !== u1 && calls === 2, 're-signed after 14 min (before expiry)');

t = 20 * 60 * 1000;
const [m] = await Promise.all([
  cache.resolveMany(['u1/b.jpg', 'u2/c.jpg', 'u1/b.jpg']),
  cache.resolve('u1/b.jpg'),
]);
check(m.get('u1/b.jpg') && m.get('u2/c.jpg'), 'batch resolves');
check(signed.at(-1).paths.length === 2 && calls === 3, 'one signing call for the batch; concurrent request shared');

const hidden = await cache.resolve('u3/x.jpg');
check(hidden === null, 'refused (not visible) → null');
visible.add('u3/x.jpg');
check((await cache.resolve('u3/x.jpg')) !== null, 'refusal not cached (becomes visible later)');

check((await cache.resolve('https://seed.example/p.jpg')) === 'https://seed.example/p.jpg', 'https passthrough');
check((await cache.resolve('')) === null && (await cache.resolve(null)) === null, 'empty → null');

cache.invalidateOwner('u1');
check(cache.peek('u1/b.jpg') === null && cache.peek('u2/c.jpg') !== null, 'forget one owner only');
visible.delete('u1/b.jpg'); // e.g. blocked: server refuses from now on
check((await cache.resolve('u1/b.jpg')) === null, 'after block + forget, no new URL');

console.log(`photo URL cache: ${passed}/${passed + failed} passed`);
process.exit(failed ? 1 : 0);
