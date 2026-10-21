# V2 Profile — member photo order (result)

Date 2026-10-21 · Folder `~/tempa-p0` · Branch `tempa/v2-persist-r2`, from `57535a1` · Author: Claude Code.
**Decision:** D102 (owner, 2026-10-21), a narrow exception to D90.
**Target:** tempa-local only. Shared DEV / live, other local projects and the branding worktree not touched; no reset, delete, merge or deploy.

## Behaviour

**Profile tab → Photos** (`app/v2/edit-photos.tsx`, a new outline button above "Your interests"):
- Photos appear in their saved order. The first one is marked **Main photo**.
- Controls: **Make main photo**, plus up / down arrows (44 pt, labelled "Move photo n up / down"). No drag-and-drop.
- Changes are a **local draft**; **Save** stores them. Leaving with unsaved changes asks "Discard changes?".
- Save sends one request at a time (button disabled while saving).
- On failure the edited order stays for a retry. If the photos changed elsewhere, the message offers **Reload**.
- After saving, the Profile tab main photo reloads on focus, and **View profile** (`get_profile_v2`, ordered by position) shows the new order.
- Adding, removing or replacing photos is **not** offered ("isn't available after approval yet").

## Server — `supabase/proposed/20261021090000_v2_member_photo_order.sql` (LOCAL)

`reorder_member_photos_v2(p_ids uuid[], p_expected uuid[])`, SECURITY DEFINER, authenticated only:
- **Caller:** an **active approved member** (`v2_assert_member_profile_edit`). Drafts, pending, rejected, suspended and signed-out callers are refused.
- **Atomic:** the caller's `account_state_v2` row is locked; all positions change in one statement (the deferrable `(user_id, position)` unique constraint).
- **`p_expected` ≠ current server order** → `photos_changed`, nothing written.
- **`p_ids` must be exactly the caller's current set:** missing, extra, duplicate, foreign or empty → `photo_set_mismatch`.
- **Only `position` changes:** no insert, delete, path or review change. Photo ids stay, so a like's `target_key` (photo id) keeps its target.
- **The `profiles.photos` copy** (set at acceptance, read by older screens such as the chat header) is rewritten in the new order in the same transaction.

**Unchanged:** `v2_assert_editable`, `reorder_profile_photos_v2` (applicant path) and every other D90 lock.

**Applied to tempa-local in one transaction:**
- Backup first: `~/tempa-backups/2026-10-21-before-member-photo-order/`, `pg_dump -Fc`, read by `pg_restore --list` (74 table-data entries).
- Fingerprint of photo order, `profiles.photos` and like targets: **identical** before and after.
- Recorded as local migration `00000000000025`; in `setup.mjs`; **not** in `apply-dev.mjs`.

## Tests

`node scripts/local-backend/smoke_member_photos_local.mjs` — **22/22**, on real local services, fresh synthetic M (member, 3 photos), L (likes M's 2nd photo), O (another member), D (draft applicant).
- **Reorder:** p3 → main.
  - Positions follow, with no photo added, removed or changed.
  - L sees the new order in View profile.
  - The `profiles.photos` copy follows.
  - A fresh session reads the saved order.
- **The like still targets p2** (by id, now in position 3); the Activity context still shows that photo.
- **Refused:**
  - a stale expected order → `photos_changed`;
  - missing / extra / duplicate / foreign (O's photo) / empty sets → `photo_set_mismatch`; the order is unchanged after all refusals.
- **Other callers:**
  - Another member can't reorder M's photos; M and O are unchanged.
  - A draft applicant is refused (`not_member`), and **its own application reorder still works**.
  - The member's application path stays `application_locked`.
  - Signed-out → refused.
- **Two concurrent saves from the same order:** one applied, the other `photos_changed`.

**Other checks:**
- `v2_member_photos` **19/19**: helpers, error mapping, screen wiring (single request, keeps the draft on failure, discard prompt, labels, no upload / delete), Profile entry, SQL shape, LOCAL-only wiring.
- `run.js` all pass, including P07 profile / photos checks; `p0-checks` all pass; `tsc` clean; LOCAL iOS export exit 0.

**Synthetic data:** 2 smoke runs → 8 accounts (`tempa-local-mphoto-*`), their photos, 2 likes. Mert / Defne untouched.

## Not verified / open

- **The screen on a phone** (below).
- **Out of scope:** adding / replacing / deleting photos (they need re-review and minimum-count decisions); other profile fields.
- **Not on the shared / live project:** the package exists only on tempa-local, like the other packages since 20261009.

## Phone check (pending)

**Account:** `tempa-local-mphoto-mvik8slv-m@tempa-test.example.com` (approved member, 3 photos). `scripts/local-backend/start-app.sh <that email>` prints the code. Reopen the app, sign out if needed, then "DEV · Test account sign-in".

1. Profile → **Photos**. Three photos in order, the first marked **Main photo**. Use **Make main photo** on another one, then try going back: a "Discard changes?" prompt appears. Choose Keep editing.
2. **Save** → "Saved". Go back: the Profile photo is the new main photo, and **View profile** shows the new order.
3. Close and reopen the app: the order is kept.
