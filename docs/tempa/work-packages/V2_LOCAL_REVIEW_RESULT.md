# Local application review tool (tempa-local) — result

## Owner's phone result — 17 October 2026 (verified by the owner, LOCAL)
Account `tempa-onb-phone-1@tempa-test.example.com`:
- Approved with this local review tool → **accepted / verified / active**.
- After sign-in with the email code the **main app opened**.
- After fully closing and reopening the app it went straight in, with **no new code and no application screen**.
- On the **own profile**: the photos, the standard answers and the **Running ("Kosmak") conversation starter** are shown.

Recorded for this scope only. Still **open** (not verified):
- D93's one-standard + one-starter path;
- the chat keyboard look (`38b3fa2`);
- the old Mert message on Defne's side;
- the intermittent Realtime timeout;
- "Both into this" on a phone.


Date 2026-10-15 · Branch `tempa/v2-persist-r2` · Author: Claude Code.

**Status:**
- Built and verified on real local services.
- **No decision was taken on the owner's accounts.** `tempa-onb-phone-1` is still `submitted`, and `tempa-onb-draft-1` is still `draft`; both were checked unchanged.
- No admin panel.
- Server rules unchanged: decisions only through the existing `review_application_v2`.
- Nothing remote touched; the shared DEV script `scripts/dev-backend/review.mjs` was not run.
- The open **D93 phone test** (one standard answer + one conversation starter) is **not** completed by this work.

## Tool — `scripts/local-backend/review.mjs`
| Command | What it does |
|---|---|
| `list` | All synthetic local applications, waiting ones first: status, verification / membership, first name, address. |
| `show --email=…` | **Read-only.** The terminal shows the state, missing items and counts of standard answers, conversation starters, photos and selfie. It also writes a review page `~/tempa-review/<account>-<time>.html`: the profile facts, standard answers with their prompt, starters with their question, the photos, the private selfie and the history. |
| `accept --email=…` | Shows the target, current state, decision and effect. **With `--yes`** it calls `review_application_v2(accept)` → accepted / verified / active. |
| `changes --email=… --note="…" --items=a,b` | Same, with `request_changes`. Items are checked against the server's list. A note or items are required. **`yourProfile.selfie` prints a WARNING that the current selfie is deleted** before anything happens. |
| `reject --email=… [--note=…]` | Same, with `reject`. |

**Rules:**
- **Without `--yes` nothing changes** (dry run).
- Only `submitted` applications can be reviewed (the server rule); draft or already-reviewed ones are refused with nothing changed.
- **Guards:**
  - it uses `_local.mjs`: only `http://127.0.0.1:55421` with local keys; a hosted project or another local project is refused before any request;
  - only `@tempa-test.example.com` accounts.
- **Review page:**
  - the folder `~/tempa-review` (outside the repo) is mode 700, the file 600;
  - images are signed links valid **10 minutes** (run `show` again for new ones);
  - **no service or anon key** in the file or the terminal; the only tokens in the file are the signed links' own short-lived ones.
- **`_local.mjs`:** gains a test-only `TEMPA_LOCAL_ENV_FILE` (same refusals apply), used to prove the non-local refusals.

## How the member continues (unchanged app)
After a decision the member taps **Refresh** on the status screen or reopens the app:
- **accept** → into the app;
- **changes** → onboarding opens at the first requested item with the note, then "Submit again";
- **reject** → the status screen with the rejection text.

No notification is sent.

## Checks
**`scripts/local-backend/smoke_review_local.mjs` (real local services, fresh synthetic applicants): 17 / 17, 2 runs.**
- `list`: submitted and draft applications are shown, with no keys.
- `show`:
  - state, missing items and counts;
  - the file is outside the repo, mode 600 in a 700 folder;
  - 3 photos + the selfie as local signed links, and one really loads;
  - prompt labels are shown;
  - no keys; **nothing changed**.
- **accept:** the dry run changes nothing; `--yes` gives accepted / verified / active and the access gate becomes `member`; a second review is refused.
- **changes with the selfie:** the WARNING is shown first; an unknown item, or no note / items, is refused; `--yes` gives `changes_requested`, removes the selfie, stores the items and note, and the access gate becomes `onboarding`.
- **reject:** `--yes` gives `rejected`, and the access gate is `waiting`.
- **Draft:** refused and unchanged; `show` says it can't be reviewed.
- Refused: a non-synthetic address, a hosted URL, and the other local project (54321).
- **The owner's phone-1 and draft-1 applications are unchanged.**

Also:
- `local_launcher` 12/12 (+2 static: local guards, `review_application_v2` only, no direct writes, dry run, the selfie warning, a file outside the repo with no keys);
- all `p0-checks` and `onboarding-v2-checks` pass;
- `smoke_onboarding_takes_local` 18/18.

The test review pages (synthetic data) remain in `~/tempa-review/`.

## Open the owner's application (decision by the owner)
```
cd ~/tempa-p0
node scripts/local-backend/review.mjs show --email=tempa-onb-phone-1@tempa-test.example.com
open ~/tempa-review/<the file printed on the "Review" line>
# then, if you decide so:
node scripts/local-backend/review.mjs accept --email=tempa-onb-phone-1@tempa-test.example.com          # plan only
node scripts/local-backend/review.mjs accept --email=tempa-onb-phone-1@tempa-test.example.com --yes    # apply
```
