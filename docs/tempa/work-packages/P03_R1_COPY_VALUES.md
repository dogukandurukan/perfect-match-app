# P03 R1 — Approved simpler English and mature values UI

Status: READY. Doğukan explicitly approved the seven-screen mockup in this conversation.
Continue on latest tempa/p03-compatibility-ui, preserving all local changes and existing worktrees. Read applicable repository instructions and latest P03 result. Do not revert newer entry-button fixes. No merge/deploy, no Section 4, no backend/auth/scoring changes.

## Authority
This approved revision supersedes conflicting P03 full-copy/subtitle requirements and the old nine-value, three-column layout. Update ONBOARDING_FLOW.md, DECISIONS.md (next unused decision IDs), implementation status and result on the work branch to match. Preserve other decisions. Do not assume approval of entire onboarding or phone QA completion.

## Exact approved copy
Keep existing question IDs and option keys in their existing order; these are display-copy changes only.

1. What are you looking for?
- A serious relationship
- Something casual
- Not sure yet

2. How social are you?
- I like quiet plans
- Somewhere in between
- I love going out

3. How often do you like to text?
Helper: When dating someone
- A few messages a day
- A few times a day
- Often during the day

4. How much time together feels right?
Helper: When dating someone
- More time for myself
- A balance of both
- Lots of time together

5. Is it easy to share your feelings?
- I need time
- Once I feel comfortable
- Yes, I'm open

6. When would you like to meet?
- Soon
- After some chatting
- When I feel ready

7. What matters most to you?
Helper: In a relationship. Pick 1 or 2.

Remove repetitive option subtitles in this section. Questions remain required, Q1–6 single-select, no preselection.

## Values
Two columns, five rows, equal-width compact cards. Ordered row-major:
| Existing/local key | Label | Small outline icon concept |
| trust | Trust | link |
| growth | Growing together | sprout |
| fun | Fun | sun |
| stability | Stability | anchor |
| independence | Personal space | feather |
| adventure | Adventure | compass |
| affection | Affection | heart |
| family | Family | house |
| health | Health | leaf |
| respect (new local preview key) | Respect | handshake |

Respect sits directly below Family. Retain existing keys for renamed labels. The new key is UI draft only, not authorization to extend backend/scoring. Keep 1–2 selections, third selection blocked without replacement, selected options deselectable. No preselected values: mockup selected states were illustrations only.

Use small single-color outline icons LEFT of text from existing installed icon capabilities; no emojis, large artwork, new paid services or native dependencies. Forest-green icons, warm ivory background, fine beige borders, restrained 12px-ish radii. Selected cards pale sage fill + green border and fixed corner check. Reserve space for check whether selected or not so text never shifts. Labels wrap at spaces, never split words like Independence. Growing together may occupy two lines. Keep icons/text within card. Show selection count.

## Shared Compatibility layout
Retain D46 flat ivory/forest green, Playfair Display Bold headings, DM Sans body/buttons. No gradients/shadows from generated render. Headings around 28–30pt as a starting point; consistent size across these seven questions. At normal text size, target at most two lines on owner phone and narrow phones. Use shorter approved copy and available width rather than truncation or per-question font shrinking.
Reserve a consistent title/helper block so options start on the same baseline despite one/two-line headings and optional helper. At accessibility sizes let this block grow and content scroll; never force two lines or hide text. Footer Continue remains accessible and consistent.
The board is a visual reference, not literal screen aspect ratio: implement real phone safe areas, touch targets, responsive scrolling. Do not compress all content artificially to fit the board.
Basics layout and approved ruler/location stay intact. Preserve section progress, back/forward answer retention, height→Compatibility boundary, end preview notice/review controls and dev entry gates.

## Verification and handoff
Run existing type/iOS bundle gates as appropriate. Focus verification on 10-value ordering, 1–2 selection including Respect/deselection, retained answers and production dev gating. Verify visual fit of all seven titles and longer card labels at normal and larger text sizes; explicitly distinguish runtime screenshots from code checks. No fabricated phone tests.
Push changes and docs/tempa/work-packages/P03_R1_RESULT.md on the P03 branch with implementation SHA, checks, pending phone checks, actual worktree and precise owner reload steps. Update canonical docs on same work branch. Stop after push. No automatic merge/deploy/P04.
