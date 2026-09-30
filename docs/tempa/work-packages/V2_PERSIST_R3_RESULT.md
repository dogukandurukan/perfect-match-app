# V2 integration — round 3 (result)

Date 2026-09-30 · Folder `~/tempa-p0` · Branch `tempa/v2-persist-r2` (continued from `6e91e48`) · Author: Claude Code.
**Nothing applied to live; no key or bucket change; no merge.** The accepted UI is kept: the DEV preview behaves as before (R2 checks 56/56).

## 1. Test environment (priority 1)

| Check | Result |
|---|---|
| Branch / commit / work tree | `tempa/v2-persist-r2` at `6e91e48`, clean, same as origin; nothing half-done |
| `.env.test.local` | exists (mode 600) but **all four variables are empty** |
| Tempa test project | **does not exist.** The account has only `perfect-match-dev` (live) and `ai-hq` (not Tempa) |
| Safety | the scripts **and** the app now also refuse AI HQ's project; `setup.mjs` requires the target's name to contain "tempa" (or an explicit confirmation flag) |
| Real Auth/DB/Storage tests | **not run** — no test project |

Why the phone showed no TEST badge and "Demo check only / Preview only":
- That was the **DEV preview** (R2 worktree / local-only flow). It never talks to a backend, and it is not the live V2 flow.
- The live V2 flow (email code, saves, uploads, application) exists only on this branch. It opens only through `scripts/test-backend/start-app.sh`, which sets the TEST backend and shows the green `TEST · <ref>` badge.

## 2. V2 Home (priority 2)

- On the **TEST backend only**, an **active V2 member's** Home is fed by `get_discovery_candidates_v2`:
    - mutual eligibility, fixed order by id;
    - **no score or percentage**: the badge hides without a score, and "Why you match" hides without reasons.
- V1 accounts and the live backend keep the existing feed.
- Local verification (replica, real PostgREST + storage policies):
    - two accepted, mutually eligible V2 members see each other and can sign each other's photos (15-minute URLs);
    - after a block, in both directions: no candidate, no card, no photo signing, no like.
- `smoke_v2.mjs` repeats this against the real services once the test project exists.
- Home shows name, age, city and photos. Other V2 answers are not projected yet (WP3).

## 3. Edit profile panel (priority 3)

- The long system menu is replaced by an **opaque ivory bottom sheet**. Each row has:
    - a dark-green line icon;
    - a short title: Photos, Prompts, Basics, Looking for, Lifestyle, Your world, First dates;
    - a small description from the **real draft** (photo and answer counts, chosen intent, values, lifestyle answered / 4, job + interests, date types + days/time);
    - a right chevron.
- Scrolls on small screens; closes on backdrop, the ✕ button or system back.
- Returning with "Back to preview" **restores the preview's scroll position**.
- Locks: after a live submission "Edit profile" stays hidden; the server rejects edits (`application_locked`); a "changes requested" state re-opens editing.

## 4. Tests

| Suite | Result |
|---|---|
| `http_v2.test.mjs` (V2 + review loop + V2 eligibility incl. photos and after-block + orphans + after P0-B) | **137 / 137** (2 runs) |
| `http_p0.test.mjs` | 325 / 325 |
| backend selection (now also refuses AI HQ) · photo cache · V2 mapping | 15/15 · 14/14 · 21/21 |
| onboarding V2 (R2 unchanged) | 45/45 · 69/69 · 56/56 |
| `npx tsc --noEmit` | clean |
| **Real services** | **pending (no test project)** |

## 5. Remaining

1. **Create the Tempa test project and fill `~/tempa-p0/.env.test.local`**, and add `{{ .Token }}` to its Magic Link template (`TEST_ENVIRONMENT.md` §0–§1). Then I run `node scripts/test-backend/setup.mjs`, and we test on the phone.
2. V2 member cards show only name, age, city and photos until the WP3 public projection.
3. Open decisions are unchanged: server height range, intent partial credit, V2 weights, selfie retention.
