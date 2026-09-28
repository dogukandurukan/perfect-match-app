# P0 privacy remediation — package (PROPOSED, NOT APPLIED)

Date 2026-09-28 · Branch `tempa/p07-r1-profile-fixes` · Author: Claude Code.

> ⚠️ **The risk is still live.** Nothing below has been applied to the live
> project. Until P0-A and P0-B are applied, every issue in §1 remains
> exploitable. Today the live DB holds 2 accounts and no other users (read-only count,
> 2026-09-28), so there is little real data to leak **yet**. It must be closed
> **before any real user signs up**, and before WP1 (persistent V2 profiles).

Files:
- `supabase/proposed/20260928130000_p0a_privacy_additive.sql` + `.rollback.sql`
- `supabase/proposed/20260928130100_p0b_privacy_restrict.sql` + `.rollback.sql`
- `supabase/proposed/tests/p0_privacy.test.mjs` (local verification, §6)

They sit in `supabase/proposed/`, **not** `supabase/migrations/`, so no CLI
command can apply them by accident.

## 1. What a normal signed-in user can read or write today

Evidence: read-only `pg_policies`, `has_column_privilege`, `has_table_privilege` and
`pg_get_functiondef` on the live project (2026-09-28). No other user's data was
fetched. No values appear in this report or in any log. The exposure was **not**
re-exploited against live data. It was reproduced locally with synthetic rows (§6).

