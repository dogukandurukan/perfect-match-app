# P0 privacy remediation — plan (PROPOSED, NOT APPLIED)

Revision 3 · 2026-09-30 · Branch `tempa/p0-privacy-r3` · Author: Claude Code.
Companion documents:
- `work-packages/P0_PRIVACY_RESULT.md` — test results and the live package.
- `P0_KEY_ROTATION_PLAN.md` — the service-role key in the push webhook.
- `P0_PHONE_TEST.md` — the phone test on the separate test project.

> ⚠️ **The risk is still live.** Nothing here has been applied to the live
> project. **P0-A alone is not privacy:** other signed-in users can read
> other users' private columns from `profiles` until **P0-B**.

| File (`supabase/proposed/`) | Purpose |
|---|---|
| `20260928130000_p0a_privacy_additive.sql` | P0-A — additive; the current app keeps working |
| `20260930090000_p1_private_photos.sql` | Private photo bucket + 15-min signed-URL access; applied with P0-A |
| `20260928130100_p0b_privacy_restrict.sql` | P0-B — own-row-only `profiles`; original RPCs closed |
| `20260930100000_db_webhooks_vault.sql` | Push webhook + reminder cron without any key in SQL (key plan) |
| `…p0a….rollback.sql`, `…p1….rollback.sql` | Exact reverts — **not** a default (§6) |
| `…p0b….emergency_reopen.sql` | Re-exposes private data; written owner decision only (§6) |
| `tests/` | Local replica + HTTP tests (§7) |

## 1. Findings (read-only on live, reproduced only on the local replica)

| # | Exposure | Closed by |
|---|---|---|
| 1 | Any signed-in user reads anyone's private `profiles` columns (surname, DOB, phone, address, lat/lng, district, push token, selfie path, preferences, account state) | P0-B |
| 2 | Hidden profiles readable through a self-created candidate `matches` row | P0-A + P0-B |
| 3 | Full DOB + district from `get_top_matches` / `get_my_likers`; premium likers list included people who blocked you or deleted their account | P0-A wrappers, P0-B revoke |
| 4 | Another user's surname shown in the app | R-P0 |
| 5 | Server-owned profile fields settable on first INSERT | P0-A |
| 6 | Self-set `setup_completed`; selfie path into another user's folder | P0-A (interim, V2 server state later) |
| 7 | Forged consent on `matches`: self-accept, open a chat with anyone, confirm your own meetup, write the other side's check-in | P0-A guard |
| 8 | Message content / notification text / like state / report target rewritable | P0-A |
| 9 | Anonymous listing of all profile photos | P0-A |
| 10 | Photos loadable by URL by anyone, predictable names | P1 private bucket (+ R-P0 random names) |
| 11 | anon INSERT/UPDATE/DELETE/TRUNCATE on every public table | P0-A |
| 12 | **Service-role JWT embedded in the push webhook trigger** | Key plan (separate doc) |
| 13 | `send-meetup-reminders` callable by anyone (verify_jwt off, no auth from cron) | Key plan |

## 2. Owner product decisions (2026-09-30) and their effects

| Decision | Implemented as | Effect on users | Tested |
|---|---|---|---|
| **"Looking for" only to people allowed to see the profile** | `profile_cards.intent`, joined from `onboarding_answers` (still own-row for direct reads) | Other people's "Looking for" appears again. It was silently blank before, because others could not read `onboarding_answers`. Hidden, blocked and deleted people show nothing | HTTP + smoke |
| **No district, no "Nearby", no "Near both of you"; handle `same_district`** | District absent from every client-facing surface. `get_discovery_cards` removes "Nearby". Venue RPC never reads the other person's district and labels only "Near you". District filters (`same_district`, `same_neighborhood`) are removed from the UI; stored values normalised to `whole_city` once; the profile guard coerces new writes | Cards show city only. Anyone who used "same district" now sees their whole city — **discovery gets wider for them**. No scoring change | HTTP (equal venue list for same- vs other-district person; stored + new filter values) |
| **Hidden = out of discovery; only accepted (mutual) matches keep access; pending invite / one-sided like give nothing; block and delete win** | `can_view_profile`: own OR (no block either way AND not deleted AND (discoverable OR accepted match)). Invite and like branches removed | A hidden person's pending invite or like becomes invisible to the recipient: no card, no photo, no Activity row, no Plans row, not counted in Liked-you. It reappears if they un-hide. Existing accepted chats keep working | HTTP + smoke |
| **Chat needs mutual consent for everyone** | Guard: an invite write never opens the chat; accepting (by the invitee) always opens it; mutual like unchanged. Client rule functions now gender-neutral | A woman's invite no longer opens the chat at once. A man accepting now opens it — before, it stayed closed and the invite hung. **Old app builds:** a woman's invite is accepted but the chat stays closed (no error) | HTTP + smoke |
| **After a block: no photos, no new access; unblock list minimal** | Blocked people are invisible in both directions, including to the blocker. `get_my_blocked_users()` returns block id + first name only. The client drops cached signed URLs for that person on block. Chats, Activity and Plans rows about invisible people are hidden | The unblock list shows an initial, not a photo. A chat with someone you blocked (or who blocked you) leaves the Chats list | HTTP + smoke |
| **Private photo bucket now, 15-min signed URLs** | P1 file + client signed-URL cache (re-signs when < 60 s are left) | Photos of people you may not see can't be signed. **Limit kept:** URLs already issued work until they expire; images already on the device stay until evicted | replica policies, cache unit test, smoke with the real Storage |

