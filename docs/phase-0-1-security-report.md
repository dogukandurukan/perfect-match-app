# Phase 0.1 Security Report

2026-09-21. Scope: exactly the 3 fixes requested — `onboarding_answers` privacy + `get_top_matches` hardening, the `daily_views_count` client-bypass loophole, and selfie-migration cleanup. **No Onboarding V2, UI, auth, matching-formula, application or membership work was touched** — the matching *formula* (every CASE expression, weight, normalizer) is byte-for-byte identical to before; only eligibility/auth plumbing around it changed.

Correction up front: `docs/matching-engine-v2.md` (2026-09-20) stated `onboarding_answers` had "sadece 3 satır" — that was wrong, or the data changed since. A count during this session showed several hundred rows (close to the ~505 `profiles` count), meaning the exposure fixed below was real for close to the whole user base, not an edge case. Noted here rather than silently editing the earlier doc (same append-only convention as CLAUDE.md).

---

## 1. `onboarding_answers` privacy + `get_top_matches` hardening

### 1.1 What was wrong

```sql
"onboarding_select_authenticated" — cmd SELECT, roles {authenticated}, qual: true
```
Any signed-in user could read **anyone's** raw `intent`/`relationship_pace`/`children_view`/etc. via a direct REST query (`GET /rest/v1/onboarding_answers?user_id=eq.<anyone>`). This existed only because `get_top_matches` was `SECURITY INVOKER` and needed to read a *candidate's* `onboarding_answers.intent` (not just the caller's own) to score `intent_score` — the exact tension flagged in the task ("yalnızca policy'yi user_id=auth.uid() yapmak matching RPC'sinin aday cevaplarını görmesini engelliyorsa bunu körlemesine yapma").

A second, independently-confirmed issue made a blind fix riskier than it looked: `get_top_matches` **never verified `p_user_id` matched the caller** — `anon` could even `EXECUTE` it. Harmless *today* only because SECURITY INVOKER + `profiles`'s own RLS already blocked `anon` from seeing any `profiles` rows — but would have become a full, no-login database read once the function became SECURITY DEFINER without this check.

### 1.2 Fix

Migration: `supabase/migrations/20260921090000_onboarding_answers_privacy_and_matching_definer.sql`

1. **Dropped** the `qual: true` policy. `"Users can manage own answers"` (`ALL`, `auth.uid() = user_id`, pre-existing, untouched) already covers "read your own row" — confirmed nothing new needed adding for that path (test 1 below).
2. **`get_top_matches` → `SECURITY DEFINER`**, `search_path` fixed to `'public', 'pg_temp'` (matches `get_my_likers`'s exact pattern) — needed so it can still read every candidate's `onboarding_answers.intent` internally. The function's `RETURNS TABLE` shape is unchanged: it never returned a raw `onboarding_answers` column before this and still doesn't — only derived `match_percentage`/`match_category`/`reasons`.
3. **`auth.uid() = p_user_id` is now enforced** — added to the `me` CTE's `WHERE` (`WHERE p.id = p_user_id AND auth.uid() = p_user_id`). If false, `me` returns zero rows; every downstream CTE `CROSS JOIN`s `me`, so the whole result set is empty. Chosen over rewriting the function to `plpgsql` with an explicit `RAISE EXCEPTION` — the function is a single, carefully-tuned `WITH ... SELECT` (documented in `docs/matching-engine-v2.md`), and restructuring its control flow to add one check would have been a much larger, riskier diff than gating one CTE's `WHERE` clause.
4. **`p.is_hidden`/`p.deleted_at` are now filtered explicitly** in the `candidates` CTE. This is the "don't blindly flip to DEFINER" check: under the old `SECURITY INVOKER` mode, `profiles`'s own SELECT RLS (`profiles_select_authenticated`) silently excluded hidden/deleted profiles from ever reaching the function's own `WHERE` clause. `SECURITY DEFINER` bypasses RLS for *everything* the function touches, not just `onboarding_answers` — without this explicit addition, hidden/deleted profiles would have started resurfacing as discovery candidates, regressing the 2026-08-29 P0 fix CLAUDE.md documents. The added condition (`COALESCE(p.is_hidden,false)=false AND p.deleted_at IS NULL`) is copied verbatim from that policy's own logic.
5. **`EXECUTE` revoked from `anon`/`public`, granted only to `authenticated`** — same pattern as `get_my_likers`/`try_send_invite`/`increment_daily_views`.

Everything else in the function — every scoring CASE, the 65-point lifestyle cap, the completeness multiplier, the age-penalty cap, the reasons array — is copied character-for-character from the version documented in `docs/matching-engine-v2.md`.

### 1.3 Verification (live RLS/RPC simulation)

| Test | Action | Result |
|---|---|---|
| 1 | Read own `onboarding_answers` row (as owner) | `count = 1` — own row visible |
| 2 | Read another real user's `onboarding_answers` row | `count = 0` — blocked |
| 3 | `get_top_matches(<a different real user's uuid>, 10)` called by someone else | `0 rows` — the `auth.uid()=p_user_id` gate works |
| 4 | `get_top_matches(<own uuid>, 10)` | `10 rows` — real matching still works, unchanged |
| 5 | `get_top_matches(...)` as `anon` (no session at all) | `42501 permission denied for function get_top_matches` |

Static grant check: `get_top_matches` is now `SECURITY DEFINER` (`prosecdef=true`), `anon` EXECUTE → `false`, `authenticated` EXECUTE → `true`.

---

## 2. `daily_views_count` client-bypass loophole

### 2.1 What was wrong (found during Phase 0, fixed now)

`lib/dailyViews.ts`'s `refreshDailyViewsIfNeeded` did a **direct client-side** `UPDATE profiles SET daily_views_count=0, daily_views_reset_at=now()` whenever its own in-memory 24h check said a reset was due. Since that check ran entirely in JS, any authenticated user could PATCH those two columns via a raw REST call at any time, resetting their own like-quota on demand — regardless of whether 24h had actually passed. `lib/dailyInvites.ts` never had this problem (it's read-only; all writes already went through `try_send_invite`).

### 2.2 Fix

Migration: `supabase/migrations/20260921091500_daily_views_rpc_only.sql`

- New `get_daily_views_state(p_user uuid)` RPC — same shape as the existing `increment_daily_views` (row-locked with `SELECT ... FOR UPDATE`, `auth.uid() = p_user` enforced, `SECURITY DEFINER`, `search_path` fixed): peeks at the count, and if `reset_at` is null or more than 24h old, resets it to 0 server-side, in the same transaction, under the same row lock. `increment_daily_views` itself needed **no changes** — it already did the right thing.
- `daily_views_count`/`daily_views_reset_at` **removed from the `authenticated` UPDATE allowlist** (they were only ever added there in Phase 0 specifically to avoid breaking the direct-update path this migration now replaces).
- `lib/dailyViews.ts`: `refreshDailyViewsIfNeeded` now calls `supabase.rpc('get_daily_views_state', {p_user: userId})` instead of `.select()` + conditional `.update()`. The now-dead local `needsReset()` helper was removed (server owns that decision now). `msUntilReset`/`formatDailyResetCountdown` (pure display helpers used by `components/DailyLimitEmptyState.tsx`) are untouched — they only ever consumed a `resetAt` value, never wrote anything.

### 2.3 Verification (live RLS/RPC simulation, real account)

Test account: `5503c067-...` (real `daily_views_count=3`, `daily_views_reset_at` from 2026-09-14 — i.e. genuinely 6+ days stale going into this test, not fabricated).

| Test | Action | Result |
|---|---|---|
| A | Direct client `UPDATE profiles SET daily_views_count=0, daily_views_reset_at=now()` | `42501 permission denied for table profiles` |
| B | `get_daily_views_state(<self>)` with the real stale `reset_at` | Reset correctly: `count=0`, `reset_at` moved to now |
| C | Admin-set `count=2` with the now-fresh `reset_at` from test B, then `get_daily_views_state(<self>)` again | `count=2` unchanged — did **not** reset (fresh window correctly left alone) |
| D | `increment_daily_views(<self>)` right after test C | `count=3` — atomic increment still works, unaffected by this migration |

Static grant check: `authenticated` can no longer `UPDATE` `daily_views_count`/`daily_views_reset_at` directly; can `EXECUTE get_daily_views_state`; `anon` cannot.

**Race-condition note:** both `get_daily_views_state` and `increment_daily_views` take `SELECT ... FOR UPDATE` on the same `profiles` row before reading, so a peek and an increment (or two increments) arriving concurrently serialize on that row lock rather than racing — this is the same mechanism `try_send_invite` already relies on elsewhere in this codebase, not a new pattern. Two genuinely simultaneous requests were not fired against a live server to observe the lock in real time (would need two parallel connections timed against each other); the row-lock guarantee itself is what Postgres documents as sufficient, and is the exact mechanism already trusted for `increment_daily_views`/`try_send_invite` before this session.

**Free/premium behavior:** unaffected — `get_daily_views_state` returns the same `is_premium` it always read from `profiles`, and `lib/dailyViews.ts`'s `dailyViewLimitFor(isPremium)` (free=5/premium=10) was not touched.

---

## 3. Selfie migration cleanup

1. **`supabase/functions/migrate-verification-selfies/` removed entirely** from the deployable functions folder. It was already deleted from the live Supabase project in Phase 0 (invoked once, verified, `supabase functions delete`'d) — this removes the local source too. It was **never committed to git**, so there is no history to scrub; deleting it now leaves zero trace anywhere, which is stronger than "archived but redacted."
2. **`docs/security-migrations/2026-09-20-migrate-verification-selfies.md`** — a prose description of what it did (mechanism + order of operations: copy → byte-compare → repoint → only-then-delete-source), with **no real user ids** — the note explicitly says the original was never committed and there's nothing to recover by digging through git.
3. **`lib/userPhotosStorage.ts`**: `verificationSelfiePath()` now calls a new `secureRandomToken()` helper that prefers `globalThis.crypto.randomUUID()`, falls back to `globalThis.crypto.getRandomValues()` (both fed through a hex encoder) if only that exists, and only falls back to the old `Date.now()+Math.random()` shape if neither Web Crypto API is present at runtime. This project has no `expo-crypto`/`react-native-get-random-values` dependency, and adding one is a **native module** requiring a dev-client rebuild before it could run at all (CLAUDE.md §2) — squarely out of scope for a security-only phase, and untested-native-dependency risk (a hard crash on every selfie upload if the assumption were wrong) is worse than a graceful runtime feature-detection. `npx tsc --noEmit` confirms the `Crypto` type resolves fine in this project's tsconfig without any new dependency.
4. **`docs/phase-0-security-report.md` §7 (Rollback) rewritten** — the old text included `update storage.buckets set public = true where id = 'verification-selfies';` as an "undo" example. Removed. The section now states explicitly that there is no safe rollback which makes the bucket public again, and that a safe rollback means stopping new uploads + a controlled, re-verified data migration (the same copy → verify → repoint → delete-source shape used to fix this originally), never flipping the bucket back to public. A dated addendum in §6 notes the function file's later removal, since leaving the old "kept in the repo" sentence there unedited would have been actively wrong.

---

## 4. Verification summary

- `npx tsc --noEmit` — clean.
- All migration/RLS/RPC tests above — 9 total (5 for §1, 4 for §2) — all passed with the expected result, verified via `SET ROLE authenticated` + a real `request.jwt.claims` GUC against the **live** database (the only trustworthy method in this environment — both `mcp__supabase__execute_sql`'s role and the CLI's own connection bypass RLS via `rolbypassrls`, confirmed again this session when a stray non-RLS-simulated query needed a second look).
- Normal profile update: covered by Phase 0's own test 1 (`first_name`), unaffected by anything in this phase (no change to the `profiles` allowlist except *removing* two columns nobody was supposed to write directly anyway).
- Profile photo upload/display regression check: `user-photos` bucket's own policies were not touched by either the §1 or §2 migrations (only `onboarding_answers`, `get_top_matches`, a new RPC, and `profiles` column grants were touched) — no code path for ordinary profile photos was modified in this phase at all.
- Verification selfie upload: unaffected by this phase (already fixed and verified in Phase 0); this phase only removed the now-finished migration utility and improved the token generator, neither of which changes the upload flow's behavior (still one `storage.upload()` call to the same bucket, just a different (stronger, when available) random suffix).

## 5. Files changed

- `supabase/migrations/20260921090000_onboarding_answers_privacy_and_matching_definer.sql` (new)
- `supabase/migrations/20260921091500_daily_views_rpc_only.sql` (new)
- `lib/dailyViews.ts` (peek/reset now via RPC; dead `needsReset` removed)
- `lib/userPhotosStorage.ts` (`secureRandomToken()` helper)
- `docs/security-migrations/2026-09-20-migrate-verification-selfies.md` (new, redacted historical note)
- `docs/phase-0-security-report.md` (§6 addendum, §7 rollback rewritten)
- Removed: `supabase/functions/migrate-verification-selfies/` (entire directory)

No other files were touched. Nothing was committed (per instructions).

## 6. Honest limitations

- Concurrency for `get_daily_views_state`/`increment_daily_views` was verified by code inspection (`SELECT ... FOR UPDATE` on both, same pattern as the already-trusted `try_send_invite`) rather than by firing two genuinely simultaneous requests at a live server — see the note in §2.3.
- As in Phase 0, all RLS/RPC verification used `SET ROLE` + a manually-set JWT claim via the CLI, not a real device hitting the live REST API with a genuine session token — the reliable simulation method already established for this project, but still a simulation.
- The `onboarding_answers` row-count correction (top of this document) was discovered incidentally while picking two real ids for a test query — worth flagging since it changes how many real users the original exposure actually affected, but a full re-audit of that earlier document's other row-count claims was not performed (out of scope for this phase).