| # | Exposure | Mechanism (policy / grant) | API path |
|---|---|---|---|
| 1 | Another user's `last_name`, `date_of_birth`, `phone_number`, `dial_code`, `country_code`, `full_address`, `lat`, `lng`, `expo_push_token`, `verification_selfie_path`, `instagram_handle`, `meeting_preferences` (interested in), all `discovery_*` preferences, `notify_*`, `is_premium`, `last_active_at`, `privacy_consent_at`, `religion` | RLS `profiles_select_authenticated` lets any `authenticated` user read any row that is visible (own / not hidden & not deleted / shares a `matches` row). Table-level `SELECT` covers **every column**. | `GET /rest/v1/profiles?select=phone_number,date_of_birth,…&id=eq.<uuid>` with any user JWT (the anon key is in the app bundle; any account works) |
| 2 | Full DOB of candidates and likers | `get_top_matches` and `get_my_likers` return `date_of_birth` | `POST /rest/v1/rpc/get_top_matches`, `/rpc/get_my_likers` |
| 3 | Surname shown **in the UI** | `app/user-profile.tsx:407` renders `first_name last_name` of another user (contradicts D16) | app screen |
| 4 | New user sets server fields on first insert | `authenticated` has table-level **INSERT on all columns**. The 2026-09-20 lockdown only restricted UPDATE. A user whose row does not exist yet can insert `photo_verified`, `is_premium`, `waitlist_*`, `deleted_at`, `daily_*` | `POST /rest/v1/profiles` (or the app's first `upsert`) |
| 5 | Self-granted onboarding completion | `setup_completed` and `current_step` are in the UPDATE allowlist; the Home gate (`lib/profileCompletion.ts`) trusts them | `PATCH /rest/v1/profiles?id=eq.<self>` |
| 6 | Selfie path pointing anywhere | `verification_selfie_path` writable with any value | same |
| 7 | Anonymous listing of all profile photos | `storage.objects` SELECT policy `photos are public` for role **public** (+ `Anyone can view photos` for authenticated) on `user-photos` → object names `{uid}/…` enumerate user IDs and photo counts | `POST /storage/v1/object/list/user-photos` without login |
| 9 | Photos of any user by URL, even signed out, incl. hidden or blocking users | `user-photos` is public and onboarding paths are predictable (`{uid}/photo_{n}.jpg`) | `GET /storage/v1/object/public/user-photos/{uid}/photo_0.jpg` |
| 8 | Unneeded table rights | `anon` has table-level SELECT/INSERT/UPDATE/DELETE/TRUNCATE/TRIGGER/REFERENCES on `profiles`; `authenticated` has TRUNCATE/TRIGGER/REFERENCES. RLS blocks the DML; TRUNCATE is not reachable via PostgREST | direct SQL only |

Not affected / already OK: the private `verification-selfies` bucket (no SELECT
for clients); `photo_verified` / `is_premium` / `waitlist_*` are not
**UPDATE**-able (only the INSERT path, #4); `onboarding_answers` is own-row only.

## 2. Design: public profile fields vs private account fields

**Principle:** the `profiles` table becomes **own-row only** (all columns,
including private ones, for the owner). **Other users** are read only through
an allowlisted surface.

- **`public.profile_cards` (view)** — the only read path for other users. It returns:
  - Identity: `id`, `first_name`, `age` (computed; never the DOB), `zodiac_sign`.
  - Location and basics: `city`, `district`, `gender`, `languages`.
  - Lifestyle: `morning_night`, `recharge_style`, `hobbies`, `vibe`, `drinking`, `smoking`, `pets`.
  - Background: `education`, `education_detail`, `occupation`, `height_cm`, `bio`.
  - Dating: `availability_days`, `availability_hours`, `meeting_environment`, `favorite_spots`, `first_date_expectation`.
  - Favourites and prompts: `favorite_music`, `favorite_movie`, `favorite_book`, `favorite_activity`, `core_value`, `impressed_by`, `dealbreaker`.
  - Photos and flags: `photos`, `photo_verified`, `setup_completed`, `is_hidden`, `hide_location`.
  - `interested_in_viewer`: whether their interested-in includes *my* gender, **without exposing the list**.
  - Row predicate: identical to today's policy (own, or visible, or matched) plus "signed in".
  - Owned by `postgres`, with `security_barrier`, so it can compute age without granting the DOB column. `anon` has no access.
- **Private/account (owner only, via `profiles`):**
  - Identity and contact: `last_name`, `date_of_birth`, `phone_number`, `dial_code`, `country_code`, `full_address`, `lat`, `lng`, `instagram_handle`.
  - Device and verification: `expo_push_token`, `verification_selfie_path`.
  - Preferences and settings: `meeting_preferences`, `discovery_*`, `notify_*`, `neighborhoods`, `preferred_locations`, `religion` (frozen).
  - Account state and counters: `is_premium`, `waitlist_*`, `daily_*`, `current_step`, `setup1_completed`, `deleted_at`, `last_active_at`, `privacy_consent_at`, `phone_verified`, `quick_icebreaker_answers`, `username`, `created_at`, `updated_at`.
- **RPC outputs:**
  - `get_discovery_cards(p_limit)` and `get_my_liker_cards(p_limit)` are thin SECURITY DEFINER wrappers returning `age` instead of `date_of_birth`, in the same order.
  - They call the existing `get_top_matches` / `get_my_likers` **unchanged**, so no scoring or weight changes.
  - P0-B then revokes client EXECUTE on the two originals.
- **Why not just remove columns from client queries?** Because the REST API
  would still return them to anyone who asks. The restriction is enforced in the
  database (RLS + grants), and the tests prove it for anon / owner / other.
- **Trade-off:** Supabase's linter flags "security definer view". This is
  deliberate. The view's predicate re-implements the row policy, it exposes only
  allowlisted columns, and it requires `auth.uid()`. The alternative (column grants
  on `profiles` plus an RPC for the owner's own private fields) would change many
  owner code paths and still leak the DOB-for-age problem.
- **Longer term (V2):** `profile_private_v2` / account-state tables
  (see `V2_INTEGRATION_PLAN.md`) replace this split cleanly.

## 3. `user-photos` — three access paths, evaluated separately

| Path | Today | After P0-A | Later (phase 2) |
|---|---|---|---|
| **Anonymous listing** (enumerate objects) | ✅ allowed (`photos are public`, role public) | ❌ blocked (policy dropped) | ❌ |
| **Signed-in listing of others' folders** | ✅ allowed (`Anyone can view photos`) | ❌ only own folder (`user-photos read own folder`) | ❌ |
| **Known object URL** (`/storage/v1/object/public/user-photos/<path>`) | ✅ anyone with the link (public bucket bypasses RLS) — and onboarding paths are **predictable** (`{uid}/photo_{n}.jpg`) | ✅ unchanged — all app photo URLs are public URLs (`lib/resolveProfilePhotoUrl.ts`, `lib/userPhotosStorage.ts` `resolveProfilePhotoUrl` also returns public URLs), so display keeps working | Make the bucket **private**; serve **short-lived signed URLs** from a SECURITY DEFINER RPC / Edge Function that checks the same visibility as `profile_cards` (not hidden, not blocked, matched or discoverable) |
| **Authorized viewing in app** | public URL | public URL | signed URL (hidden/blocked profiles stop loading) |
| **Own upload / delete** | own folder (policies duplicated) | own folder (duplicates removed) | own folder via `profile_photos` RPCs (V2) |

**Profile photos and selfie are separate buckets.** Profile photos live in
public `user-photos`. The private selfie lives in `verification-selfies`
(private; clients can upload/delete only their own folder and can **never
read or list**; reviewers use the service role). P0-A additionally guarantees that
`profiles.verification_selfie_path` can only point into the caller's own
folder. After P0-B, nobody but the owner can read that column. The unused
public `profile-photos` bucket (no policies) is left as is — delete it separately after
confirming it is empty (it is: 0 objects).

**Correction — photo paths are guessable.** V1 onboarding stores photos at
`{uid}/photo_{n}.jpg` (`lib/userPhotosStorage.ts` `profilePhotoObjectPath`), and
profile edit uses `{uid}/{Date.now()}.jpg`. Other users see UIDs everywhere. So
**closing listing does not stop direct access**: anyone, even signed out, who
knows a UID can open that user's onboarding photos by URL, including photos of
hidden or blocking users. P0-A cannot fix this without breaking display.
It is addressed in two steps:
- **R-P0:** new uploads use a random token path (`{uid}/{random}.jpg`, same
  helper as the selfie). This makes new URLs unguessable. Existing objects keep
  their old names until they are re-uploaded or moved by a one-off
  service-role script.
- **Phase 2:** a private bucket with visibility-checked signed URLs removes
  public URL access entirely. Until phase 2, profile photos should be treated
  as **public by URL**.

## 4. Client-writable review/access fields

| Field | Client write today | Proposal |
|---|---|---|
| `photo_verified`, `is_premium`, `waitlist_number/boost`, `daily_*` | UPDATE: no · **INSERT: yes** (#4) | P0-A: INSERT allowlist = UPDATE allowlist → no |
| `deleted_at`, `phone_verified`, `setup1_completed`, `username`, `religion`, `created_at` | INSERT yes | P0-A: no |
| `setup_completed` | yes | P0-A trigger: can only become `true` with first name, 18+ DOB, gender, city and interested-in present (V1 onboarding end still works; reviewers/service role exempt). **V2:** replaced by server-controlled `profile_account_state_v2` transitions (`submit_application`, `review_*`, `activate_membership` RPCs); the Home gate must read that server state (WP2) |
| `current_step` | yes | harmless (resume hint); V2 moves it to account state |
| `is_hidden`, `hide_location` | yes | intentional user controls; keep |
| `verification_selfie_path` | yes (any value) | P0-A: own folder only; V2: server-only column in account state |

Server-controlled transitions (proposal, WP2): only SECURITY DEFINER RPCs with
row locks and FROM-state guards write application/verification/membership
state. Reviewer actions run through the service role (Studio / Edge
Function). No client role has UPDATE on those columns.

## 5. Order, affected screens, rollback

1. **P0-A migration** — additive. Safe with the **current** app: verified locally that owner reads, uploads and the register/onboarding writes still work, and that the old read path still works until P0-B.
   - Closes #4, #5 (trivial self-completion), #6, #7 and #8 (TRUNCATE).
   - Prepares `profile_cards` and the age wrappers.
2. **Client release "R-P0"** — switch every **other-user** read to `profile_cards` / the wrappers and use `age` instead of the DOB. **Own** reads stay on `profiles`, unchanged.
   - Every installed build must have this before step 3. Today that is only the dev client; in production it would be a forced update.
3. **P0-B migration** — own-row-only `profiles`, no anon table access, and revoked client EXECUTE on the DOB-returning RPCs. Closes #1 and #2.
4. **Phase 2** (with WP2): private `user-photos` + visibility-checked signed URLs; V2 account state replaces the `setup_completed` gate.

**Code adaptations for R-P0** (identified, **not yet made** — they must ship together with the migrations. Changing them now would break this branch against today's live DB during your phone review):

| Screen | File:line (branch `tempa/p07-r1-profile-fixes`) | Change |
|---|---|---|
| Discover / Home | `app/(tabs)/index.tsx:278` `rpc('get_top_matches', {p_user_id, p_limit})` → `rpc('get_discovery_cards', {p_limit})`; `TopMatchRow.date_of_birth` → `age`; `:357`, `:389` `.from('profiles')…in('id', userIds)` → `.from('profile_cards')` | same columns are public |
| Matches (Ready/Plans) | `app/(tabs)/matches.tsx:444`, `:644`, `:661` → `profile_cards`, `date_of_birth` → `age`; `:462` refill RPC → `get_discovery_cards` | `matchToHinge…`/age helpers take `age` |
| Candidate profile | `app/candidate-profile.tsx:131` → `profile_cards`, `age` | own read `:139` unchanged |
| Other user's profile | `app/user-profile.tsx:147` → `profile_cards`; **remove `last_name` from the header (`:407`)**; drop `meeting_preferences` (use `interested_in_viewer` if needed) | |
| Plan detail | `app/plan-detail.tsx:73` → `profile_cards`, `age` | |
| Chat header / avatars | `app/chat.tsx:131` (other's photos) → `profile_cards` | own reads `:149`, `:276`, `:439` unchanged |
| Chats list | `app/(tabs)/messages.tsx:114` → `profile_cards` | |
| Activity | `app/(tabs)/notifications.tsx:982` `rpc('get_my_likers')` → `get_my_liker_cards` (+ `age`); `:1070`, `:1182`, `:1435` → `profile_cards` | `:1121` own unchanged |
| Blocked users | `app/blocked-users.tsx:70` → `profile_cards` | |
| Plan a date | `app/micro-intro.tsx:221` (other's gender/district/availability) → `profile_cards` | `:207` own unchanged |
| Map (hidden tab) | `app/(tabs)/map.tsx:198` → `profile_cards`, `age` | filters `is_hidden` / `hide_location` stay available |
| Vibe (hidden tab) | `lib/vibeCategories.ts:124/127/187` → `profile_cards`; mutual check via `interested_in_viewer` instead of the other person's `meeting_preferences` | own read `:271` unchanged |
| Shared helpers | `lib/hingeProfile.ts` (`hingeSafeAge`), `components/profile/HingeProfileCard.tsx`, Home card components — accept `age` directly | |
| Photo upload paths | `lib/userPhotosStorage.ts` `profilePhotoObjectPath` (`{uid}/photo_{n}.jpg`) and `app/profile-edit.tsx:293` (`{uid}/{Date.now()}.jpg`) → random token path like `verificationSelfiePath` | new URLs become unguessable |

Owner-only reads that stay on `profiles` (they work under P0-B, tested):
`settings.tsx`, `profile-edit.tsx`, `(tabs)/profile.tsx`, `filters.tsx`,
`lib/profileSettings.ts`, `lib/dailyInvites.ts`, `lib/profileCompletion.ts`,
and own reads in chat/candidate-profile/notifications/matches/vibe.

**Rollback** (files tested locally, §6):
- If R-P0 misbehaves after P0-B → apply `p0b…rollback.sql`. The previous read access returns (the exposure re-opens). The R-P0 client keeps working because `profile_cards` still exists.
- `p0a…rollback.sql` restores the pre-P0 grants and policies exactly (as dumped live) and drops the view and wrappers. Use it **only** if no client depends on them (i.e. before R-P0 ships, or after reverting the client).
- Order when rolling back both: B first, then A.

## 6. Verification performed (local only)

`supabase/proposed/tests/p0_privacy.test.mjs` on **PGlite** (Postgres in WASM; it enforces roles, column privileges and RLS).

**Setup — the harness rebuilds the relevant live state:**
- The live `profiles` columns and Supabase's default grants.
- The **real** `20260920090000` lockdown file, plus the 20260921091500 revoke.
- The live RLS and storage policies as dumped.
- Stub RPCs with the live signatures.

It then applies the **real proposed files**. It uses synthetic sentinel values and prints pass/fail only.

**Result: 49/49 passed.**

| Actor | Stage | Verified |
|---|---|---|
| other signed-in user | baseline | CAN read private columns; CAN list others' photos; RPC returns full DOB — exposure reproduced |
| new user | baseline | CAN insert `photo_verified` / `is_premium` — reproduced |
| anon | baseline | CAN list `user-photos` — reproduced |
| new user | P0-A | insert `photo_verified` / `is_premium` denied; register-style insert (id + consent) OK; insert for another id blocked; `setup_completed` without required fields rejected, with them accepted; later edits OK; foreign selfie path rejected, own accepted; `photo_verified` still not updatable |
| service role | P0-A | can still set `photo_verified` |
| anon / owner / other | P0-A | anon can't list photos; users list only their own folder; owner upload OK; uploading into another folder blocked; nobody lists selfies; TRUNCATE denied |
| other | P0-A | old path still readable **(by design until P0-B)**; `profile_cards` shows visible and matched-hidden users (not unmatched-hidden), no private column, no sentinel value, computed age, correct `interested_in_viewer`; anon denied; wrappers return `age`, not DOB |
| other | P0-B | can't read private columns; `profiles` returns only the caller's row; cards still work; the original RPCs are denied and the wrappers work; can't update another user's row |
| owner | P0-B | reads own private fields; edits own profile |
| anon | P0-B | no table access |
| — | rollbacks | B rollback restores the previous read access; A rollback restores the INSERT grants and storage policies and drops the view |

**Mutation check:** running the harness with P0-A replaced by a no-op makes the corresponding checks fail. So the tests detect the fix; they do not pass vacuously.

**Not verified here:**
- PostgREST / Storage HTTP behaviour itself. The tests exercise the SQL layer the APIs sit on.
- The real bodies of `get_top_matches` / `get_my_likers`. They are only wrapped, not changed.
- The app screens. The R-P0 client changes are not written yet.

**Live checks after applying**, with only the owner's own test accounts:
- One account reads the other's private column → 0 rows or 401/permission denied.
- Anon storage list → empty.
- Home / Matches / Activity / Chats render.

## 7. Open decisions
1. Approve applying P0-A now (safe with the current app).
2. Timing of R-P0 + P0-B (must precede WP1 and any real sign-up).
3. Is `district` public? The app shows it; D49 did not approve public district display. The view keeps it for now.
4. Phase 2: private photo bucket + signed URLs — before closed beta or before public launch?