## 3. Visibility (access table, revision 3)

| Target, relative to the viewer | card / photos | discovery | Liked-you | Activity / Plans / Chats rows | `profiles` row after P0-B |
|---|---|---|---|---|---|
| Self | ✅ | – | – | – | ✅ full |
| Discoverable stranger | ✅ | ✅ | ✅ if they liked you | ✅ | ❌ |
| Incomplete onboarding | ❌ unless accepted | ❌ | ❌ | ❌ | ❌ |
| Hidden, no relation | ❌ | ❌ | ❌ | ❌ | ❌ |
| Hidden, bare candidate row | ❌ | ❌ | – | ❌ | ❌ |
| Hidden, **pending** invite (either way) | ❌ | ❌ | – | ❌ | ❌ |
| Hidden, one-sided like on you | ❌ | ❌ | ❌ (not counted) | ❌ | ❌ |
| Hidden, **accepted** match / mutual like | ✅ | ❌ | – | ✅ | ❌ |
| Old expired/passed match, target discoverable | ✅ as stranger | ❌ 14 / 42 days | – | – | ❌ |
| Old expired/passed match, target hidden | ❌ | ❌ | – | ❌ | ❌ |
| Deleted (`deleted_at`), even with a chat | ❌ | ❌ | ❌ | ❌ | ❌ |
| You blocked them | ❌ (unblock list: first name only) | ❌ | ❌ | ❌ | ❌ |
| They blocked you | ❌ | ❌ | ❌ | ❌ | ❌ |

**Remaining inference risks for district (reported, not redesigned this round):**
- `get_top_matches` still scores the same district higher (+20 vs +8 for the same city). Ranking and the shown percentage therefore carry a weak "probably near me" signal. Someone comparing many cards could guess who shares their district.
- `favorite_spots` ("my go-to spot") is public by design and often names a neighbourhood. Users choose what to write there.
- The server still stores district for scoring and venue ranking; only the viewer's own district is used in labels.

## 4. Photos

### 4.1 Access
- Bucket `profile-photos-private`: `public = false`, 10 MB, image types only.
- Upload and delete: own folder only. No UPDATE or move by clients.
- Reading (which `createSignedUrl(s)` requires) is allowed only when `can_view_profile_as_me(owner folder)`, so hidden, blocked and deleted people's photos can't be signed.
- Client: `lib/resolveProfilePhotoUrl.ts` + `lib/photoUrlCache.ts`.
  - 15-minute URLs, batch signing, re-sign when < 60 s are left.
  - Refusals are not cached; entries for a blocked person are forgotten.
  - New uploads get random names.

### 4.2 What cannot be promised
- A signed URL is a bearer token until it expires (≤ 15 min after issue). It can't be revoked earlier except by deleting or moving the object.
- Images already downloaded stay in the device cache until evicted.
- Promise: **no new access after a block, hide or delete; existing access ends within 15 minutes (device cache aside).**
- Screens re-sign on focus. An image that first loads more than 15 minutes after its screen was built fails until the screen is refocused.

### 4.3 Moving existing objects — resumable, not atomic
Storage copy/delete and the DB update are **separate systems; no step is
assumed atomic with another**. Each phase is idempotent and records progress
in `ops.photo_migration` (service role only). After any failure, re-run the
same phase.

