# P0 privacy remediation — plan (PROPOSED, NOT APPLIED)

Revision 2 · 2026-09-29 · Branch `tempa/p0-privacy` · Author: Claude Code.
Result report with test output and the live package: `work-packages/P0_PRIVACY_RESULT.md`.

> ⚠️ **The risk is still live.** Nothing here has been applied to the live
> project. Until P0-A and P0-B are applied, every issue in §1 remains
> exploitable. It must be closed **before any real user signs up** and before
> WP1 (persistent V2 profiles).
>
> **P0-A alone is not privacy.** P0-A closes the write holes and listing, and
> adds the new read paths, but other signed-in users can still read other
> users' private columns from `profiles` **until P0-B** is applied. Photos stay
> **public by URL** until the private-bucket step (§3), which is required
> before the closed beta.

Files (all in `supabase/proposed/`, never `supabase/migrations/`, so no CLI
command can apply them by accident):

| File | Purpose |
|---|---|
| `20260928130000_p0a_privacy_additive.sql` | P0-A — additive, safe with the current app |
| `20260928130000_p0a_privacy_additive.rollback.sql` | Exact revert to the live state (reopens P0-A's holes — not a default, §5.3) |
| `20260928130100_p0b_privacy_restrict.sql` | P0-B — own-row-only `profiles`, original RPCs closed |
| `20260928130100_p0b_privacy_restrict.emergency_reopen.sql` | Re-exposes private data. **Not a rollback**; owner decision only (§5.3) |
| `tests/http_p0.test.mjs` (+ `replica.mjs`, `client_shapes.mjs`, `live_snapshot_2026-09-29.json`) | Local verification over real PostgREST (§6) |

## 1. Findings (live, read-only catalog, 2026-09-28/29)

No other user's data was read. Every exposure below was reproduced only on the
local replica with synthetic users (§6, stage LIVE).

| # | Exposure | Mechanism | Closed by |
|---|---|---|---|
| 1 | Any signed-in user reads another user's `last_name`, `date_of_birth`, `phone_number`, `full_address`, `lat/lng`, `district`, `instagram_handle`, `expo_push_token`, `verification_selfie_path`, `meeting_preferences`, `discovery_*`, `is_premium`, … | `profiles_select_authenticated` + table-level SELECT on every column | P0-B |
| 2 | Hidden profiles readable through a **bare candidate** `matches` row — and clients can create such rows themselves | "has any matches row" branch of the same policy | P0-A (rows can't be created towards hidden users) + P0-B |
| 3 | Full DOB (+ district) of candidates; premium likers list includes people who **blocked you** or **deleted** their account | `get_top_matches`, `get_my_likers` | P0-A wrappers + P0-B revoke |
| 4 | Surname of another user shown in the UI | `app/user-profile.tsx` header | R-P0 |
| 5 | New user sets server fields on first insert (`photo_verified`, `is_premium`, `waitlist_*`, `deleted_at`, `daily_*`) | table-level INSERT on all columns (only UPDATE was locked down) | P0-A |
| 6 | Self-granted onboarding completion; selfie path pointing into another user's folder | client-writable `setup_completed`, `verification_selfie_path` | P0-A trigger (interim; V2 server state later) |
| 7 | **Forged consent on matches:** a user can set `status='accepted'`, `chat_opened=true` or `invited_by` on any of their own matches rows (incl. rows they create) → opens a chat and messages anyone discoverable without consent; can also write the other side's check-in/rating/intro and confirm their own meetup proposal | `matches_update_own` only checks "participant, not blocked"; all columns updatable | P0-A `guard_match_client_writes` |
| 8 | Receiver or sender rewrites message **content**; users rewrite notification text, a like's `status`/`match_id`, or a report's target after filing | table-level UPDATE on all columns | P0-A column grants + read-receipt policy |
| 9 | Anonymous listing of all profile photos (enumerates user IDs) | `photos are public` storage policy (role public) | P0-A |
| 10 | Photos of any user by URL, even signed out, incl. hidden/blocking users; onboarding names are **predictable** (`{uid}/photo_{n}.jpg`) | public bucket | R-P0 (new names random) → private bucket (§3) |
| 11 | `anon` has INSERT/UPDATE/DELETE/TRUNCATE on every public table; `authenticated` TRUNCATE/TRIGGER/REFERENCES | Supabase default grants | P0-A |
| 12 | **The `matches-push-notification` trigger embeds a service-role credential** in its definition (visible to anyone with catalog read access, incl. the read-only MCP role). The value was never printed or copied. | Dashboard "database webhook" | Ops step (§5, step 0) — rotate + move to Vault; not SQL in this package |

## 2. Public card vs private account fields

**Principle:** `profiles` becomes **own-row only** (all columns for the owner).
Other people are read only through allowlisted surfaces with one visibility rule.

**One visibility rule — `can_view_profile(viewer, target)`** (SECURITY DEFINER,
not callable by clients; clients only get `can_view_profile_as_me(target)` —
a function referenced by a view is EXECUTE-checked as the *caller*, and the
two-argument form would be an oracle: "can B see D?" ⇒ "do B and D have a
match/like?"). `security_barrier` on the view only prevents leaky functions
from seeing filtered rows; **the authorization is this explicit predicate.**

### Access table

| Target (relative to the viewer) | `profile_cards` | discovery | likers list | `profiles` row (after P0-B) | photo by URL (until §3) |
|---|---|---|---|---|---|
| Self | ✅ | – | – | ✅ full | ✅ |
| Discoverable stranger (setup done, not hidden, not deleted) | ✅ | ✅ (filters apply) | – | ❌ | ✅ |
| Incomplete onboarding, no connection | ❌ (live: ✅) | ❌ | – | ❌ | ✅ if URL known |
| Hidden, no connection | ❌ | ❌ | – | ❌ | ✅ if URL known |
| Hidden, only a bare candidate row | ❌ (live: ✅) | ❌ | – | ❌ | ✅ if URL known |
| Hidden, invite pending / accepted / open chat | ✅ | ❌ | – | ❌ | ✅ |
| Hidden, has a live like on me | ✅ | ❌ | ✅ | ❌ | ✅ |
| Old match: expired or passed, target discoverable | ✅ as stranger | ❌ for 14 / 42 days | – | ❌ | ✅ |
| Old match: expired or passed, target hidden | ❌ | ❌ | – | ❌ | ✅ if URL known |
| Deleted (`deleted_at` set), even with a chat | ❌ (live: ✅ with a match) | ❌ | ❌ (live: ✅) | ❌ | ✅ until objects are deleted |
| I blocked them | ✅ card only (unblock list) | ❌ | ❌ | ❌ | ✅ |
| They blocked me | ❌ | ❌ | ❌ (live: ✅ for premium) | ❌ | ✅ if URL known |

"✅ if URL known": the viewer may still hold an old public URL (cached screen,
earlier chat). That residual access ends only with the private bucket (§3) —
and even then not instantly (§3.2).

### Columns

- **`profile_cards`:** `id, first_name, age (computed), zodiac_sign, city, gender, languages, morning_night, recharge_style, hobbies, drinking, smoking, pets, education, education_detail, occupation, height_cm, bio, availability_days, availability_hours, meeting_environment, favorite_spots, first_date_expectation, favorite_music, favorite_movie, favorite_book, favorite_activity, core_value, impressed_by, dealbreaker, photos, photo_verified, interested_in_viewer`.
- **Removed from the card in revision 2:** `district` (see below), `is_hidden`, `hide_location`, `setup_completed`, `vibe` (unused legacy).
- **Private (owner only):** identity/contact (`last_name, date_of_birth, phone_number, dial_code, country_code, full_address, lat, lng, instagram_handle, district`), device/verification (`expo_push_token, verification_selfie_path`), preferences (`meeting_preferences, discovery_*, notify_*, neighborhoods, preferred_locations, religion`), account state (`is_premium, waitlist_*, daily_*, current_step, setup*_completed, deleted_at, last_active_at, privacy_consent_at, phone_verified, quick_icebreaker_answers, username, created_at, updated_at`, `is_hidden`, `hide_location`).
- **Not added (open question Q-P0-2):** `intent`. It lives in `onboarding_answers`, which is already own-row only, so today other users' "Looking for" silently shows nothing. Adding it to the card is a product/KVKK decision, not part of P0.

### District is private (decision implemented in revision 2)

District is not returned to other users anywhere. Required changes, all made:

| Where | Before | After |
|---|---|---|
| `profile_cards` | included | removed |
| `get_discovery_cards` | passed through `get_top_matches.district` | dropped |
| Home hero / Matches / candidate / user profile | showed "📍 Kadıköy" | city only ("📍 Istanbul · nearby") |
| Plan your date venues (`micro-intro.tsx`) | read the other's district; labelled "Near {name}" | server RPC `get_date_venue_suggestions(p_other)`: "Near both of you" (same district), "Near you", then the rest. The other's district is never sent or used as a label |
| Matches fallback reason ("Nearby") | computed from the other's district | only the server's own reasons (see below) |
| Vibe "same district" strip | filtered other users by district | category removed |
| Map (hidden route) | placed other users on the map by district | people layer disabled (needs a k-anonymous server count if revived) |

**Residual, by design:** the server still uses district for scoring, the
`same_district` discovery filter and the "Nearby"/"Near both of you" labels.
Those reveal one bit — *same district as me* — to people in your own district.
Removing that would change matching, which P0 does not do.

### RPCs for the client

- `get_discovery_cards(p_limit)` — same rows and order as `get_top_matches` (body and scoring unchanged, proven by an order-equality test), `age` instead of DOB, no district.
- `get_my_liker_cards(p_limit)` — re-implements `get_my_likers` with the same premium gate and order, `age` instead of DOB, **and only likers you may see** (the original returned blocked/deleted likers).
- `get_date_venue_suggestions(p_other)` — above.

## 3. Photos

### 3.1 Now → P0-A → R-P0

| Path | Live today | After P0-A | After R-P0 |
|---|---|---|---|
| Anonymous listing | ✅ | ❌ | ❌ |
| Signed-in listing of others' folders | ✅ | ❌ own folder only | ❌ |
| Known public URL | ✅ anyone, predictable names | ✅ unchanged (display uses public URLs) | ✅ unchanged; **new** uploads get random names (`{uid}/p{n}-{random}.jpg`, `{uid}/{random}.jpg`) |
| Selfies (`verification-selfies`, private) | nobody can read/list; own upload/delete | + `verification_selfie_path` must be in own folder | same |

A random name is **not access control**: anyone who has seen the URL once
(a match, a screenshot, a cache) can keep loading it. Existing objects keep
their predictable names until the migration below.

### 3.2 Required before the closed beta — private bucket + signed URLs

Changes (to be packaged as P1-photos after P0-B):

1. **Storage:** new private bucket (e.g. `profile-photos-private`, `public = false`).
   Policies: INSERT/DELETE own folder only; **SELECT** when
   `public.can_view_profile_as_me(((storage.foldername(name))[1])::uuid)`.
   With that policy the client can call `createSignedUrl(s)` itself — no
   Edge Function needed — and a hidden/blocking/deleted user's photos can no
   longer be signed.
2. **Data migration (service role, one-off):** copy every object to the new
   bucket under a random name, rewrite `profiles.photos` (and liker
   `photo_path` sources) in the same transaction per user, then delete the
   old objects and the old `user-photos` public bucket (and the unused,
   empty public `profile-photos` bucket).
3. **Client:** replace `getProfilePhotoPublicUrl` / `resolveProfilePhotoUrl`
   with one batched `createSignedUrls` helper (Home, Matches `PersonAvatar`,
   chat header + bubbles, Activity, user/candidate profile, plan detail,
   blocked users, own profile/edit); uploads go to the new bucket.
4. **Cache:** signed URLs change on every call, so `expo-image` needs a
   stable `cacheKey` (the object path) to avoid refetch storms; on block,
   clear that user's cache keys.
5. **Push / Edge Functions:** must never embed photo URLs.

**Expiry, refresh and revocation — what we can and cannot promise:**
- Signed URLs are bearer tokens until they expire. Supabase cannot revoke one
  before expiry (only deleting/moving the object does). Proposed TTL: 15 min
  for grids, refreshed on screen focus; never > 1 h.
- After a block, hide or delete, **new** URLs are refused immediately, but a URL
  issued earlier keeps working until it expires, and images already in the
  viewer's device cache stay visible until evicted. So the promise is:
  *"no new access after the change; existing access ends within the TTL
  (device cache aside)"* — **not** instant revocation.
- Deleting an account deletes the objects (existing Edge Function), which
  does end URL access immediately (cache aside).

## 4. Client-writable fields after P0-A

| Table / field | Before | After P0-A |
|---|---|---|
| `profiles`: `photo_verified`, `is_premium`, `waitlist_*`, `daily_*`, `deleted_at`, `phone_verified`, `setup1_completed`, `username`, `religion`, `created_at` | insertable | not insertable or updatable |
| `profiles.setup_completed` | free | true only with first name, 18+ DOB, gender, city, interested-in. **A field check is not a server-controlled review** — V2 moves this to server state transitions (WP2) |
| `profiles.verification_selfie_path` | any value | own folder only |
| `matches` insert | any row with anyone not blocked | fresh candidate only, towards someone you can see and haven't blocked |
| `matches.status → accepted`, `chat_opened → true` | either side, any time | only the **invitee** of a real invite (or, per the existing gender rule, a woman opening the chat in the same write that sends her invite to a man) |
| `matches.invited_by` | any value | once, to yourself, on a live candidate |
| `matches` score / TTL / created_at | any | only before an invite; TTL ≤ 48 h |
| expired → pending (revive) | kept stale invite/chat/meetup | normalized to a clean candidate |
| intro answers, check-in, rating | either side's | your own side only; rating 1–10; `checkin_confirmed` only when both checked in |
| meetup proposal | anyone, incl. confirming your own | needs an invite/chat; you propose (or accept one of the inviter's offered times); only the other side confirms |
| `user_a/b_accepted`, `source`, user ids | writable | immutable |
| delete match / message | allowed by grants (no policy) | revoked |
| `messages` | any column by either side | insert `sender_id, receiver_id, content`; update `read_at` by the **receiver** only |
| `notifications` | any column | `is_read` only |
| `likes` | any column incl. `status`, `match_id` | `status` must be `sent`; target must be visible to you; liker/likee/match_id immutable |
| `reports` / `blocks` / `events` | updatable | append-only (blocks deletable = unblock) |

The `matches` guard is an **interim** state machine in a trigger. The durable
design is still WP2: all match writes through SECURITY DEFINER RPCs with row
locks.

## 5. Order and recovery

### 5.1 Order

0. **Ops (independent, do first):** rotate the service-role key that is embedded in the `matches-push-notification` webhook and recreate the webhook so the secret lives in Vault / a secret header (never in the trigger text). Do not print or copy the old value.
1. **P0-A** — additive; the current app keeps working (tested: old read shapes, invite → accept → meetup → message → check-in, likes, blocks, reports, uploads).
2. **R-P0 client** (this branch) — every other-user read moves to `profile_cards` / the RPCs; own reads stay on `profiles`. Every installed build must have it before step 3 (today: the dev clients; later: a forced minimum version).
3. **P0-B** — own-row-only `profiles`; original RPCs closed.
4. **P1-photos** (§3.2) — before the closed beta.

### 5.2 What each step changes on screens

| Screen | P0-A (old client) | R-P0 client |
|---|---|---|
| Home | unchanged | district → city; age from server |
| Matches | unchanged | same; "Nearby" fallback reason only if the server gives it |
| Plan your date | unchanged | venue labels "Near both of you" / "Near you" only |
| Other user's profile | unchanged | no surname, no district |
| Activity likers | unchanged | blocked / deleted likers no longer listed or counted |
| Vibe / Map (no navigation entry) | unchanged | district strip removed / people layer disabled |

### 5.3 Recovery — fix-forward, not reopen

A rollback that reopens private data is **not** a safe default.

| Symptom after applying | Do this | Exposure while doing it |
|---|---|---|
| A legitimate match/meetup/check-in write is rejected by the new guard | Fix-forward: `drop trigger matches_guard_client_writes on public.matches;`, fix the rule, re-create. | Only the forged-consent hole (#7) reopens, for that window |
| A like write is rejected | Same with `likes_guard_client_writes` | #8 for likes |
| Onboarding completion rejected wrongly | Same with `profiles_guard_client_writes` | #6 |
| A screen breaks after P0-B | Ship a client hotfix that reads `profile_cards`/RPCs, or **disable that screen**; do **not** reopen `profiles` | none |
| Everything is on fire and the owner accepts re-exposure in writing | `…p0b…emergency_reopen.sql`, then re-apply P0-B after the hotfix | #1–#3 reopen |
| P0-A must be removed entirely (owner decision, P0-B not applied) | `…p0a…rollback.sql` (verified to restore the exact live policies/grants/functions) | all P0-A holes reopen |

## 6. Verification (local, isolated)

See `work-packages/P0_PRIVACY_RESULT.md` for the full output. Summary:
PGlite (Postgres 18.3 in WASM) loaded with a replica built from the live
catalog snapshot — **real** function bodies (incl. `get_top_matches`,
`get_my_likers`, `handle_mutual_like`, `upsert_match`), real triggers
(webhook excluded), policies, table + column grants and function ACLs —
served by **PostgREST 13.0.8** (live runs v14.4) with locally signed JWTs.
Actors: anon, the owner, 14 synthetic users covering every row of the access
table. **256 / 256 checks pass** across LIVE (exposure reproduced) → P0-A →
P0-B → revert fidelity. Storage policies are checked in SQL as each role (the
Storage HTTP server is not part of the replica).

## 7. Open decisions

1. Approve the live order in §5.1 (step 0 first).
2. Q-P0-2: should the other person's `intent` ("Looking for") be on the card?
3. Private photo bucket TTL (proposed 15 min) and whether the chat keeps showing a blocked person's past photos from cache.
4. Should hidden users stay visible to people they already have an invite/chat with (current rule: yes) or only to accepted chats?
