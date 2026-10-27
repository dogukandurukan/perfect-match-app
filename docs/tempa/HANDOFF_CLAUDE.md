# Tempa — technical handoff for the next Claude session (updated 2026-10-27)

Author: Claude Code, 2026-10-25; updated 2026-10-27 (Edit profile, Package 1). Details live in the result documents linked below; this file only points to them and records the state at handoff. If anything here disagrees with a result document, the result document and the code win — check, don't assume.

## 1. Repository state (checked 2026-10-27)

- Repo `~/tempa-p0`, branch `tempa/v2-persist-r2`. `origin` is at `f9200c1`; the D105 (Package 1) and D106 (profile layout + Recently) commits are **local commits, not pushed** (owner's instruction) — check `git log origin/tempa/v2-persist-r2..HEAD`.
- Working tree: only the owner's untracked `.codex/` and `AGENTS.md` — **not ours; never commit, move or delete them.**
- **Not merged, not deployed.** Nothing here is release-ready or merge-safe; no SHA has been agreed for merge.

| Commit | What |
|---|---|
| `c572da5` | Profile visits (D103) |
| `d8e09ad` | Visits notice: inline "Got it" (D103) |
| `1340b81` → `d75ecdd` | D104 first draft → D104a two questions (version 2) |
| `f7246af` | **D104b "What you're looking for", version 3** (intention, priorities, connection style, summary) |
| `0dee292` | D104b UI fixes (see §3) |
| `f9200c1` | handoff docs (pushed) |
| `81ea900` (local, not pushed) | **D105 Edit profile, Package 1** (see §3) |
| local, not pushed | **D106 My Profile / Edit profile layout + Recently** (see §3) |

## 2. Backends

- **Use only tempa-local:** API `127.0.0.1:55421`, DB `55422`, mail `55424` (project `tempa-local`, Docker). Never the shared project `fyqwjduzpnjuxqsloxih`, terapi, the branding worktree (`~/tempa-collab-prep`), `~/tempa-p06` or `~/dating-app-recovered`.
- **Local migrations applied** (psql, one transaction each, listed in `scripts/local-backend/setup.mjs`, `setup.mjs` NOT run): `…027` connection answers, `…028` versions (PK `user_id, version`), `…029` version 3 + `v2_missing_for` intent alternative, `…030` `update_member_profile_v2` (D105), `…031` `profile_recently_v2` + `get_profile_v2.recently` (D106). Backups: `~/tempa-backups/2026-10-22-before-connection-answers/`, `2026-10-23-before-connection-versions/`, `2026-10-25-before-connection-v3/`, `2026-10-27-before-member-profile-edit/`, `2026-10-27-before-profile-recently/` (each: `pg_dump -Fc` + data fingerprint, before = after).
- **Shared DEV/production: current real state NOT verified.** Last reported (memory, 2026-09-30): V2+P0 packages applied to the DEV target; the D103/D104 packages are LOCAL only and not in `apply-dev.mjs`. Whether a push to `main` triggers anything (Supabase GitHub integration, EAS, other automation) is **not verified**; this worktree has no `.github/workflows`. Don't push to `main`.

## 3. Done, with how it was verified

**Local tests ≠ phone results.** "Phone" below means the owner confirmed it on the phone.

### D104b "What you're looking for" (version 3) — `docs/tempa/work-packages/V2_CONNECTION_QUESTIONS_RESULT.md`, DECISIONS D104b

Flow inside the live first-submit screen (draft only): invite → intention → priorities → connection style → summary → submit screen. Version-1/2 answers are kept and never converted.

- **Implemented, local tests:** `v2_connection_questions` 76/76; `smoke_connection_answers_local.mjs` 40/40 on real local services; all 22 `run.js` suites; `p0-checks` 28·12·14·21; `tsc` clean; local iOS `expo export` exit 0.
- **UI fixes in `0dee292`:**
  - selected shared-interest chips have white text and a white remove icon;
  - each priority option and its Preference / Must-have are one group, with the option text no longer repeated;
  - a disabled Continue explains "Choose at least one detail for {Topic}. Show" and scrolls to that card;
  - the summary heading reads "What matters to you in a partner".
- **Bottom space (also `0dee292`):** the footer was already outside the scroll area; the priorities screen got 16 pt more.
- **Phone, owner, 2026-10-25 (Nehir):**
  - design approved;
  - answered the questions and reached the summary;
  - main intention, extra intentions and connection choices showed in the summary;
  - one priority showed as **Must-have**;
  - after Continue to application and a full close / reopen, **View** showed the same summary.
- **Server state matches (read-only, 2026-10-25):** version 3 = `intent one_night`, `intent_also casual, see_where`, `priorities money.independent must_have`, `connection regular_contact, open_talk`.
- **NOT phone-tested:**
  - every selection-limit case;
  - clearing an answer and it staying cleared after reopen;
  - the required-intention path (an account without the old intent);
  - save failure / retry;
  - submitting an application with version-3 answers.
- **Version 2 (two questions), phone, owner:** answering, a one-line summary, and persistence after close / reopen were confirmed (recorded for version 2 only).

### Edit profile, Package 1 (D105) — `docs/tempa/work-packages/V2_MEMBER_PROFILE_EDIT_RESULT.md`

- **What members can change:** Profile → Edit profile — Looking for (public, old three options, optional, never derived from private answers), height, work status (job title kept), lifestyle (pet kind rule) and first-date types / days / time.
- **How it works:**
  - narrow `update_member_profile_v2` (allow-list, merged-value validation, field-level conflict check, atomic);
  - the general onboarding lock is unchanged;
  - the list shows real Public / Private visibility and "This detail can’t be changed yet" for locked rows;
  - Photos / Interests shortcuts moved into Edit profile.
- **Local tests:**
  - `smoke_member_profile_edit_local.mjs` 42/42 on real local services;
  - `v2_member_profile_edit` 35/35 (logic + static wiring, not UI behaviour);
  - `run.js` 23 suites; `p0-checks`; `smoke_takes_local` 25/25; `smoke_shared_local` 13/13;
  - `tsc` clean; iOS export exit 0.
- **Not phone-tested:** every tap, the Discard / Reload prompts, the height ruler, the pet-kind row, the layout.

### Profile layout + Recently (D106) — `docs/tempa/work-packages/V2_PROFILE_RECENTLY_RESULT.md`

- **My Profile:** compact photo / name, age / city, Recently (own edit), Edit profile + Preview (shared public view, no like / comment).
- **Edit profile:** Photos / Answers / Details tabs scroll to their part; the D105 details are unchanged; no photo add / remove button; prompts shown locked.
- **Recently:**
  - optional book / song, shown under the name on every profile view (`RecentlyRows`); empty → hidden for others;
  - the song link opens outside the app only with an https music-service link;
  - `save_my_recently_v2` is member-only, own row, with limits and a version conflict check.
- **Local tests:**
  - `smoke_profile_recently_local.mjs` 37/37; `v2_profile_recently` 32/32;
  - `run.js` 24 suites; profile-related smokes pass;
  - `tsc` clean; iOS export exit 0.
- **No screenshots** (no simulator / react-native-web here). **Not phone-tested.**

### Profile visits (D103) — `docs/tempa/work-packages/V2_PROFILE_VISITS_RESULT.md`

- **Phone, owner, at `c572da5` (the OLD alert notice):**
  - Pars opened Hale's profile from Activity;
  - the notice appeared on the first open and not after OK;
  - Hale saw 2 visitors: Pars (real) and Vedat (synthetic smoke row).
- **The new inline "Got it" notice (`d8e09ad`): local tests only** (`v2_profile_visits` 37/37, `smoke_visit_notice_local.mjs` 8/8) — **not seen on a phone.** Pars has already acknowledged, so seeing it needs a visitor who hasn't.
- **Still open on the phone:** exact labels, badge unaffected, a real 24 h revisit, no record before acknowledgement, backing out without acknowledging.
- **Premium visitor identities: a PROPOSAL, not approved** (D103).

## 4. Open bugs, technical debt, product decisions

- ✅ **Decided 2026-10-27 (D105):** "Looking for" (old field) stays public and is edited separately; the private version-3 intention stays private and is never copied to it. They may still differ (Nehir: `long_term` vs `one_night`) — by design now.
- 🔴 **Still open:** where a NEW account without an old intent chooses "Looking for" during onboarding (proposed: an optional card at the profile-preview step — not built); whether the public options grow beyond three.
- 🔴 **Matching use of the new preferences:** private and **not used for matching** today (V2 matching uses no intent at all).
  - Missing other-person data and open decisions are listed in the D104b result document.
  - Before any matching use: tell users and ask them to re-confirm their preferences.
- 🔴 **Must-have semantics** (hard filter vs ranking), missing data = unknown (never fake fit), whether extras widen matching, whether the new intention becomes visible.
- 🟡 **Edge cases:**
  - Section turned off while a draft has only a version-3 intention → the old Compatibility intent step reappears and the client requires it again (the server already counts the draft as complete).
  - A "changes requested" applicant with only a version-3 intention keeps the old step hidden; they were not tested on a phone.
- 🟡 **Local accounts accumulate** (≈316 synthetic). `review.mjs list` needed id chunking (fixed in `f7246af`). More smoke runs keep adding accounts.
- 🟡 `.test-backend/connection.json` still names `…mvk0pgkx-p` (submitted) — stale; use the accounts in §5.
- 🟡 393×852 layout not checked visually on every screen; text wraps and scrolls by design.

## 5. Test accounts (tempa-local, synthetic)

Status checked read-only on 2026-10-25 unless marked "last reported".

| Account | State |
|---|---|
| `tempa-local-connv2-phone-45094@tempa-test.example.com` (Nehir) | **draft**; old intent `long_term`; version 1, 2, 3 answers saved; the D104 phone account |
| `tempa-local-connect-mvk0pgkx-a@tempa-test.example.com` | submitted (2026-10-23) — no questions any more |
| `tempa-local-connect-mvk0pgkx-p@tempa-test.example.com` | submitted |
| `tempa-local-visit-mvk0i5kw-p@…` (Pars) | accepted member, visits notice acknowledged |
| `tempa-local-visit-mvk0i5kw-h@…` (Hale) | accepted member, not acknowledged |
| `tempa-local-mphoto-mvik8slv-m@tempa-test.example.com` | accepted member (photo-order phone account); **the D105 / D106 phone account** (no Recently saved yet) — checked 2026-10-27: Looking for long_term, 170 cm, full-time + job title, like_no_pets, coffee + walk, weekends, daytime |
| Phone accounts Mert `3d1525b2-…`, Defne `e40b19ac-…`, match `f19c1951-…` | **never touch their data** |

**Start:**

```
cd ~/tempa-p0 && scripts/local-backend/start-app.sh <synthetic email>
```

It prints a fresh one-time code (also in git-ignored `.test-backend/local-phone-code.txt`). Never write codes, keys or tokens to output or Git.

**Switching account:**
1. Ctrl+C Metro and start with the new email.
2. On the phone, sign out (status screen: **Sign out**) and fully close and reopen the app.
3. Sign in via **DEV · Test account sign-in**; the email field shows the account Metro was started with.

**Restarting Metro does NOT change who is signed in on the phone.** `login-code.mjs` only creates a code.

## 6. Next

1. Owner's phone test of D105 and D106 (steps in the result documents). Don't call either verified before the owner reports.
2. Push only when the owner asks.
3. Later packages, each only after a decision:
   - free text (job title, favorite spot, prompts, school, hometown) and values — moderation / re-review;
   - private preferences for approved members (a member-only operation; nothing to the public profile);
   - photo add / delete / replace — re-review, minimum 3, likes targeting a photo id, storage clean-up, `profiles.photos` copy;
   - identity and matching fields (name, birthday, gender, interested in, city) — re-review / support path, `profiles` copies;
   - the onboarding "Looking for" card for new accounts.

**Limits (unchanged):**
- tempa-local only;
- no merge, no deploy, no DB reset, no mass delete;
- don't run `setup.mjs`;
- synthetic accounts only;
- no secrets in output;
- don't call anything phone-verified before the owner says so.