1. **Prepare:** apply P1 (bucket + policies + bookkeeping table). Old objects stay where they are; old clients keep working.
2. **Plan rows:** for every path in `profiles.photos` without a row, insert `(old_bucket, old_path, owner_id, new_path = {owner}/{random}.{ext})`. The new name is fixed before any copy, so a retry reuses it.
3. **Copy:** for rows with `copied_at is null`, download the old object and upload it to `new_path` with overwrite (safe to repeat), then set `copied_at`. A crash between upload and `copied_at` only causes a repeat upload.
4. **Switch references**, one DB transaction per user: replace each `old_path` in `profiles.photos` with `new_path`, only for rows with `copied_at` set; set `db_updated_at`. Re-running is a no-op.
5. **Verify:** every `profiles.photos` entry exists in the private bucket and no profile still references an old path. If not, go back to step 3 or 4.
6. **Release the R-P0 client**, which reads the private bucket only. Photos not yet switched show an initial, never an error.
7. **Delete the old objects** (rows with `old_deleted_at is null`), only after the old client is no longer supported. Set `old_deleted_at`. Then delete the empty public buckets `user-photos` and `profile-photos`.

Live has **0** photo objects today, so steps 2–5 are empty now. They become
real work with every upload before this ships.

## 5. Order (live — for review after the phone test)

0. Key plan steps 1–5 (webhook secret in Vault; functions verify it). Step 6, revoking the leaked key, follows the app release that uses the publishable key.
1. Re-snapshot the live catalog; diff against `tests/live_snapshot_2026-09-29.json`.
2. **P0-A + P1** (one maintenance window). Verify with your own test accounts.
3. Photo migration phases 2–5 (empty today).
4. **R-P0 client** on every installed build (forced minimum version once in production).
5. **P0-B.** Verify.
6. Photo migration phase 7 (delete old public buckets).

## 6. Recovery — fix-forward, never reopen by default

**Rule:** a security guard is never dropped to "unblock" a flow. That would
reopen the hole for everyone. Instead:

1. **Pause the affected action**, not the protection. Leave it failing, or hide the button with a client flag or hotfix. Users see "could not save", but no data is exposed and no consent is forged.
2. **Correct the guard in place** with `CREATE OR REPLACE FUNCTION public.guard_…()`, keeping every other rule. The trigger stays attached throughout, so there is no window without the check.
3. **Re-run** the local suite plus the smoke test on the test project, then apply.

| Symptom | Action | Exposure while fixing |
|---|---|---|
| A legitimate match / meetup / check-in write is rejected | pause that action; `create or replace function public.guard_match_client_writes()` with the fix | none |
| A like is rejected | same with `guard_like_client_writes` | none |
| Onboarding completion rejected wrongly | same with `guard_profile_client_writes` (users stay on the last step) | none |
| A screen breaks after P0-B | client hotfix (read `profile_cards` / RPCs) or disable that screen | none |
| Photos don't load after P1 | fix the policy or helper in place (`create or replace`); display falls back to initials | none |
| Owner decides in writing to accept re-exposure | `…p0b….emergency_reopen.sql`, then re-apply P0-B after the hotfix | #1–#3 reopen |
| Owner decides to remove P0-A entirely (P0-B not applied) | `…p0a….rollback.sql` (verified exact) | all P0-A holes reopen |

## 7. Verification

See the result report. Summary:
- **Local suite, 325/325** on PGlite plus PostgREST with the real function bodies and grants. Stages: LIVE exposure reproduced → P0-A (+P1) → P0-B → exact revert → test-project SQL loads cleanly → Vault webhook.
- **Mutation run:** without the proposed files, 136 checks fail.
- Unit checks: signed-URL cache 14/14; backend selection 14/14.
- The real Auth, Storage and Realtime run on the separate test project (`smoke.mjs`) once it exists. Then the phone test follows.

## 8. Open items
- WP2: replace the `matches` trigger guard with SECURITY DEFINER RPCs; move `setup_completed` to server-controlled review state.
- Pre-existing, unchanged: re-liking after a match resets the like to `sent`; "Leaked password protection" is still off.
- The Map people layer and the Vibe district strip stay disabled. A k-anonymous server aggregate would be needed to bring the map back.
