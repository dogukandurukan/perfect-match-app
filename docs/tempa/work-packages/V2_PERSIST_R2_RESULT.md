# V2 integration — round 2 (result)

Date 2026-09-30 · Folder `~/tempa-p0` · Branch `tempa/v2-persist-r2` (from `tempa/v2-persist` `7ac1847`) · Author: Claude Code.
**Nothing applied to live; no merge.**

The separate test project **still does not exist**: `.env.test.local` is created but empty. So real Auth/DB/Storage runs are **pending**. Everything below ran on the local live-schema replica.

## 1. Done

| # | Item | Result |
|---|---|---|
| 1 | Folder / branch / commit verified; setup order defined | `docs/tempa/TEST_ENVIRONMENT.md`: base → P0-A + P1 → V2 → seed → P0 smoke → V2 e2e → phone (R-P0) → P0-B → re-check → orphan clean-up. One resumable command: `scripts/test-backend/setup.mjs`. The replica suite also checks V2 **after** P0-B |
| 2a | Photos picked but app closed before Continue | Live mode now **auto-saves photos** ~0.8 s after any change and immediately when the app goes to the background. A second change during a save triggers another pass. Registrations are recorded synchronously, so nothing uploads twice. Unsaved tiles show **"Not saved yet"**; a status line says "Saving photos… / All photos saved / … not stored". Honest limit: an app killed *during* an upload loses that one photo, and its tile said "Not saved yet" |
| 2b | Stored selfie on return | Shows **"Selfie received"** (check icon) + **Retake** instead of an empty frame |
| 2c | Old / orphaned files | `list_orphan_media_v2` (service role only; ≥ 1 h grace so in-flight uploads are safe) finds unreferenced objects in the private photo and selfie buckets. Removal goes through the **Storage API** (a SQL row delete would leave the file): `cleanup_orphans.mjs` (dry run by default) and a proposed scheduled function `cleanup-orphan-media`. Also fixed: **account deletion only cleaned the legacy `user-photos` bucket**; it now cleans all three, paged (code only, not deployed) |
| 3 | Request changes → edit → resubmit → accept | The reviewer's `request_changes` needs a note or items. Asking for a new selfie drops the stored one. The user is routed back to the flow at the first requested item, sees the note (alert + submit screen), edits and resubmits. Resubmission stays idempotent; accept → member. Every step is logged in `application_events_v2` (service only). Acceptance projects the minimum public card data (name, city, ordered photos, `setup_completed`) server-side |
| 4 | V2 discovery eligibility without scoring | `get_discovery_candidates_v2` enforces, mutually: accepted + verified + active; not hidden or deleted; no block either way; gender ∈ the other's interested-in (V2 keys); age inside the other's range (`profiles.discovery_age_min/max`, default 18–60); same city. It returns **no score**, in a **fixed order by id**. Tested with 9 synthetic members, one per rule |
| 5 | Real services | **Pending the test project.** `smoke_v2.mjs` now also covers the review loop and mutual A↔B discovery (incl. B's photo loading for A via a 15-minute signed URL, then a block) |

## 2. Tests (local)

| Suite | Result |
|---|---|
| `http_v2.test.mjs` (V2 + review loop + V2 eligibility + orphans + **after P0-B**) | **132 / 132** (3 consecutive runs) |
| `http_p0.test.mjs` | 325 / 325 |
| mapping · photo cache · backend selection | 21/21 · 14/14 · 14/14 |
| onboarding V2 checks (R2 unchanged) | 45/45 · 69/69 · 56/56 |
| `npx tsc --noEmit` | clean |

<details><summary>Per-check list (V2 suite)</summary>

<details><summary>ACCESS — 7/7</summary>

- ✅ anon cannot load a draft (permission denied)
- ✅ anon cannot submit (permission denied)
- ✅ new user → gate onboarding
- ✅ existing V1 member → legacy_member (kept)
- ✅ accepted+verified+active → member
- ✅ V1 member is never turned into a V2 applicant (legacy_account)
- ✅ no V2 state row created for the V1 member

</details>

<details><summary>SAVE+RESUME — 26/26</summary>

- ✅ first load creates an empty draft
- ✅ save basics step 1
- ✅ save basics step 2 (partial)
- ✅ reopen: earlier answers kept (partial saves merge)
- ✅ reopen: resume position = next unfinished step
- ✅ DB row holds the saved values
- ✅ resume position can cross into the next section
- ✅ the same save re-sent after a dropped connection is harmless (idempotent)
- ✅ rejected: bad enum
- ✅ rejected: everyone mixed with others
- ✅ rejected: under 18
- ✅ rejected: unknown field
- ✅ rejected: field of another section
- ✅ rejected: 3 values
- ✅ rejected: pet kind without pets
- ✅ rejected: 11 interests
- ✅ rejected: bad taste item
- ✅ rejected: 4 taste items
- ✅ rejected: 3 date types
- ✅ rejected: unknown section
- ✅ save basics
- ✅ save compatibility
- ✅ save yourLife
- ✅ save yourWorld
- ✅ save yourDates
- ✅ changing pets away from "have pets" clears the kind

</details>

<details><summary>DIRECT WRITES — 6/6</summary>

- ✅ no direct UPDATE of the draft
- ✅ no direct INSERT
- ✅ client cannot change application status
- ✅ client cannot activate membership
- ✅ client cannot call the reviewer RPC (permission denied)
- ✅ pending applicant cannot self-unlock the V1 Home gate (DB unchanged)

</details>

<details><summary>PHOTOS — 23/23</summary>

- ✅ failed upload: nothing registered (photo_not_uploaded)
- ✅ failed upload leaves 0 photos
- ✅ upload 1 into own folder
- ✅ register photo 1 at position 1
- ✅ upload 2 into own folder
- ✅ register photo 2 at position 2
- ✅ upload 3 into own folder
- ✅ register photo 3 at position 3
- ✅ upload 4 into own folder
- ✅ register photo 4 at position 4
- ✅ upload 5 into own folder
- ✅ register photo 5 at position 5
- ✅ upload 6 into own folder
- ✅ register photo 6 at position 6
- ✅ registering the same upload twice (retry) does not duplicate
- ✅ 7th photo refused (too_many_photos)
- ✅ cannot upload into another user's folder
- ✅ reorder (atomic, full list)
- ✅ DB order matches the new order
- ✅ partial reorder list refused (photo_set_mismatch)
- ✅ delete returns the object path for storage clean-up
- ✅ positions compacted after delete
- ✅ owner deletes the storage object

</details>

<details><summary>PROMPTS — 4/4</summary>

- ✅ unknown prompt id refused (foreign key)
- ✅ same prompt twice refused (duplicate key)
- ✅ 201-char answer refused (check constraint)
- ✅ prompts saved; blank optional third ignored

</details>

<details><summary>SELFIE — 5/5</summary>

- ✅ selfie not uploaded → refused (selfie_not_uploaded)
- ✅ selfie uploaded to the private bucket (own folder)
- ✅ selfie path recorded server-side
- ✅ even the owner cannot read the selfie back
- ✅ client sees "has selfie", never the path

</details>

<details><summary>OTHER ACCOUNT — 10/10</summary>

- ✅ U2 cannot read U1's onboarding_v2
- ✅ U2 cannot read U1's profile_photos_v2
- ✅ U2 cannot read U1's profile_prompts_v2
- ✅ U2 cannot read U1's account_state_v2
- ✅ U2 cannot reorder U1's photos (photo_set_mismatch)
- ✅ U2 cannot delete U1's photo (photo_not_found)
- ✅ U2 cannot register U1's upload (not_your_photo)
- ✅ U2 cannot claim U1's selfie (not_your_selfie)
- ✅ U2 cannot sign U1's photos (pending applicant is not visible)
- ✅ pending applicant has no public card

</details>

<details><summary>SUBMIT — 13/13</summary>

- ✅ submit with unconfirmed email → not submitted, "missing" returned
- ✅ DB: still draft after refused submit
- ✅ no KVKK consent → not submitted
- ✅ consent recorded by the user (allowed column)
- ✅ 5 rapid taps all report submitted
- ✅ exactly one of them performed the submission
- ✅ DB: one row, submitted / pending / not a member
- ✅ retry after reconnect returns the same submission
- ✅ answers locked after submission (application_locked)
- ✅ photos locked after submission (application_locked)
- ✅ gate after submit: waiting (no Home)
- ✅ pending applicant gets no discovery
- ✅ incomplete applicant cannot submit

</details>

<details><summary>REVIEW LOOP — 17/17</summary>

- ✅ client cannot review (permission denied)
- ✅ request changes needs a note or items
- ✅ DB: changes requested, selfie dropped, items stored
- ✅ gate: back to the V2 flow (no Home)
- ✅ the user sees the reviewer note and what to change
- ✅ another user cannot see the review note
- ✅ editing is allowed again
- ✅ new photo uploaded
- ✅ new photo made the main photo
- ✅ resubmit without the new selfie → not submitted
- ✅ new selfie stored
- ✅ resubmission: exactly one, even with rapid taps
- ✅ DB: submitted again, request cleared
- ✅ after acceptance: member
- ✅ audit trail: submitted → changes_requested → submitted → accepted
- ✅ acceptance projects the public card basics (server-side) in photo order
- ✅ V1 member discovery still works

</details>

<details><summary>V2 DISCOVERY (eligibility only) — 9/9</summary>

- ✅ U1 sees exactly the eligible members, fixed order (2)
- ✅ no score or ranking field is produced
- ✅ the other eligible member sees U1 too (mutual)
- ✅ order is stable between calls
- ✅ a pending applicant gets no candidates
- ✅ a V1 account is not part of V2 discovery
- ✅ anon cannot call it
- ✅ an eligible member can sign the accepted member's photos
- ✅ blocking removes the candidate at once

</details>

<details><summary>ORPHAN MEDIA — 5/5</summary>

- ✅ uploaded-but-never-registered photo is listed
- ✅ the replaced selfie is listed
- ✅ registered photos and the current selfie are never listed
- ✅ grace period cannot be set below 1 hour (in-flight uploads protected)
- ✅ clients cannot list orphans

</details>

<details><summary>AFTER P0-B — 6/6</summary>

- ✅ P0-B applied: own V2 bundle still loads
- ✅ P0-B applied: gate still member
- ✅ P0-B applied: V2 discovery still works
- ✅ P0-B applied: other people's profiles rows are private
- ✅ P0-B applied: an eligible V2 member's public card is readable
- ✅ P0-B applied: a draft applicant still loads and saves

</details>

<details><summary>SCHEMA — 1/1</summary>

- ✅ no key or live ref in the migration

</details>

</details>

## 3. Remaining

1. **Test project** — fill `~/tempa-p0/.env.test.local` (variable names in `TEST_ENVIRONMENT.md` §1) and set the Magic Link template to contain `{{ .Token }}`. Then:
   - I run `node scripts/test-backend/setup.mjs` (steps 1–6, evidence in `.test-backend/`);
   - you open the app with `~/tempa-p0/scripts/test-backend/start-app.sh` and follow `TEST_ENVIRONMENT.md` §4.
2. **Home for V2 members** still calls the V1 discovery wrapper, so an accepted V2 member sees an empty Home. V2 eligibility exists and is tested, but it is not wired into the Home UI (it needs the scoring/ranking decision; no score was invented).
3. Owner decisions unchanged: server height range (proposed 90–250 cm), intent partial credit, V2 weights, selfie retention, and consent placement (implemented on the email step).
4. The scheduled orphan clean-up and the delete-account change are code only (deploy is a live change).
