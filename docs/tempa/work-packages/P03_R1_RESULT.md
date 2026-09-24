# P03 R1 — Result: simpler Compatibility copy + values redesign

**Status: DONE (implementation). Owner phone validation: PENDING.**
Date: 2026-09-25. Implemented by Claude Code. Not merged, not deployed.

| | |
|---|---|
| Branch | `tempa/p03-compatibility-ui` (continued from `2c07a71`; `main` @ `136d641` merged in) |
| **Implementation commit** | `59fb8513c29ff0c8ebc29f45f44a0960a27607c1` |
| Worktree | **`/Users/dogukandurukan/tempa-p03`** (same as P03). Other worktrees and `~/dating-app-recovered` untouched. No newer entry-button commits existed on the branch; nothing reverted. |

## What changed

**Copy (D50)** — exactly as approved; question IDs and option keys unchanged, same order:

| # | Title | Helper | Options |
|---|---|---|---|
| 1 | What are you looking for? | — | A serious relationship · Something casual · Not sure yet |
| 2 | How social are you? | — | I like quiet plans · Somewhere in between · I love going out |
| 3 | How often do you like to text? | When dating someone | A few messages a day · A few times a day · Often during the day |
| 4 | How much time together feels right? | When dating someone | More time for myself · A balance of both · Lots of time together |
| 5 | Is it easy to share your feelings? | — | I need time · Once I feel comfortable · Yes, I'm open |
| 6 | When would you like to meet? | — | Soon · After some chatting · When I feel ready |
| 7 | What matters most to you? | In a relationship. Pick 1 or 2. | (values below) |

Option subtitles removed. Still required, Q1–6 single-select, no preselection.

**Values (D51)** — ten equal-width cards, 2 columns × 5 rows, row-major:
Trust · Growing together / Fun · Stability / Personal space · Adventure /
Affection · Family / Health · **Respect** (directly below Family). Keys kept
(`growth` = Growing together, `independence` = Personal space); `respect` is a
new local UI key only. Icons: small forest-green outline glyphs left of the text
from icon sets already bundled with `@expo/vector-icons` (MaterialCommunityIcons:
link-variant, sprout-outline, anchor, feather, compass-outline, heart-outline,
home-outline, handshake-outline; Ionicons: sunny-outline, leaf-outline) — no
emoji, no new dependency. Fine beige border, 12 pt radius, no shadow/gradient.
Selected: pale sage fill `#E6ECE3` + green border + corner check; the check
space is always reserved so text never shifts. "N of 2 selected" counter.
1–2 selections; with two chosen the rest are dimmed/disabled (third tap refused,
never replaces); selected cards stay deselectable.

**Shared Compatibility layout** — headings 28/36 pt Playfair Display 700 on all
seven questions (Basics keeps its 36 pt). A reserved title+helper block
(min 98 pt = two title lines + helper) makes options start on the same baseline
whether the title is one or two lines and with or without a helper; at larger
text sizes the block grows and the screen scrolls — nothing truncated or shrunk
per question. Footer Continue unchanged. Basics (incl. ruler/location), section
progress, answer retention, height→Compatibility boundary, end notice/review
controls and DEV entry gating unchanged.

Canonical docs updated on this branch: `ONBOARDING_FLOW.md` §3 (new copy/values),
`DECISIONS.md` **D50** (copy) and **D51** (values); D17/D19 annotated as revised.

## Fit verification (code/metric simulation — not a screenshot)

Wrapping simulated with the **actual advance widths of the bundled fonts**
(fontTools), content width = screen − 48 pt:

- **Titles at 28 pt, normal text size:** ≤ 2 lines on 430/393/390/375/320 pt wide
  screens. At 1.4× text some reach 3 lines on ≤ 393 pt — allowed; the block grows.
- **Value labels at 15 pt:** the widest word is "Adventure" = 74.6 pt. In two
  columns a label has (W × 0.485 − 70) pt. Two columns are used only when that
  fits the widest word (× text scale, +4 pt); otherwise cards stack in **one
  column** so words never split. Result: 2 columns on 430/393/390 up to 1.2× text
  and on 375 at normal text; **1 column on 320 pt screens and at larger text** —
  exactly the cases where the simulation showed "Adventure"/"Affection" splitting.
  "Growing together" and "Personal space" wrap at the space onto two lines.

## Checks performed

| Check | Kind | Outcome |
|---|---|---|
| `npx tsc --noEmit` | build | ✅ exit 0 |
| `npx expo export --platform ios` (production) | build | ✅ exit 0; "Preview new onboarding" absent, "Log In" present → DEV button stripped |
| R1 logic script on real modules (sucrase + node, not committed) | code | ✅ 28 checks: exact titles/helpers/option copy; IDs/keys/order unchanged; no subtitles; Q7 copy; 10 value keys + labels in row-major order; Respect directly below Family; every icon name exists in the bundled glyph maps; Respect selectable, 2 max, third blocked without replacement, deselect then pick another; no preselection on Q1–Q7; height↔Q1 boundary; all 13 steps valid with full drafts (retention) |
| P02 regression script (39 checks) on P03 R1 code | code | ✅ passed |
| Column rule per width/scale | code | ✅ matches the word-split simulation (table above) |
| Lint / test scripts | — | none defined in `package.json` |
| **On device** | runtime | ⏳ **PENDING** — no simulator/web runtime; no screenshots |

**Pending phone checks:** all seven titles ≤ 2 lines at normal size on the
owner's phone; options start at the same height across Q1–Q7 (with/without
helper); value grid 2 × 5 with icons aligned, Respect under Family, check appears
without text moving, third value dimmed, deselect works; larger Dynamic Type →
one column, nothing clipped, screen scrolls, Continue reachable; Back/forward
still keeps answers; DEV button on signed-out landing still opens the preview.

## Owner reload steps

At the time of this report the Metro server on port 8081 is running from
**`~/tempa-p03`** — the same worktree — so no restart is needed:

1. In that Metro terminal press **`r`** (or shake the phone → **Reload**).
2. Signed out → landing → **DEV · Preview new onboarding** (or Safari →
   `datingapp://dev/onboarding-v2-name`).

If Metro is no longer running: `cd ~/tempa-p03 && git pull && npx expo start --dev-client -c`,
then connect via the QR the terminal prints. No new dependency / native module →
no new development build.

## Remaining questions

1. **One column on 320 pt phones** even at normal text size (to avoid splitting
   "Adventure"). *Recommendation:* accept; alternative is a smaller label size,
   which the package discourages.
2. Carried over (unchanged): legacy 13+ age rule, missing height bounds, shared
   `normalizeTr` İ bug, inherited startup writes when signed in.

## Scope confirmation

Display copy and UI only. No backend, auth, scoring, schema, merge or deploy
changes; `respect` is a local preview key. No Section 4; P04 not started.
