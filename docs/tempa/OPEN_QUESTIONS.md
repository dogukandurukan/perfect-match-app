# Open questions — only those that block implementation

Owner: Doğukan unless noted. Close a question by moving the answer into
[`DECISIONS.md`](DECISIONS.md) with date and source.

| # | Question | Blocks | Options / notes |
|---|---|---|---|
| Q1 | Gender and interested-in taxonomy | S2, schema Rev 3, eligibility | Draft proposal: gender `woman/man/non_binary/self_describe`; interested-in same set + `everyone` (exclusive). Today: Man/Woman/Non-binary and Men/Women/Non-binary/Everyone. |
| Q2 | Fate of today's extra onboarding fields: languages, morning/night, recharge, education level, neighborhoods, first-date expectation, bio, Instagram (already removed from S2) | S2–S6 regrouping, schema | Keep as profile-edit only / drop / fold into prompts |
| Q3 | Palette scope: ivory + dark green only in onboarding, or app-wide? (app is black; Home is coral) | Shared components | Handoff: "no new palette" for onboarding |
| Q4 | Serif display font choice (none loaded today) | Shared components | Needs a licensed font (e.g. Google Fonts via `expo-font`) |
| Q5 | Where does KVKK consent go in the new flow? (today: checkbox on email register screen) | S1 | Welcome/phone screen before OTP is the likely spot |
| Q6 | Prompt source: handoff's 2 suggested prompts vs. the older 8-key library | S7, `profile_prompts` check | Could be: 2 suggested + library to swap |
| Q7 | SMS provider and dev mock strategy | S1 auth | Mock provider in dev only; no prod bypass |
| Q8 | Catalog provider for artists / books / movies-series | S5 taste lists | Start with free text + provenance; catalog later |
| Q9 | Clear-face photo: auto-enforce or reviewer-only? | S7 photos | No AI checker assumed |
| Q10 | Rejection and resubmission policy | Before real users | Needed before enabling real accounts, not for building UI |
| Q11 | Show a percentage at all in V2? | Scoring display | Proposed: qualitative explanation |
| Q12 | Proximity bands | Scoring | Proposed: city-only → neutral 5 |
