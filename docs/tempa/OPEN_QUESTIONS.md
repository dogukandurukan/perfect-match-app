# Open questions — only those that block implementation

Owner: Doğukan unless noted. Close a question by moving the answer into
[`DECISIONS.md`](DECISIONS.md) with date and source.

| # | Question | Blocks | Options / notes |
|---|---|---|---|
| Q5 | Where does KVKK consent go in the new flow? (today: checkbox on email register screen) | S1 | Welcome/phone screen before OTP is the likely spot |
| Q6 | Remaining prompt-library entries and storage-key mapping | S7, `profile_prompts` check | Partially resolved 2026-09-23 → D33: approved two defaults + swap, two required answers/third optional, first-date prompt as alternative. Do not assume the older 8-key library is approved; confirm remaining entries and map keys before implementation. |
| Q7 | SMS provider and dev mock strategy | S1 auth | Mock provider in dev only; no prod bypass |
| Q8 | Catalog provider for artists / books / movies-series | S5 taste lists | Start with free text + provenance; catalog later |
| Q9 | Clear-face photo: auto-enforce or reviewer-only? | S7 photos | No AI checker assumed |
| Q10 | Rejection and resubmission policy | Before real users | Needed before enabling real accounts, not for building UI |
| Q11 | Show a percentage at all in V2? | Scoring display | Proposed: qualitative explanation |
| Q12 | Proximity bands | Scoring | Proposed: city-only → neutral 5 |

## Closed

| # | Question | Resolution |
|---|---|---|
| Q2 | Fate of legacy onboarding fields (languages, morning/night, recharge, education level, neighborhoods, first-date expectation, bio, Instagram) | Closed 2026-09-23 → D40, D41 in `DECISIONS.md`. Not carried into V2 onboarding; languages and neighborhood/distance may be revisited later in Settings, with no screen or schema requirement now. |
| Q3 | Palette scope (onboarding only vs app-wide) | Closed 2026-09-23 → D42: green/ivory across the whole onboarding; other app screens evaluated separately. |
| Q1 | Gender and interested-in taxonomy + eligibility | Closed 2026-09-23 → D15 (Woman/Man/Non-binary, single choice) and D15b (Women/Men/Non-binary people multi-select, exclusive Everyone, mutual eligibility). Replaces the earlier four-option gender proposal. |
| Q4 | Serif display font choice | Closed 2026-09-23 → D43: Playfair Display Bold (700) headings + DM Sans body/controls; visible Tempa wordmark remains a temporary placeholder for the final logo. |
