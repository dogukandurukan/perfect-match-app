# P07 — Your Profile: approved visual direction and development preview

Owner approved the final-section mockup on 2026-09-28. Implement the profile section AFTER latest P06, preserving its Time icons and all P05 input fixes. Owner phone feedback for P06 including icons: looks good (visual acceptance, not exhaustive verification).

## Setup and scope
Read AGENTS.md, docs/tempa canonical docs, P06_RESULT.md and this package. Create tempa/p07-your-profile-ui from latest tempa/p06-your-dates-ui; suggested worktree ~/tempa-p07. Preserve unrelated work. Bring in this main package without overwriting newer code with old main implementation.

This is isolated DEV preview with in-memory drafts and user-selected local media. NO Supabase/auth/storage writes, real email/SMS, application submission, face recognition, automatic verification, payments, production integration, merge or deployment. No fabricated success claims. Existing third-party taste search remains as approved. Don't change permission modes or disable safeguards; use ordinary user approval if needed.

## Design
Reuse ivory/forest/sage palette, Playfair compact titles (28/36), DM Sans controls, existing keyboard-safe shell. No heading emoji. Mockup photo/answer/email examples are illustrative only: never seed personal answers or generated people into a user's draft.

The approved board depicts seven visual screens; canonical flow includes an explicit Submit review state BEFORE Received. Preserve this eighth state, using the same design. Verifying an email must not automatically submit an application.

Update canonical docs on work branch with this copy and preview boundaries. Read next available decision number rather than assuming it.

## 1. Photos
Title "Add your photos"; helper "Add at least 3 photos."
Six slots, 2 columns x 3 rows at normal width, 3 minimum and 6 maximum for this approved layout.
Select device library photos using existing compatible media dependency, local URIs only. Support batch selection respecting remaining capacity, cancellation without data loss, remove, replace, primary first photo, and reorder. "Main photo" identifies first slot.
Use drag reorder if supported reliably; also provide an accessible move earlier/later or make-main action. Only display "Drag to reorder." if actually implemented.
No upload or media/URI logging. Do not copy images into permanent storage or save selfie to library.
Continue requires at least 3 valid selected photos. Removing down to 2 makes section incomplete. Handle denied/limited permissions, unavailable media and cancelled picker without crash or fake placeholder counting as a photo.
Reuse installed native capabilities; if new native module is necessary report the new build requirement accurately.

## 2. Prompts
Title "A little more you"; helper "Answer 2 questions. Add a third if you like."
Two required answers, third optional. Initial prompt labels from canonical decisions remain:
- "I'm most myself when…"
- "Something I could talk about for hours…"
Answers start EMPTY. Each prompt can be changed using a simple picker; answers editable, third removable. No duplicate prompt IDs.
Local preview library includes those two plus:
- "My perfect Sunday"
- "We'll get along if…"
- "A perfect first date looks like…"
- "A small thing that makes me happy"
Use stable IDs; these additional entries are preview copy, not approved backend enum migrations. No AI/autofilled answers.
"Short answers are welcome." as editor hint. Proposed implementation cap 200 characters per answer with counter; whitespace-only invalid. If canonical existing bounds differ, retain/document them. Changing prompt must not silently discard an answer; retain draft or explicitly confirm replacement.
CTA "Preview my profile", available after 2 nonempty answers; an added but blank third can be omitted.

## 3. Profile preview
Title "Your profile"; helper "This is how others will see you."
Assemble from actual current in-memory drafts, not mockup identity:
primary photo + first name/age → concise facts → prompt1 → photo2 → prompt2 → photo3 → optional prompt3/remaining photos.
No surname, exact DOB, email, phone, verification selfie, internal scoring, fake shared interests with no viewer, or fake verification badge.
Omit unknown/optional empty fields gracefully. Use actual chosen artist/book data if included, don't invent photos.
"Edit profile" returns to editable sections with a clear return-to-preview path and all drafts preserved. Photos and prompts should be individually editable; other facts link back to corresponding step if exposed for editing.
CTA "Continue" to selfie, revalidating required photo/prompt counts.

