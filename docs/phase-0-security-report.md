# Phase 0 Security Report

2026-09-20. Scope: exactly the 2 fixes approved from `docs/onboarding-v2-gap-analysis.md`'s §0 — `profiles` column-level UPDATE lockdown, and moving verification selfies to a private storage bucket. **No Onboarding V2, auth, matching, application-state-machine or membership work was touched.**

---

## 1. Summary

| Vulnerability | Status |
|---|---|
| Any authenticated user could PATCH their own `profiles` row and set `photo_verified`/`is_premium`/`waitlist_number`/`waitlist_boost` to anything | **Fixed** — verified with a real RLS simulation (not just a config read) |
| Verification selfies were stored at a predictable path in a PUBLIC bucket, downloadable by anyone who knew a user's uuid | **Fixed** — moved to a new private bucket, old public copies deleted, new uploads go to the private bucket |

Both fixes were verified against the **live** database with `SET ROLE authenticated` + a real `request.jwt.claims` GUC (per CLAUDE.md's documented methodology) — not just by reading grants/policies, since both `mcp__supabase__execute_sql`'s role and the Supabase CLI's role bypass RLS (`rolbypassrls`) and would otherwise give a false "looks fine" reading.

---

## 2. `profiles` column-level UPDATE lockdown

### 2.1 What was actually wrong (confirmed before fixing)

```sql
select has_column_privilege('authenticated','public.profiles','photo_verified','UPDATE'); -- true
select has_column_privilege('authenticated','public.profiles','is_premium','UPDATE');      -- true
select has_column_privilege('authenticated','public.profiles','waitlist_number','UPDATE'); -- true
```

`profiles` had Supabase's default blanket table-level `GRANT ALL` to `authenticated` (confirmed via `aclexplode(relacl)`, not just `information_schema` — that view returned empty for this project for reasons unrelated to the actual grants, a dead end worth noting for future sessions). The only UPDATE RLS policy was:

```sql
"Users can update own profile" — USING (auth.uid() = id), no WITH CHECK
```

`USING` alone does not restrict which columns get written or what values they get written to — only which *rows* are visible to the UPDATE. Combined with the blanket column grant, this meant a straight `PATCH /rest/v1/profiles?id=eq.<self>` with `{"photo_verified": true}` succeeded.

### 2.2 Fix — allowlist, not a blocklist

Migration: `supabase/migrations/20260920090000_lockdown_profiles_column_grants.sql`

```sql
revoke update on public.profiles from authenticated;
grant update (<explicit column list>) on public.profiles to authenticated;

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
```

This is the pattern requested: revoke the blanket grant first, then explicitly re-grant only what's needed — a REVOKE-only column approach would have been insufficient (the table-level grant would have still allowed everything not explicitly revoked). Everything **not** in the grant list — including any future server-controlled field — is safe by default: a client write attempt fails with `42501` instead of silently succeeding.

The `WITH CHECK (auth.uid() = id)` is new (didn't exist before) — it closes a second, smaller gap: without it, `id` being in the grant list (needed for a reason below) would have let a user attempt to change their own row's `id` to someone else's uuid. Now that's blocked at the RLS layer regardless of column grants.

### 2.3 Why `id` is in the grant list

`onboardingStep1Context.tsx`'s `upsert(baseProfile, {onConflict:'id'})` (used by every onboarding step) generates `INSERT ... ON CONFLICT (id) DO UPDATE SET id = EXCLUDED.id, ...` — PostgREST/Postgres's upsert includes the conflict key itself in the `SET` list. Without `id` in the grant, **every onboarding upsert would have failed with 42501**, breaking normal onboarding immediately. Confirmed this reasoning is correct by testing: granting `id` + the `WITH CHECK` together lets the column be "touched" in the SET clause (so upsert works) while making it impossible for the value to actually change (test 4 below).

### 2.4 Full audit of every client write to `profiles` (how the allowlist was built)

Grepped `app/` + `lib/` for every `.from('profiles').update(...)`/`.upsert(...)` call site — this is the complete list, nothing else exists:

| File | Columns written |
|---|---|
| `lib/onboardingStep1Context.tsx` | `first_name, last_name, full_address, city, district, discovery_max_distance, lat, lng, gender, meeting_preferences, languages, date_of_birth, zodiac_sign, current_step, photos, phone_number, dial_code, country_code, instagram_handle, verification_selfie_path` |
| `lib/onboardingStep2Context.tsx` | `current_step` only (the actual answers go to `onboarding_answers`, a different table, out of scope here) |
| `lib/onboardingStep3Context.tsx` | `morning_night, recharge_style, hobbies, drinking, smoking, education, education_detail, occupation, height_cm, pets, current_step` |
| `lib/onboardingStep4Context.tsx` | `availability_days, availability_hours, meeting_environment, favorite_spots, preferred_locations, first_date_expectation, bio, current_step, setup_completed` |
| `app/profile-edit.tsx` | `bio, first_date_expectation, instagram_handle, occupation, height_cm, availability_days, availability_hours, meeting_environment, favorite_spots, favorite_music, favorite_movie, favorite_book, favorite_activity, core_value, impressed_by, dealbreaker, photos` |
| `app/filters.tsx` | `city, district` (direct) + everything in `lib/profileSettings.ts`'s patch type |
| `lib/profileSettings.ts` (`updateProfileSettings`, used by filters.tsx + settings.tsx) | `discovery_age_min, discovery_age_max, discovery_max_distance, meeting_preferences, notify_new_match, notify_messages, notify_meeting_invite, is_hidden, hide_location, discovery_verified_only, discovery_nonsmokers_only, discovery_height_min, discovery_height_max, discovery_zodiac_signs, discovery_pets, discovery_education, discovery_active_today` |
| `lib/notifications.ts` | `expo_push_token` |
| `lib/location.ts` | `lat, lng` |
| `lib/lastActive.ts` | `last_active_at` |
| `app/chat.tsx` | `quick_icebreaker_answers` |
| `app/(auth)/register.tsx` | `privacy_consent_at` (initial stub row at signup) |
| `lib/dailyViews.ts` | `daily_views_count, daily_views_reset_at` — see §2.6, kept working but flagged |

Columns confirmed **never written by any client code** (grepped, zero call sites) and therefore correctly excluded: `setup1_completed`, `username`, `vibe`, `neighborhoods`, `religion`, `discovery_religion` (frozen by product decision, 2026-09-13), `daily_invites_count`/`daily_invites_reset_at` (RPC-only, see `lib/dailyInvites.ts` — it only ever `.select()`s, the actual increment+reset happens inside `try_send_invite`), `created_at`, `updated_at` (trigger-managed — trigger-set columns are exempt from the invoking role's column-privilege check, confirmed this doesn't need a grant), `deleted_at`.

### 2.5 Verification (live RLS simulation, `SET ROLE authenticated` + real JWT claim)

All 4 tests run via `npx supabase db query --linked -f <file>`, each its own transaction, rolled back:

| Test | Action | Result |
|---|---|---|
| 1 | `update profiles set first_name = first_name where id = '<self>'` | **Succeeded** — normal profile edits still work |
| 2 | `update profiles set photo_verified = true where id = '<self>'` | **Failed**: `42501 permission denied for table profiles` |
| 3 | `update profiles set is_premium = true where id = '<self>'` | **Failed**: `42501 permission denied for table profiles` |
| 4 | `update profiles set id = '<other-uuid>' where id = '<self>'` | **Failed**: `42501 new row violates row-level security policy` (the `WITH CHECK`, not a column-privilege error — confirms both layers are working together) |

Plus a static check confirming the full allowlist: `photos`, `bio`, `discovery_age_min` → `true`; `photo_verified`, `is_premium`, `waitlist_number`, `waitlist_boost`, `deleted_at`, `created_at`, `daily_invites_count` → `false`; `daily_views_count` → `true` (intentional, see §2.6).

### 2.6 Found during this audit, deliberately NOT fixed (out of Phase 0 scope)

`lib/dailyViews.ts`'s `refreshDailyViewsIfNeeded` does a **direct client-side** `update({daily_views_count:0, daily_views_reset_at})` when its own in-memory 24h check says a reset is due — unlike `lib/dailyInvites.ts` (read-only, all writes go through the `try_send_invite` RPC). This means a user can reset their own like-quota to 0 at any time via a raw REST call, regardless of whether 24h actually passed, bypassing the daily like limit. This is real and pre-existing, but:
- Including these two columns in the allowlist (what was done) causes **zero regression** — behavior is identical to before this migration.
- Excluding them would have **broken** the existing, working "quota resets after 24h" UI flow for every real user, which the user's own instructions explicitly said not to do ("mevcut normal profil güncellemelerini bozmamak").
- Fixing it properly means porting this reset logic into a small `SECURITY DEFINER` RPC mirroring `increment_daily_views`'s existing pattern — a real, small, well-scoped follow-up, but it's new code beyond "lock down 4 named columns + a storage bucket," so it wasn't done here per "Faz 0 dışına çıkma."

**Recommended as the very next small follow-up**, not part of this phase.

Also noted but not touched (same reasoning — real, but a different, separate finding from a different audit): `onboarding_answers` has a `SELECT` policy with `qual: true` for all authenticated users (any signed-in user can read anyone's `intent`/`relationship_pace`/etc. via a direct REST query) — flagged in `docs/onboarding-v2-gap-analysis.md` already, not part of this phase's scope (it's a SELECT/onboarding_answers issue, not a `profiles` UPDATE issue).

---

## 3. Verification selfie: private bucket migration

### 3.1 What was actually wrong (confirmed before fixing)

```sql
select id, public from storage.buckets; -- user-photos: public = true
```

`verification_selfie_path` = `{userId}/verification_selfie.jpg`, stored in the same **public** `user-photos` bucket as ordinary profile photos. Any authenticated user regularly sees other users' real uuids (Discover, Matches, Chat) — combined with a public bucket and a fixed, guessable filename, this meant:

```
https://fyqwjduzpnjuxqsloxih.supabase.co/storage/v1/object/public/user-photos/{any-known-userId}/verification_selfie.jpg
```

was downloadable with **zero authentication**.

### 3.2 Exact scope, checked before touching anything

```sql
select bucket_id, name from storage.objects
where bucket_id='user-photos' and name like '%verification_selfie%';
```
Exactly **3** objects existed (real user ids intentionally not recorded here — see `docs/security-migrations/2026-09-20-migrate-verification-selfies.md` for why):

| User | Old path (shape) | Uploaded |
|---|---|---|
| A | `{userId}/verification_selfie.jpg` | 2026-09-15 |
| B | `{userId}/verification_selfie.jpg` | 2026-09-03 |
| C | `{userId}/verification_selfie.jpg` | 2026-09-02 |

### 3.3 Fix

**New bucket** (`supabase/migrations/20260920091500_verification_selfies_private_bucket.sql`):
```sql
insert into storage.buckets (id, name, public) values ('verification-selfies','verification-selfies', false);
create policy "own folder upload only" on storage.objects for insert to authenticated
  with check (bucket_id='verification-selfies' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own folder delete only" on storage.objects for delete to authenticated
  using (bucket_id='verification-selfies' and (storage.foldername(name))[1] = auth.uid()::text);
```
No SELECT policy at all — default-deny, matches the explicit instruction ("service role/reviewer dışında selfie okuma yetkisi verme", literally including the owner). A future reviewer flow reads via a service-role Edge Function issuing short-lived signed URLs, never a direct client `SELECT`.

**Data move**: a one-time, throwaway Edge Function (`migrate-verification-selfies`, deployed with `--no-verify-jwt`, hardcoded to the exact 3 uuids above — no wildcard scan) did, per user, in order: download from `user-photos` → upload to `verification-selfies` at a new random path → **re-download and byte-compare** the new copy → update `profiles.verification_selfie_path` → **only then** delete the old public object. Deployed, invoked once, verified, then **deleted from the project** (`npx supabase functions delete migrate-verification-selfies`) — it was a migration utility, not a permanent unauthenticated endpoint. It was never committed to git (see the 2026-09-21 addendum at the end of this section) — nothing to keep in the repo beyond this description.

Result (all 3, real run):

| User | New path (shape) | downloaded | uploaded | bytesMatch | profileUpdated | oldDeleted |
|---|---|---|---|---|---|---|
| A | `{userId}/{random-token}.jpg` | ✓ | ✓ | ✓ | ✓ | ✓ |
| B | `{userId}/{random-token}.jpg` | ✓ | ✓ | ✓ | ✓ | ✓ |
| C | `{userId}/{random-token}.jpg` | ✓ | ✓ | ✓ | ✓ | ✓ |

Confirmed after: `storage.objects` has zero rows left under `user-photos` matching a selfie pattern; exactly 3 rows under `verification-selfies`; `profiles.verification_selfie_path` updated for all 3 users to their new path.

### 3.4 Client code changes (so *future* selfies also land in the private bucket)

- `lib/userPhotosStorage.ts`: new `VERIFICATION_SELFIE_BUCKET = 'verification-selfies'` constant; `verificationSelfiePath()` now returns `{userId}/{random-token}.jpg` instead of the fixed `{userId}/verification_selfie.jpg` (defense in depth — matches the project's existing convention for client-side random tokens, `Date.now().toString(36) + Math.random().toString(36).slice(2)`, same pattern already used in `micro-intro.tsx`, no new dependency).
- `lib/onboardingStep1Context.tsx`'s `uploadSelfieToSupabase` now targets `VERIFICATION_SELFIE_BUCKET` instead of `USER_PHOTOS_BUCKET`, and drops the now-meaningless `upsert:true` (paths are unique per call now, there's never an existing object to overwrite).
- Confirmed via grep: `verification_selfie_path` is **only ever written**, never read/displayed anywhere in the app (`verify.tsx` only ever shows the local pre-upload `selfieUri`) — so this bucket change cannot break any existing UI.

### 3.5 Verification (live RLS simulation)

| Test | Action | Result |
|---|---|---|
| 5 | Insert a storage.objects row under own folder (`verification-selfies`, as self) | **Succeeded** — upload flow works |
| 6 | Insert under a *different* user's folder | **Failed**: `42501 new row violates row-level security policy for table "objects"` |
| 7 | `select count(*) from storage.objects where bucket_id='verification-selfies' and name like '<own-id>%'` (as the owner) | **`count: 0`** — even the owner cannot read their own object; no SELECT policy exists at all, exactly as required |

Plain HTTP checks (no auth, and with the anon key, no user JWT):
```
GET .../object/public/user-photos/<id>/verification_selfie.jpg       -> 400 (file no longer exists, bucket still public but object is gone)
GET .../object/public/verification-selfies/<id>/<new-path>.jpg       -> 400 (bucket is private, public URL scheme rejected)
GET .../object/verification-selfies/<id>/<new-path>.jpg (anon key)   -> 400 (no matching RLS policy for anon/authenticated read)
```

`user-photos`'s own existing policies (own-folder INSERT/DELETE for authenticated, public SELECT) were **not touched** — ordinary profile photo upload/display is unaffected by construction (no statement in either migration references `user-photos`).

---

## 4. Places that read `photo_verified`/`is_premium` — confirmed unaffected

Only `UPDATE` grants changed; `SELECT` was never touched. Grepped every occurrence to be certain none of them are secretly a write:

- `app/(tabs)/index.tsx`, `app/user-profile.tsx`, `app/(tabs)/profile.tsx`, `lib/hingeProfile.ts`, `components/home/ProfileHeroCard.tsx`, `components/profile/HingeProfileCard.tsx` — all read `photo_verified` from a `.select()` result to render the verified badge. No write found anywhere (checked specifically for `photo_verified:` / `is_premium:` object-literal patterns — every hit is either a TS type annotation or copying an already-fetched value into a local display object).
- `app/(tabs)/matches.tsx`, `app/filters.tsx`, `lib/dailyInvites.ts`, `lib/dailyViews.ts` — read `is_premium` to compute daily limits/UI. `lib/matchInvite.ts`'s `p_is_premium` is an RPC *argument* to `try_send_invite`, not a table write — and that RPC has ignored this client-supplied argument for authorization since the 2026-09-08 hardening (it re-reads `profiles.is_premium` itself, `SECURITY DEFINER`, unaffected by today's grant change).
- `get_top_matches` (RPC) reads `photo_verified` for its `verified_score`/filter — a `SECURITY DEFINER`-adjacent... actually `STABLE SQL` function querying as invoker, but `SELECT` grants are untouched so this is unaffected.

No behavior change for any of these — confirmed by inspection (they were never doing an UPDATE in the first place) and by `npx tsc --noEmit` passing clean after the client code edits.

---

## 5. Advisor check (before/after)

`mcp__supabase__get_advisors(type: security)` after all changes shows the **same 4 pre-existing warnings** documented in CLAUDE.md as reviewed-and-accepted (3 intentional `SECURITY DEFINER` RPCs callable by `authenticated`/`anon`, plus "leaked password protection disabled" — a manual Dashboard toggle, unrelated to this phase). **No new advisories introduced.**

---

## 6. Files changed

- `supabase/migrations/20260920090000_lockdown_profiles_column_grants.sql` (new)
- `supabase/migrations/20260920091500_verification_selfies_private_bucket.sql` (new)
- `supabase/functions/migrate-verification-selfies/index.ts` (new — one-time utility, deployed, run once, deleted from the live project)
- `lib/userPhotosStorage.ts` (new `VERIFICATION_SELFIE_BUCKET` constant, `verificationSelfiePath()` now random)
- `lib/onboardingStep1Context.tsx` (selfie upload now targets the new bucket)

No other files were touched. `npx tsc --noEmit` — clean.

> **Update, 2026-09-21 (Phase 0.1, see `docs/phase-0-1-security-report.md`):** the `migrate-verification-selfies` source file above was removed from `supabase/functions/` entirely (it was never committed to git, so nothing needed reverting) — its 3 hardcoded real user uuids had no reason to persist on disk once the one-time job was done and verified. A redacted description of what it did lives at `docs/security-migrations/2026-09-20-migrate-verification-selfies.md` instead. `verificationSelfiePath()`'s random token also changed from `Math.random()` to a crypto-random one where the runtime supports it — see the newer report for details.

---

## 7. Rollback

The column-lockdown migration is a plain `GRANT`/`REVOKE`/`CREATE POLICY` set and is reversible if a genuinely legitimate column write turns out to be missing from the allowlist:
```sql
-- widen the allowlist for one more legitimate column, rather than undoing the lockdown wholesale
grant update (some_column_that_was_missed) on public.profiles to authenticated;
```
There is deliberately **no rollback path that restores the blanket `GRANT UPDATE ON public.profiles TO authenticated`** or recreates the old `WITH CHECK`-less policy — that would directly re-open the vulnerability this migration exists to close. If the lockdown ever needs to be "undone" because it's blocking something legitimate, the fix is to widen the allowlist (as above), never to revert to the pre-migration state.

The storage-bucket fix has the same property, for the same reason: there is no safe rollback that makes `verification-selfies` public again. **A safe rollback here means stopping new uploads and doing a controlled, re-verified data migration** — the same shape used to fix this in the first place (§3.3: copy → byte-compare → repoint → only then delete the source), never flipping `storage.buckets.public` back to `true`. The 3 migrated selfie files and their updated `verification_selfie_path` values are not reversible without re-uploading to the old bucket anyway (the old public objects were deleted only after the new copies were verified), so there is nothing to "undo" on that side even in principle.

---

## 8. Honest limitations

- Verification used `SET ROLE authenticated` + a manually-set `request.jwt.claims` GUC via the CLI, not a real device/app hitting the live REST API with a genuine user session token. This is the same methodology CLAUDE.md already established as the *reliable* one (MCP and the CLI's own connection both bypass RLS via `rolbypassrls`), but it is still a simulation, not an end-to-end device test — no UI was opened.
- `lib/dailyViews.ts`'s pre-existing quota-reset loophole (§2.6) is real and was found during this same audit but deliberately left as-is, per explicit scope discipline. It should be the next small fix.
- `onboarding_answers`'s broad `qual: true` SELECT policy (found during the earlier gap analysis, not this phase) is unrelated to `profiles` and was not touched.
