# Tempa — technical handoff for the next Claude session (2026-10-25 → 2026-10-26)

Author: Claude Code, end of 2026-10-25. Details live in the result documents linked below; this file only points to them and records the state at handoff. If anything here disagrees with a result document, the result document and the code win — check, don't assume.

## 1. Repository state (checked 2026-10-25)

- Repo `~/tempa-p0`, branch `tempa/v2-persist-r2`, HEAD = `origin/tempa/v2-persist-r2` (the handoff commit on top of `0dee292`).
- Working tree: only the owner's untracked `.codex/` and `AGENTS.md` — **not ours; never commit, move or delete them.**
- **Not merged, not deployed.** Nothing here is release-ready or merge-safe; no SHA has been agreed for merge.

| Commit | What |
|---|---|
| `c572da5` | Profile visits (D103) |
| `d8e09ad` | Visits notice: inline "Got it" (D103) |
| `1340b81` → `d75ecdd` | D104 first draft → D104a two questions (version 2) |
| `f7246af` | **D104b "What you're looking for", version 3** (intention, priorities, connection style, summary) |
| `0dee292` | D104b UI fixes (see §3) |

## 2. Backends

- **Use only tempa-local:** API `127.0.0.1:55421`, DB `55422`, mail `55424` (project `tempa-local`, Docker). Never the shared project `fyqwjduzpnjuxqsloxih`, terapi, the branding worktree (`~/tempa-collab-prep`), `~/tempa-p06` or `~/dating-app-recovered`.
- **Local migrations applied** (psql, one transaction each, listed in `scripts/local-backend/setup.mjs`, `setup.mjs` NOT run): `…027` connection answers, `…028` versions (PK `user_id, version`), `…029` version 3 + `v2_missing_for` intent alternative. Backups: `~/tempa-backups/2026-10-22-before-connection-answers/`, `2026-10-23-before-connection-versions/`, `2026-10-25-before-connection-v3/` (each: `pg_dump -Fc` + data fingerprint, before = after).
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

### Profile visits (D103) — `docs/tempa/work-packages/V2_PROFILE_VISITS_RESULT.md`

- **Phone, owner, at `c572da5` (the OLD alert notice):**
  - Pars opened Hale's profile from Activity;
  - the notice appeared on the first open and not after OK;
  - Hale saw 2 visitors: Pars (real) and Vedat (synthetic smoke row).
- **The new inline "Got it" notice (`d8e09ad`): local tests only** (`v2_profile_visits` 37/37, `smoke_visit_notice_local.mjs` 8/8) — **not seen on a phone.** Pars has already acknowledged, so seeing it needs a visitor who hasn't.
- **Still open on the phone:** exact labels, badge unaffected, a real 24 h revisit, no record before acknowledgement, backing out without acknowledging.
- **Premium visitor identities: a PROPOSAL, not approved** (D103).

## 4. Open bugs, technical debt, product decisions

- 🔴 **Old public intent vs new private intention can contradict.** Example, Nehir: public `onboarding_v2.intent = long_term` ("Looking for" on the profile), private version-3 intention `one_night`. No mapping either way; which one is shown or used is an open product decision.
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

## 6. Tomorrow (2026-10-26): general profile editing — inspection first, no code

**Scope:** read the code and DB, then present findings and options to the owner. **No product decisions, no implementation** until the owner decides.

1. **Fields:** list every profile field and where it is edited today.
   - D90 (approved): members may edit only interests, activities, books, screen, artists and the conversation starter; everything else is locked and `v2_assert_editable` is not relaxed.
   - `app/v2/edit-interests.tsx`, `app/v2/edit-photos.tsx` (reorder + main photo only, D90 exception), `components/main/V2ProfileHome.tsx`, `app/v2/profile.tsx`.
   - Mark which edits would need verification or a new review (photos, name, birthday, gender, selfie).
2. **Intent:** how the old public intent and the new private intention should be handled in editing (connects to the 🔴 decision above).
3. **Behaviour:** save / cancel (unsaved changes), error and retry, persistence after reopen.
   - Reuse the D91 consistency rules and the edit-photos conflict pattern (save sends the loaded order; a newer change → Reload).
4. **Photos:** what adding / deleting / replacing would need; keep the existing order and main-photo behaviour (`V2_MEMBER_PHOTO_ORDER_RESULT.md`).
   - Today members cannot add, delete or replace photos.

**Limits (unchanged):**
- tempa-local only;
- no merge, no deploy, no DB reset, no mass delete;
- don't run `setup.mjs`;
- synthetic accounts only;
- no secrets in output;
- don't call anything phone-verified before the owner says so.
