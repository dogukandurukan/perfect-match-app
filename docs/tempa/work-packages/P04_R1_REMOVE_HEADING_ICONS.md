# P04 R1 — Remove question heading icons

READY — explicitly requested by Doğukan after phone review, 2026-09-27.

Continue latest tempa/p04-your-life-ui in its existing worktree, preserve local changes. Read applicable repository instructions and P04_RESULT.md. This supersedes only P04's instruction to show icons beside question headings.

Remove the cigarette, wine glass, paw and walking-person icons from all four Your Life question headings. Remove reserved icon width/gap so titles align with the standard text-only Compatibility headings. Keep consistent title/helper block and answer baseline, normal-size titles at most two lines where possible; never truncate accessibility text.

Keep small icons beside Dog / Cat / Both / Other and the approved Compatibility values icons. Preserve copy, choices, conditional pet follow-up, navigation, in-memory answers, selection behavior, theme and dev gates. No new questions or Section 5. No backend/auth/scoring changes, no merge or deploy.

This is a small visual change: inspect diff and run existing type check if shared props/imports change; do not add tests merely mirroring icon removal. Update relevant canonical decision wording on work branch and append a dated R1 note to P04_RESULT.md with implementation commit and actual reload instructions. Distinguish code inspection from phone QA. Push the P04 branch and stop.