## 4. Private selfie
Title "A quick selfie"; helper "Help us check it's really you."
Private front-camera capture, oval guide if existing camera dependency allows; capture preview with "Retake" and "Use selfie". No gallery substitute presented as a live selfie. Request camera permission on user action; handle denial, missing hardware/camera and cancellation gracefully. No face recognition/liveness claims.
Copy "Your selfie stays private." / "We'll review it with your profile photos."
In DEV clearly indicate "Preview only — this selfie is not uploaded or reviewed."
Selfie separate from public photos, kept in memory via local URI, never shown in public preview. No backend calls, no log of image or URI. Explain media retention limitations in report. Require capture for the regular local preview path; unsupported camera stays honestly blocked, not verified.

## 5. Email
Title "Your email"; helper "We'll send you a code."; label "Email".
Private empty input, email keyboard, no autocapitalization. "Your email stays private."
Visible DEV explanation before action: "Preview only — no email will be sent."
CTA "Send code" simulates transition ONLY. Validate reasonable email shape; same draft identity, no new user/auth session. No real network delivery.

## 6. Email code
Title "Check your email"; display entered email; six digit code control with paste and accessible entry.
Clearly show "Demo code: 123456. No email was sent." in DEV preview.
CTA "Verify email" validates only the demo state, NEVER actual account verification.
Wrong code inline error, resend simulated cooldown, change email clears demo code/verification. Store demo verification separately from production auth and bind it to the current email.
Do not label successful demo verification as a real verified account.
Resend error/expiry states can be deterministic preview helpers; document simulations. No real SMTP, OTP, or auth.

## 7. Submit review — preserve canonical explicit confirmation
Title "Ready to submit?"
Checklist: Photos added, Answers added, Selfie added, Email checked (demo).
Explain profile review. No invented review timeframe, price or promise of acceptance.
Visible "Preview only — no application will be sent."
CTA "Submit application" transitions to local received preview only when all current requirements are valid. Guard rapid repeat taps; no server call. This is not production idempotency.
Allow correction/back without loss.

## 8. Received
Title "You're on the list"
"We've received your application."
"We'll email you when your profile has been reviewed."
Sage panel "Application received" / "Review pending".
Visible DEV banner "Preview only — no application was submitted."
"Review my profile" opens own assembled profile read-only/review mode with return to received; allow edits through existing draft editors with revalidation if needed. No discovery or membership activation.
Keep application status, identity verification and eligibility separate. No actual approved/verified/membership flags.

## Flow and retention
P06 Dates2 CTA now → Photos; remove old P06 terminal notice. Back Photos → Dates2. All earlier answers/media persist across forward/back/edit until preview reset/reload, with clear preview-only limitation.
Maintain section-local labels consistently. Expected 8 main states (photo/prompt editors/pickers aren't additional main questions); document actual count. Preserve all DEV entry points and production redirects.
If a required native capability is unavailable, finish all unblocked screens and clearly report the missing capability/new build step. Don't substitute silent fake success.

## Checks and handoff
Typecheck, relevant production gate/export check, focused logic checks: 2 vs3 photo validity, removal/reorder/primary, independent selfie, 2 answers/duplicate prompts/optional third, privacy field exclusion, email correction invalidates demo verification, wrong code, checklist/submit guard, back/edit retention.
Actual phone/simulator layout/media permissions if available; distinguish from static/code checks. Verify shared placeholder after height ruler, multiline answer scrolling, keyboard/footer overlap, large text and actual photos fitting slots. Avoid exhaustive unrelated testing.
Write docs/tempa/work-packages/P07_RESULT.md: implementation SHA, baseline/head, worktree, changed dependencies/build needs, actual checks, which operations are LOCAL vs SIMULATED vs NOT IMPLEMENTED, remaining backend/privacy/retention requirements, exact phone startup instructions (do not assume current Metro source).
Push tempa/p07-your-profile-ui and stop for phone review. No merge/deployment/backend connection.
