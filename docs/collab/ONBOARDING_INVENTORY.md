# Tempa V2 onboarding — inventory of the current live flow

Written on 2026-10-21 against product commit `652e2ba`; **updated 2026-10-26 for product commit `f9200c1`** (branch `tempa/v2-persist-r2`). The only onboarding change in between is D104 / D104a / D104b — see **§2b**, which overrides anything older below.
Everything below was checked in source code or SQL. File paths are relative to the repo root. Line numbers are for this snapshot. **"Not verified"** means the code or docs could not confirm the point.

Main sources:
- `app/v2/welcome.tsx`, `app/v2/onboarding.tsx`, `app/v2/status.tsx`
- `components/onboarding-v2/**`
- `lib/onboardingV2/*.ts`
- `supabase/proposed/20260930120000_v2_onboarding_persistence.sql`, `20261001090000_v2_public_profile.sql`, `20261016090000_v2_onboarding_takes.sql`
- `docs/tempa/DECISIONS.md`, `docs/tempa/ONBOARDING_FLOW.md`, `docs/tempa/work-packages/V2_INTERESTS_TAKES_RESULT.md`, `docs/tempa/work-packages/V2_PERSIST_R3_RESULT.md`

---

## 1. Entry points

### 1.1 Signed-out landing — `app/(tabs)/index.tsx` (branch `profileState === null`, line 859 onward)

| Element | Exact text | Shown when | Action | Line |
|---|---|---|---|---|
| Title | `Dating App` | always | – | 865 |
| Subtitle | `Fewer swipes. Real meetups.` | always | – | 867 |
| Button | `Log In` | always | `/(auth)/login` (V1 login) | 875 |
| Button | `Sign Up` | always | `/v2/welcome` if `v2Enabled`, otherwise `/(auth)/register` (V1) | 882 |
| Button | `DEV · Preview new onboarding` | `__DEV__` only | `/dev/onboarding-v2-name` (local `PreviewFlow` without `live`; no backend) | 894 |
| Button | `DEV · Design preview` | `__DEV__` only | `/dev/design-preview` | 906 |
| Button | `` `${backend.env.toUpperCase()} · Join with new onboarding` `` (e.g. `LOCAL · …`, `DEV · …`) | `__DEV__ && v2Enabled` | `/v2/welcome` | 912–919 |
| Button | `DEV · Test account sign-in` | `devTestEmail` is set | `/v2/welcome?test=1` | 924–931 |
| Button | `DEV · Input lab` | `__DEV__` only | `/dev/input-lab` | 941 |
| Text | build label + backend label (`devBuildLabel()` / `devBackendLabel()`) | `__DEV__` only | – | 947–948 |

- **`v2Enabled`** = `backend.env` is `dev`, `test` or `local` (`lib/supabaseClient.ts:20`). The `live` backend never sets it.
- **`devTestEmail`** is set only when `__DEV__ && v2Enabled` and an allowed `@tempa-test.example.com` address is configured (`lib/supabaseClient.ts:22–26`).
- The `DEV · Design preview` button appeared in this file while this inventory was being written, so it is a concurrent change. It is listed as found on disk.

**Spec Welcome copy is not implemented.** `docs/tempa/ONBOARDING_FLOW.md:22` specifies:
- headline "People, not profiles."
- body "Meet people you connect with. Make plans to meet in real life."
- CTA **Get started**, plus **Log in** and a "How membership works" link.

The words "People, not profiles." appear in code only in `lib/dev/designPreview.ts:88–93` (`SPEC_WELCOME`, comment "status 🟡 copy, not built"). That file is rendered only by the DEV design preview (`components/dev/design/DesignPreview.tsx:169–171`). The live landing still shows "Dating App" and "Fewer swipes. Real meetups." The spec's Phone/SMS screens are also not built: the live account step uses an email code (owner decision 2026-09-30, comment in `app/v2/welcome.tsx:1–4`).

### 1.2 V2 Account screens (email code) — `app/v2/welcome.tsx`

Copy constants: `components/onboarding-v2/account/AccountFields.tsx:10–29` (`ACCOUNT_COPY`). Consent row: same file, lines 31–61.

| | Email phase | Code phase |
|---|---|---|
| Header | section `Account`, `1 of 2` | section `Account`, `2 of 2` |
| Title | `What's your email?` | `Enter your code` |
| Helper | `We'll send you a code to sign in.` | `` `We sent a sign-in code to ${email}.` `` (test mode: `` `DEV test account ${email} — enter the code shown in your Mac terminal.` ``) |
| Field | label `Email` (email keyboard, autocomplete email) | label `Sign-in code` (number pad, one-time-code autofill; digits only, max 10, `welcome.tsx:23–25`) |
| Consent | checkbox, never pre-checked: "I have read the **Privacy Notice** and agree to the processing of my personal data." The link opens `/privacy-notice`. | shown here only in test mode |
| Primary CTA | `Send code` — disabled until `emailLooksValid(email)` **and** consent is checked | `Continue` — disabled while the code is shorter than 6 digits (`MIN_CODE = 6`, `MAX_CODE = 10`) |
| Busy label | `Please wait…` | `Please wait…` |
| Resend | – | `Resend code` / `` `Resend code in ${s}s` `` (cooldown `RESEND_COOLDOWN_SECONDS = 30`, `lib/onboardingV2/yourProfile.ts:255`); hidden in test mode |
| Back | `router.back()` if possible | returns to the email phase (test mode: `router.back()`) |

Email shape check (`emailLooksValid`, `lib/onboardingV2/yourProfile.ts:262–266`): at most 254 characters, `local@domain.tld`, no spaces.

Error copy (`ACCOUNT_COPY.errors` plus `welcome.tsx:65–100`):

| Case | Text |
|---|---|
| Send failed, rate limit (`/rate\|seconds/`) | `Please wait a moment before asking for another code.` |
| Send failed, other | `We couldn't send a code. Check the address and try again.` |
| Verify, `otp_expired` / "expired\|invalid" | `That code isn’t valid or has expired. Use the newest code or send a new one.` (test mode: `` `…Use the newest code made for ${email}.` ``) |
| Verify, other error | `That code isn't right. Try again.` |
| Timeout (`lib/withTimeout.ts:26`) | `This is taking too long. Check your connection and try again.` |
| Network (`lib/withTimeout.ts:28`) | `No connection. Check your internet and try again.` |
| Other exception | fallback `We couldn't send a code. Try again.` / `Something went wrong. Try again.` |

**Routing after a correct code** (`welcome.tsx:103–123`):
1. `loadMyOnboarding()` → RPC `get_my_onboarding_v2`. That RPC creates the V2 rows. For an existing V1 member (`setup_completed`) it raises `legacy_account` (`v2_ensure_me`, persistence SQL 327–342).
2. If the load fails → `router.replace('/')`, so V1 members keep the current app.
3. `profiles.privacy_consent_at = now()` is written only if it is still null. A failure is only logged.
4. `application_status` `draft` or `changes_requested` → `/v2/onboarding`; anything else → `/v2/status`.

### 1.3 `/v2/onboarding` loader — `app/v2/onboarding.tsx`

- No session → `/v2/welcome`.
- Status other than `draft` / `changes_requested` → `/v2/status`.
- Loading: spinner (a11y label "Loading your answers").
- Load error: the error text plus a `Try again` link.
- **Changes requested:** Alert title `A few changes, please`. Body = the reviewer's note, or `Our team asked you to update a few things before we can review your application again.` The flow opens at the first item the reviewer asked for (`firstMissingPos(review_items)`). Otherwise it resumes at the saved `resume_section` / `resume_step` (`serverMapping.ts:171–177`; Your Profile resumes at most at step 6).

### 1.4 Status screen — `app/v2/status.tsx`

Copy: `STATUS_COPY` in `components/onboarding-v2/yourProfile/ApplicationFields.tsx:85–90`, plus `ReceivedFields` (same file).

The gate is read from RPC `get_my_access_v2` (persistence SQL 643–660) through `getAccessGate` (`lib/onboardingV2/remote.ts:197–209`).

| Gate / state | Result |
|---|---|
| `member` / `legacy_member` | redirect `/` |
| `onboarding` (draft or changes_requested) | redirect `/v2/onboarding` |
| `signed_out` | redirect `/v2/welcome` |
| loading | spinner, a11y label "Checking your application" |
| `waiting` + `submitted` | `ReceivedFields live`: party-popper mark + confetti; `Thanks for joining Tempa.` / `We'll email you after we review your profile.` / panel `Application received` · `Review pending`. **No "You're on the list!" title on this route.** That title appears only in-flow (Your Profile step 7). |
| `waiting` + `rejected` | `Thanks for applying. We can't offer you a membership right now.` |
| `error` | the RPC error message, e.g. `Could not check your account. Try again.`, `No connection. Check your internet and try again.` or `Unexpected account state.` |
| any other case (`unavailable`, or `waiting` with accepted-but-not-active) | `We couldn't read your application status.` |
| always | links `Refresh` and `Sign out` (sign-out → `/`) |

---

## 2. Screen order (live flow)

- `PreviewFlow` (`components/onboarding-v2/PreviewFlow.tsx`) runs the sections listed in `lib/onboardingV2/previewFlow.ts:18–25`.
- The header shows the section label and "`step` of `steps`" (`OnboardingHeader.tsx`).
- Titles come from `titleFor` and helpers from `helperFor` (`PreviewFlow.tsx:118–146`).

| # | Section | Local step | Title | Helper | Component |
|---|---|---|---|---|---|
| A1 | Account | 1/2 | What's your email? | We'll send you a code to sign in. | `app/v2/welcome.tsx` |
| A2 | Account | 2/2 | Enter your code | We sent a sign-in code to {email}. | `app/v2/welcome.tsx` |
| 1 | Basics | 1/6 | What's your name? | – | `basics/BasicsFields.tsx` `NameFields` |
| 2 | Basics | 2/6 | When's your birthday? | – | `BirthdayFields` |
| 3 | Basics | 3/6 | What's your gender? | – | `GenderFields` |
| 4 | Basics | 4/6 | Who are you interested in? | – | `InterestedInFields` |
| 5 | Basics | 5/6 | Where do you live? | – | `LocationFields` |
| 6 | Basics | 6/6 | How tall are you? | – | `HeightFields` → `basics/HeightRuler.tsx` |
| 7 | Compatibility | 1/7 | What are you looking for? | – | `compatibility/CompatibilityFields.tsx` `SingleChoiceFields` |
| 8 | Compatibility | 2/7 | How social are you? | – | `SingleChoiceFields` |
| 9 | Compatibility | 3/7 | How often do you like to text? | When dating someone | `SingleChoiceFields` |
| 10 | Compatibility | 4/7 | How much time together feels right? | When dating someone | `SingleChoiceFields` |
| 11 | Compatibility | 5/7 | Is it easy to share your feelings? | – | `SingleChoiceFields` |
| 12 | Compatibility | 6/7 | When would you like to meet? | – | `SingleChoiceFields` |
| 13 | Compatibility | 7/7 | What matters most to you? | In a relationship. Pick 1 or 2. | `ValuesFields` |
| 14 | Your Life | 1/4 | Do you smoke? | – | `yourLife/YourLifeFields.tsx` `LifeQuestionFields` |
| 15 | Your Life | 2/4 | Do you drink alcohol? | – | `LifeQuestionFields` |
| 16 | Your Life | 3/4 | How do you feel about pets? | – | `LifeQuestionFields` (+ "What kind?") |
| 17 | Your Life | 4/4 | How active are you? | Physical activity | `LifeQuestionFields` |
| 18 | Your World | 1/6 | What do you do? | – | `yourWorld/YourWorldFields.tsx` `WorkFields` |
| 19 | Your World | 2/6 | Where did you study? | Add your school to your profile. | `SchoolFields` |
| 20 | Your World | 3/6 | Where are you from? | Your hometown, not where you live now. | `HometownFields` |
| 21 | Your World | 4/6 | What are you into? | Pick a few things you enjoy. | `InterestsFields` (+ `components/interests/ActivitiesField.tsx` on D93 servers) |
| 22 | Your World | 5/6 | Who do you listen to? | Add up to 3 artists you love. | `ArtistsFields` |
| 23 | Your World | 6/6 | Books & movies | Add a few favorites. You can change them later. | `MediaFields` |
| 24 | Your Dates | 1/2 | Your ideal first date? | Pick 1 or 2. | `yourDates/YourDatesFields.tsx` `DateTypesFields` |
| 25 | Your Dates | 2/2 | When are you free? | For a first date. | `DaysTimeFields` (CTA `Continue to your profile`) |
| 26 | Your Profile | 1/7 | Add your photos | Add at least 3 photos. | `yourProfile/PhotosFields.tsx` |
| 27 | Your Profile | 2/7 | A little more you | `Pick 2 prompts. Add a third if you like.`; on D93 servers: `Answer two prompts, or one prompt and one conversation starter.` | `yourProfile/PromptsFields.tsx` (+ `components/interests/TakesEditor.tsx` on D93 servers). CTA `Preview my profile` |
| 28 | Your Profile | 3/7 | Your profile | This is how others will see you. | `yourProfile/ProfilePreview.tsx` (+ `EditProfileSheet.tsx`) |
| 29 | Your Profile | 4/7 | A quick selfie | Help us check it's really you. | `yourProfile/SelfieFields.tsx` |
| – | Your Profile | 5/7 | Your email | We'll send you a code. | `EmailFields` — **skipped in live mode** |
| 30 | Your Profile | 6/7 | Check your email / Email verified / Send your update (see §3.6) | see §3.6 | submit screen inside `PreviewFlow.tsx:795–817` |
| 31 | Your Profile | 7/7 | You're on the list! | – | `ApplicationFields.tsx` `ReceivedFields` |
| – | – | – | (status route) | – | `app/v2/status.tsx` |

**Count:** 2 account screens + 31 live `PreviewFlow` steps = **33 screens before `/v2/status`**. The DEV preview has 32 `PreviewFlow` steps (it includes step 5).

**DEV preview vs live (`live` prop, `PreviewFlow.tsx:153–176`, 341–356, 359–404):**

| Aspect | DEV preview (`/dev/onboarding-v2-name`, no `live`) | Live (`/v2/onboarding`) |
|---|---|---|
| Persistence | none; all in memory | every Continue saves the section first; on failure it stays on the step and shows the error |
| Photos | local URIs | uploaded to the private bucket and auto-saved: 800 ms debounce, and also when the app goes to the background |
| Selfie | local only | uploaded on Continue from step 4 |
| Your Profile step 5 (email) | shown | skipped: next/prev jumps selfie ↔ code |
| Step 6 code | demo code `123456` (`DEMO_CODE`), `Verify email`, `Resend code`, change email | no code entry; the email is the one verified at sign-in. CTA `Submit application` / `Submit again` / `Sending…` |
| Submit | local "applicationPreview" | RPC `submit_application_v2` (idempotent request id); "received" only after server success |
| D93 starters / activities | never (`takesSupported` needs `live`) | only if `get_my_interests_v2` exists on the server (`PreviewFlow.tsx:206–221`) |
| DevNotices | shown | `ReceivedFields` hides its notice in live mode. **But `SelfieFields.tsx:109` always renders "Preview only — this selfie is not uploaded or reviewed.", in live mode too** (see §7). |

---

## 2b. Change since 2026-10-21 — "What you're looking for" (D104b, version 3)

Source: `lib/onboardingV2/connection.ts` (copy + rules), `components/onboarding-v2/yourProfile/ConnectionFields.tsx`, `components/onboarding-v2/PreviewFlow.tsx`, `docs/tempa/DECISIONS.md` D104 / D104a / D104b, `docs/tempa/work-packages/V2_CONNECTION_QUESTIONS_RESULT.md`. Server package `supabase/proposed/20261025090000_v2_connection_intent_priorities.sql` — **tempa-local only**.

**Where:** inside the live first-submit screen, only for V2 applicants in **draft** on a server with the package, while `CONNECTION_ENABLED = true` (`connection.ts:22`, the single off-switch). Order: invite → intention → priorities → connection style → summary → submit screen.

**Compatibility 3.1 is hidden there.** "What are you looking for?" (Compatibility step 1) is skipped while the section is on (`PreviewFlow.tsx` `hideOldIntent`); the intention is asked once, in this section. Progress still reads "2 of 7" on the next Compatibility step. The DEV design preview therefore uses **3.2 "How social are you?"** as its representative question.

| Screen | Title / helper (exact) | Options & rules |
|---|---|---|
| Invite | "What you’re looking for" / "Three short questions: what you’re looking for, what matters to you and how you like to connect." | **Explore** / **Skip for now**. With no old intent: "Choosing what you’re looking for is needed for your application." and no Skip |
| Intention | "What are you looking for?" / "Choose what fits you best right now." | single: A one-night connection · Casual dating, without commitment · Seeing where things go · A long-term relationship · A relationship leading to marriage · Still figuring it out. Optional "Also open to…" (any of the first five, never the main one, never "Still figuring it out"). Required only when there is no old intent |
| Priorities | "What matters to you?" / "Choose up to 3 priorities." | topics: Active lifestyle · Shared interests (up to 3 of your own) · Education · Work & career · Money mindset · Living arrangements · Plans for children (single). Each chosen topic needs ≥ 1 detail, each detail **Preference** or **Must-have**. "No specific preferences" clears after a confirm. Optional |
| Connection style | "How do you like to connect?" / "Choose up to 2 that feel right for you." | Regular contact and clear mutual interest · Letting closeness grow gradually · Keeping time and space for myself · Talking openly about expectations · Finding our own rhythm together · I’m not sure yet (only alone). Optional |
| Summary | "What you’re looking for" / "Based on the preferences you shared." | fixed text per option; never submits |

Privacy line (exact): "Your answers are saved privately. They aren’t shown on your profile and aren’t used for matching yet."

**Stored:** stable ids per version (version 3) via RPCs; version 1/2 answers kept, never converted. **Private** — not on the profile, not used for matching or review. Completeness (`v2_missing_for`) accepts the old intent **or** the new main intention; never mapped to each other. The old intent keeps its public "Looking for" line.

**Verified:** local tests (`v2_connection_questions` 76/76, `smoke_connection_answers_local.mjs`); owner phone 2026-10-25: design approved, answers + summary + reopen. **Not phone-tested:** selection-limit cases, clearing an answer, the required-intention path, save failure / retry, submitting with version-3 answers (per `docs/tempa/HANDOFF_CLAUDE.md` §3).

**Open product decisions (not for design work to settle):** old public intent vs new private intention can contradict; Must-have semantics; any matching use.

## 3. Per screen: questions, options, keys, rules

Validation per section: `isStepValid` (`lib/onboardingV2/basics.ts:126–143`), `isCompatStepValid` (`compatibility.ts:129–137`), `isLifeStepValid` (`yourLife.ts:99–104`), `isWorldStepValid` (`yourWorld.ts:123–126`), `isDatesStepValid` (`yourDates.ts:107–120`) and `isProfileStepValid` (`yourProfile.ts:358–377`). Continue is disabled until the step is valid. No option is ever preselected.

### 3.1 Basics (`lib/onboardingV2/basics.ts`, `BasicsFields.tsx`)

| Step | Fields / options (label → key) | Type | Rule | Helper / notes |
|---|---|---|---|---|
| Name | `First name`, `Last name` | text | both required after trim (`basics.ts:129`). No client max length; server check 1–50 characters | "Only your first name appears on your profile." |
| Birthday | `Day` (DD), `Month` (MM), `Year` (YYYY) | 3 numeric fields | real date, not in the future, age 18–120 (`parseDob`, `basics.ts:74–92`). Errors: "That date doesn't exist. Check the day and month." / "Your birthday can't be in the future." / "You need to be at least 18 to use Tempa." / "Please check the year." | "Only your age appears on your profile." |
| Gender | Woman→`woman`, Man→`man`, Non-binary→`non_binary` | single | required | – |
| Interested in | Women→`women`, Men→`men`, Non-binary people→`non_binary_people`, Everyone→`everyone` | multi | ≥ 1. **Everyone is exclusive:** picking it clears the others, and picking another clears Everyone (`toggleInterestedIn`, `basics.ts:55–59`) | – |
| Location | field `City or district`; typeahead over İstanbul, Ankara, İzmir, Bursa, Antalya and their districts | search + pick | a suggestion must be selected; editing the text clears the selection (`basics.ts:117–124`, 137) | "Preview search covers İstanbul, Ankara, İzmir, Bursa, Antalya and their districts only." No match: "No matching city or district in this preview." |
| Height | large number + `cm`, 1 cm ruler (initial view 170, never submitted) | number | client: 1–3 digits, > 0 (`heightRuler.ts:26–28`). **Server CHECK 90–250** | – |

### 3.2 Compatibility (`lib/onboardingV2/compatibility.ts`)

All six are single choice, required, and the stored key must be one of the options.

| Step | Title | Options (label → key) |
|---|---|---|
| 1 | What are you looking for? | A serious relationship→`long_term`; Something casual→`casual`; Not sure yet→`figuring_out` |
| 2 | How social are you? | I like quiet plans→`low_key`; Somewhere in between→`mix`; I love going out→`social` |
| 3 | How often do you like to text? *(When dating someone)* | A few messages a day→`little_each_day`; A few times a day→`few_checkins`; Often during the day→`often` |
| 4 | How much time together feels right? *(When dating someone)* | More time for myself→`plenty_of_space`; A balance of both→`balance`; Lots of time together→`lots_together` |
| 5 | Is it easy to share your feelings? | I need time→`reserved`; Once I feel comfortable→`warm_when_comfortable`; Yes, I'm open→`open` |
| 6 | When would you like to meet? | Soon→`quickly`; After some chatting→`after_chatting`; When I feel ready→`take_my_time` |
| 7 | What matters most to you? *(In a relationship. Pick 1 or 2.)* | multi, 1–2. A third selection is refused, never replaces (`toggleValue`). Counter "N of 2 selected". Trust→`trust`, Growing together→`growth`, Fun→`fun`, Stability→`stability`, Personal space→`independence`, Adventure→`adventure`, Affection→`affection`, Family→`family`, Health→`health`, Respect→`respect` |

### 3.3 Your Life (`lib/onboardingV2/yourLife.ts`)

| Step | Title | Options (label → key) | Rule |
|---|---|---|---|
| 1 | Do you smoke? | No→`no`; Sometimes→`sometimes`; Yes→`yes` | single, required |
| 2 | Do you drink alcohol? | I don't drink→`none`; Sometimes→`sometimes`; Regularly→`regularly` | single, required |
| 3 | How do you feel about pets? | I have pets→`have_pets`; No pets, but I like them→`like_no_pets`; I'm neutral about pets→`neutral`; I'd rather not live with pets→`rather_not` | single, required |
| 3 (branch) | **What kind?** — shown only while `have_pets` is selected | Dog→`dog`; Cat→`cat`; Both→`both`; Other→`other` | single, deselectable. **Client: never required** (`yourLife.ts:98`). Moving away from `have_pets` clears it. **Server: missing `yourLife.pet_kind` blocks submit** (see §7) |
| 4 | How active are you? *(Physical activity)* | Very active→`very`; Somewhat active→`somewhat`; Not very active→`not_very` | single, required |

### 3.4 Your World (`lib/onboardingV2/yourWorld.ts`)

Only step 4 is required. All other steps show a secondary **`Add later`** (`isWorldStepSkippable`).

| Step | Content | Rule |
|---|---|---|
| 1 What do you do? | Full-time→`full_time`, Part-time→`part_time`, Self-employed→`self_employed`, Student→`student`, Between jobs→`between_jobs` (single, tap again to deselect) + text `Job title (optional)`, placeholder "e.g. Designer" | optional. Server: `job_title` ≤ 80 |
| 2 Where did you study? | `School` typeahead, "Search or enter your school"; one item; note "Preview search uses a small sample list, not live results." | optional; sample catalog (`tasteSearch.ts`) |
| 3 Where are you from? | `Hometown` typeahead, "Search or enter a city"; one item; same sample note | optional |
| 4 What are you into? | 16 chips: Travel, Food, Sports, Music, Art, Movies, Books, Outdoors, Tech, Gaming, Fashion, Wellness, Animals, Nightlife, Culture, Other (key = lowercase label). Counter "N of 10 selected". **D93 servers only:** "Activities (optional) · N of 5" with Running, Walking, Cycling, Hiking, Swimming, Gym, Yoga, Pilates, Dancing, Cooking, Gaming, Photography (`lib/interests/takes.ts:13–26`) | interests **required 1–10**, an 11th is refused; activities 0–5, optional |
| 5 Who do you listen to? | `Artists` search, "Search artists", 0–3 items, "N of 3 added"; note "Suggestions come from public catalogs and need an internet connection." | optional; live catalogs (`liveCatalog.ts`) |
| 6 Books & movies | groups `Books` ("Search books") and `Movies & series` ("Search movies or series"), 0–3 each | optional |

Taste items are stored as `{kind, source, id, title, subtitle?, imageUrl?}`. A typed custom entry is allowed (`customItem`, at least 2 characters). Duplicates by id are refused.

**Branch (D93 servers):** if Continue would remove the subject of a saved conversation starter, the server raises `take_subject_removed`. The app then asks: title `` `Remove ${titles}?` ``, body "A conversation starter is about {titles}. Removing it from your interests also removes that answer. Your other answers stay.", buttons Cancel / Remove (`PreviewFlow.tsx:224–235`, 371–384).
- Cancel → "Not saved. Your interests and conversation starters are unchanged."
- Remove → resaves with `confirm_remove_takes`.

### 3.5 Your Dates (`lib/onboardingV2/yourDates.ts`)

| Step | Content | Rule |
|---|---|---|
| 1 Your ideal first date? | Coffee→`coffee`, Drinks→`drinks`, Dinner→`dinner`, A fun activity→`activity`, A walk→`walk`, Outdoors→`outdoors`; "N of 2 selected" | multi, **1–2**, a third is refused |
| 1 (always below) | **Have a favorite spot?** / "For a first date. Optional." — text field, placeholder "Enter a place name", max 120 | optional; never counts toward step 1 |
| 2 When are you free? | **Days:** Weekdays→`weekdays`, Weekends→`weekends`, Either→`either`. **Time:** Daytime→`daytime`, Evening→`evening`, Either→`either` | one of each, both required. Live summary e.g. "Weekends · Daytime" (+ "Choose the exact time together.") |

**Dinner branch:** there is none. Selecting `dinner` triggers no follow-up in code (grep of `components/onboarding-v2` and `lib/onboardingV2` finds `dinner` only as an option key). `ONBOARDING_FLOW.md` §6 records that the dinner-vibe follow-up was removed; the mockup `section-06.png` still shows it.

### 3.6 Your Profile (`lib/onboardingV2/yourProfile.ts`)

| Step | Content | Rule |
|---|---|---|
| 1 Photos | 6 slots; first slot = "Main photo". Counter "N of 6 photos · add at least 3". Tap to preview; hold and drag to reorder. Sheet actions: Make main photo / Move earlier / Move later / Replace photo / Remove photo. Live tags: "Not saved yet", plus status "Saving photos…" / "All photos saved." | **3–6 usable photos** (`photosValid`, `yourProfile.ts:160–163`); broken photos never count. Duplicates are skipped by library asset id |
| 2 A little more you | 3 cards "Choose a prompt" (Required / Required / Optional). On D93 servers the second card reads "Or a conversation starter" until a starter is saved, then "Optional". Picker categories All / About me / Just for fun / You & me / My everyday, 20 prompts (`promptCatalog.ts`). Editor: 200-character counter, EN/TR examples, "Show another example", "Türkçesi". Counter: legacy "N of 2 required answered"; D93 "N of 2 answers" (`PromptsFields.tsx:206–207`) | `promptsValid` / `answersValid` (see §5). A prompt can be used only once. Answer 1–200 characters |
| 2 (D93) | `TakesEditor` under the cards: "Conversation starters" · "n of 3". Empty hint "Optional. A small detail about an activity, book, film or artist you love." Button "Add a conversation starter". With no subject: "Add an activity, book, film or artist in “Your world” to write one." | starter answer 1–180 characters, one per subject, max 3. Questions per kind: `lib/interests/takes.ts:40–57` |
| 3 Your profile | public preview blocks (`buildPublicProfileBlocks`). Primary `Continue`; secondary `Edit profile` (sheet: Photos, Prompts, Basics, Looking for, Lifestyle, Your world, First dates) | valid = photos valid && answers valid |
| 4 A quick selfie | "Your selfie stays private." / "We'll review it with your profile photos." Buttons `Take selfie` → `Use selfie` + `Retake`. Front camera. Saved state shows "Selfie received". Errors: camera off ("Camera access is off. Allow it in Settings…" + `Open Settings`), unreadable photo, no camera | selfie taken or already uploaded |
| 6 Submit (live) | title/helper by state (`PreviewFlow.tsx:658–667`): **Check your email** / "Confirm your email before you send your application." (+ "Sign in again with the code we send to {email} to confirm it."); **Email verified** / "Send your application and we'll review your profile." (+ email row); **Send your update** / "We'll look at your profile again after you send it." (+ "Our note" card). CTA `Submit application` / `Submit again` / `Sending…` | server `v2_missing_for`. A missing item → Alert "Almost there": "Something still needs an answer." (jumps to the step), or "Please accept the Privacy Notice first (sign in again with your email code)." / "Your email is not confirmed yet. Sign in again with your email code." |
| 7 You're on the list! | `ReceivedFields`; primary (outline) `Review my profile`. Back is disabled | reached only after the server confirms |

Live save errors (`remote.ts:23–29`):
- "Your application was already sent, so answers can no longer be changed."
- "You can add up to 6 photos."
- "No connection. Check your internet and try again."
- otherwise "Could not save. Try again." and similar.

---

## 4. Where answers are stored and who can see them

- **Write path:** client mappers in `lib/onboardingV2/serverMapping.ts:181–256`, RPC calls in `lib/onboardingV2/remote.ts`, SQL in `20260930120000_v2_onboarding_persistence.sql`.
- Clients have no direct write grant. Every write goes through a SECURITY DEFINER RPC (SQL lines 7–9, 178–181).
- All rows are SELECT-own-only (RLS lines 183–192).
- **Public visibility** = the explicit field list of `get_profile_v2`: `20261001090000_v2_public_profile.sql:86–123`; `activities` and `takes` were added in `20261014090000` / `20261015090000`.
- Viewers must be active, mutually eligible V2 members, or already matched (lines 13–22, 71–83). Applicants are not shown to anyone.

| Answer | RPC | Table.column | Public to other members? |
|---|---|---|---|
| First name | `save_onboarding_v2('basics')` | `onboarding_v2.first_name` | **Yes** |
| Last name | same | `onboarding_v2.last_name` | **No** (private) |
| Date of birth | same | `onboarding_v2.date_of_birth` | **No.** Only the derived `age` and `zodiac` are public |
| Gender | same | `onboarding_v2.gender` | No (used for eligibility only) |
| Interested in | same | `onboarding_v2.interested_in` | No (eligibility only) |
| Location | same | `location_id`, `location_city`, `location_district`, `location_label` | `city` **yes**; district / id / label **no** |
| Height | same | `height_cm` (CHECK 90–250) | Yes |
| Intent | `save_onboarding_v2('compatibility')` | `intent` | Yes |
| Other 5 compatibility answers | same | `social_energy`, `message_frequency`, `relationship_space`, `emotional_expression`, `meeting_pace` | **No** |
| Values | same | `core_values` | Yes |
| Smoking, drinking, pets, pet kind, activity | `save_onboarding_v2('yourLife')` | `smoking`, `drinking`, `pets`, `pet_kind`, `activity` | Yes |
| Work, job, school, hometown, interests, artists, books, screen | `save_onboarding_v2('yourWorld')` | same-named columns (jsonb for taste items) | Yes |
| Activities (D93 servers) | same | `onboarding_v2.activities` (≤ 5) | Yes |
| Date types, favorite spot, days, time | `save_onboarding_v2('yourDates')` | `date_types`, `favorite_spot`, `days_pref`, `time_pref` | Yes |
| Resume position | every `save_onboarding_v2` | `resume_section`, `resume_step` | No |
| Prompts | `save_prompts_v2` (delete + re-insert) | `profile_prompts_v2(slot, prompt_id, answer)`, unique (user, prompt), answer 1–200 | Yes |
| Conversation starters | `save_take_v2` / `delete_take_v2` | `profile_takes_v2` | Yes (`takes`) |
| Photos | Storage upload `profile-photos-private/{uid}/…` + `add_profile_photo_v2`, `reorder_profile_photos_v2`, `delete_profile_photo_v2` | `profile_photos_v2(storage_path, position 1–6)` | Yes; paths are returned and shown through signed URLs |
| Selfie | Storage upload `verification-selfies/{uid}/…` + `set_verification_selfie_v2` | `account_state_v2.selfie_path` | **No** (private bucket; the reviewer RPC strips `selfie_path`) |
| Email | Supabase Auth (`signInWithOtp` / `verifyOtp`) | `auth.users.email`, `email_confirmed_at` | **No** |
| Consent | client update after verify | `profiles.privacy_consent_at` | No |
| Application state | `submit_application_v2` only | `account_state_v2.application_status` / `verification_status` / `membership_status` | No |

`get_profile_v2` header comment (lines 9–11) says this is never returned: "surname, date of birth, gender / interested-in, district, location id/label, coordinates, email, phone, selfie, the six compatibility answers". The six compatibility answers are listed there, yet the function body returns `intent` (line 100), and so does `buildPublicProfileBlocks` ("Looking for"). Code shows `intent` **is** public. The comment's "six" appears inconsistent.

---

## 5. D93 rule: "2 standard answers OR 1 standard + 1 conversation starter"

### Client — `lib/onboardingV2/yourProfile.ts`

```ts
// 218–223
export function promptsValid(list: PromptAnswer[]): boolean {
  const filled = list.filter(answerFilled);
  if (filled.length < REQUIRED_PROMPTS) return false;
  if (new Set(filled.map((a) => a.promptId)).size !== filled.length) return false;
  return list.every((a) => a.answer.length <= ANSWER_MAX_LENGTH);
}
// 228–233
export function answersValid(list: PromptAnswer[], takeCount: number): boolean {
  if (promptsValid(list)) return true;
  if (takeCount < 1) return false;
  const filled = list.filter(answerFilled);
  return filled.length >= 1 && new Set(filled.map((a) => a.promptId)).size === filled.length && list.every((a) => a.answer.length <= ANSWER_MAX_LENGTH);
}
```

- `answerFilled` (line 188–190): a prompt id is set, the trimmed answer is non-empty, and the length is ≤ 200.
- `takeCount` = `profile.takes.length` (line 234). In live mode this is the server's saved starters list from `get_my_interests_v2` (`PreviewFlow.tsx:209–212`). The client does not check a starter's subject or answer itself.
- Used for step 2, step 3 and the checklist (lines 334, 363, 365).
- D93 UI is active only when `takesSupported = !!live && starters !== null` (`PreviewFlow.tsx:208`). Otherwise `takes` is `[]` / undefined, so 2 prompts are required.
- `PromptsFields.tsx:66–67` and `79`: `requiredCount` = 1 with a starter, else 2. `d93Have = min(filled,2) + (filled===1 && starters>0 ? 1 : 0)`.

### Server — `supabase/proposed/20261016090000_v2_onboarding_takes.sql`

```sql
-- 43–48
create or replace function public.v2_valid_take_count(p_uid uuid) ...
  select count(*)::int from profile_takes_v2 t join onboarding_v2 o on o.user_id = t.user_id
  where t.user_id = p_uid and btrim(t.answer) <> '' and public.v2_take_subject_title(o, t.subject_kind, t.subject_id) is not null
-- 74–78 (inside v2_missing_for)
case when not (
       (select count(*) from profile_prompts_v2 p where p.user_id = p_uid and btrim(p.answer) <> '') >= 2
    or ((select count(*) from profile_prompts_v2 p where p.user_id = p_uid and btrim(p.answer) <> '') >= 1
        and public.v2_valid_take_count(p_uid) >= 1))
     then 'yourProfile.prompts' end,
```

- `submit_application_v2` refuses when anything is missing (persistence SQL 620–640).
- Pre-D93 servers use `20260930120000…sql:604`: `count(*) from profile_prompts_v2 < 2`.

### What counts as valid

| | Client | Server |
|---|---|---|
| Standard answer | prompt chosen, trimmed answer non-empty, ≤ 200 characters, prompt not used twice | saved row with `btrim(answer) <> ''`. The table enforces 1–200 characters and unique (user, prompt_id); `prompt_id` must exist in `prompt_catalog_v2` |
| Starter | any entry in the server-loaded `takes` list (count ≥ 1) | non-blank answer **and** its subject is still in the saved selections (`v2_take_subject_title`). Writes are limited to 1–180 characters, 8 fixed question ids, ≤ 3 per member, one per subject |
| Rule | ≥ 2 standard, or (≥ 1 standard and ≥ 1 starter). Starters alone never pass | same |

### Differences found

1. **Timing.** The client checks unsaved local prompt state. The server counts rows saved by `save_prompts_v2`, which runs on Continue from step 2 (`PreviewFlow.tsx:390–392`).
2. **Starter validity.** The client trusts the list count. The server also requires the subject to still be saved. The two stay in sync because subject removal deletes starters atomically and the app reloads them (`PreviewFlow.tsx:384`). Not verified for every edge case.
3. **Unreachable copy.** The D93 missing text "Answer 2 questions, or 1 question and a conversation starter." (`PreviewFlow.tsx:514`) sits in `MISSING_TEXT`. That object is used only in the non-live `submit()` path (`550–567`), while `takesSupported` requires live mode, so the text is never shown. Live mode shows "Something still needs an answer." instead.
4. **Stale copy in docs.** The "Prefer one prompt? …" note named in D100 (`DECISIONS.md:251`) is not in code. Round 6 says it "was removed" (`V2_INTERESTS_TAKES_RESULT.md:18`), and the check script asserts its absence (`scripts/onboarding-v2-checks/v2_interests_takes.check.js:114`).

### Servers with the package

- `DECISIONS.md:245`: "**LOCAL Supabase only**".
- SQL header lines 5–6: "NOT applied to the shared remote project (DEV = live). Applied and verified only on the LOCAL Supabase (tempa-local)".
- It is listed in `scripts/local-backend/setup.mjs:38`. The check script asserts it is absent from `scripts/dev-backend/apply-dev.mjs`.
- **Consequence:** on the DEV backend (perfect-match-dev, where V2 persistence was applied per `V2_DEV_APPLY_RESULT.md`), the old rule applies (2 prompts) and no starters or activities appear in onboarding.

### Phone validation of the second path: **NOT confirmed**

- `V2_INTERESTS_TAKES_RESULT.md:10` (Round 6, owner's phone result): "all three standard prompts were filled, so the **"one standard + one conversation starter" path is not yet verified on the phone**".
- Same doc, lines 38–51: "Next phone test (not done)".
- `DECISIONS.md:251` (D100): "phone test pending".
- `V2_LOCAL_REVIEW_RESULT.md:59`: "The open **D93 phone test** (one standard answer + one conversation starter) is **not** completed".
- `V2_SHARED_INTERESTS_RESULT.md:9`: still "remain open".
- Server-side, the path is covered by `smoke_onboarding_takes_local` (18/18, local services; result doc lines 147–161). That is not a phone test.

---

## 6. Screenshots

### Existing images in the repo

The only onboarding images are `docs/tempa/mockups/section-0[1-7].png`. All are **design mockups (handoff renders), not screenshots of the current app**. Their copy, flow and data differ from the code.

| File | Shows | Differences from the current app |
|---|---|---|
| `section-01.png` | Welcome "People, not profiles." / Get started / Log in / How membership works; phone number; SMS code | the app uses an email code; the welcome is not built |
| `section-02.png` | Basics 1–6 (name, birthday dropdowns, gender, interested in, location with "Use my location", vertical height ruler) | the app uses Day/Month/Year text fields, a horizontal ruler and no GPS link |
| `section-03.png` | Compatibility 1–7 with older copy and subtitles ("A long-term relationship", "In a relationship, I value…") | copy superseded by D50/D51 |
| `section-04.png` | Your Life 1–4 with icons and older wording ("Occasionally", "How do pets fit into your life?") | wording differs; pet-kind chips are similar |
| `section-05.png` | Your World 1–6 ("Choose 3–10 interests", artist photos, book covers) | the app requires 1–10 interests, uses different titles and lists Activities on D93 servers |
| `section-06.png` | Your Dates with photo cards, "Something to do", dinner-vibe follow-up | dinner vibe was removed and the app uses icon cards |
| `section-07.png` | Your Profile in 8 steps ("Two little things about you", "Ready to submit?", "Application received") | the app has 7 states, no "Ready to submit?" step, and the live flow has no email step |

Other PNGs are unrelated to onboarding: app icons in `assets/images/*` and demo photos for the Discover / Activity previews in `assets/dev/*`. No real-app onboarding screenshots exist in the repo.

### Missing shots (needed)

| # | Screen | Route / how to reach | States to capture |
|---|---|---|---|
| 1 | Signed-out landing | `/` signed out | DEV build (with DEV buttons) and, if possible, a non-DEV build (`Log In` / `Sign Up` only) |
| 2 | Account · email | `Sign Up` or "… · Join with new onboarding" → `/v2/welcome` | empty (Send code disabled); filled + consent checked; error (rate limit / send failed) |
| 3 | Account · code | after Send code | empty; filled (6 digits); error ("That code isn’t valid or has expired…"); resend cooldown "Resend code in Ns" |
| 4 | Compatibility 3.1 "What are you looking for?" | `/v2/onboarding`, Compatibility 1 of 7 | empty (Continue disabled); filled |
| 5a | "A little more you" — legacy / 2-prompt path | Your Profile 2 of 7 on a non-D93 server (DEV) | empty; 1 filled ("1 of 2 required answered"); 2 filled |
| 5b | "A little more you" — D93 path | same step on LOCAL (D93 package) | empty ("Or a conversation starter"); 1 prompt + 1 starter ("Optional", "2 of 2 answers"); starter editor open |
| 6 | Submit (step 6) | Your Profile 6 of 7, live | "Email verified" (ready); "Check your email" (unconfirmed); "Send your update" + "Our note" (changes requested); error ("Almost there" alert / save error); "Sending…" |
| 7 | You're on the list! | after a successful submit | the in-flow step 7 with title |
| 8 | `/v2/status` | relaunch after submit | submitted (ReceivedFields without title); rejected text; error / unreadable text |

---

## 7. Open points / not verified

1. **Pet kind mismatch.** The client never requires "What kind?" (`yourLife.ts:98`). The server marks `yourLife.pet_kind` missing when `pets = have_pets` and `pet_kind` is null (`20261016090000…sql:68`). Result: Continue passes, but submit stops with "Something still needs an answer." and jumps back to Your Life 3.
2. **Height mismatch.** The client accepts 1–999 cm. The server CHECK is 90–250. An out-of-range value fails on save with a generic error. Names and job title have server length limits (1–50 / ≤ 80) but no client limit.
3. **Selfie notice in live mode.** `SelfieFields.tsx:109` shows "Preview only — this selfie is not uploaded or reviewed." even in live mode, where the selfie is uploaded. Whether this appears on a phone is not verified.
4. **Location gap.** The client requires a selected suggestion. The server only checks `location_city`.
5. **Status gaps.** `/v2/status` has no "You're on the list!" title. Accepted-but-not-active and `unavailable` gates show the generic "We couldn't read your application status."
6. **Spec Welcome not built.** "People, not profiles." / Get started / How membership works exist only in the DEV design preview. Phone OTP is not built (email code instead).
7. **D93 phone test.** The 1 standard + 1 starter path is not confirmed on a phone (§5). D93 exists only on LOCAL Supabase, not on DEV.
8. **Unreachable D93 copy.** The D93 missing-text variant is never shown in live mode (§5, difference 3).
9. **Stale SQL headers.** `20260930120000_v2_onboarding_persistence.sql` still says "PROPOSED, NOT APPLIED". `V2_DEV_APPLY_RESULT.md` says it was applied to perfect-match-dev on 2026-09-30. This document did not check the actual database state (no DB access used): **not verified**.
10. **`get_profile_v2` comment.** It lists "the six compatibility answers" as never returned, but `intent` is returned (§4).
11. **Concurrent edit.** `app/(tabs)/index.tsx` gained a `DEV · Design preview` button during this inventory. The landing table reflects the file as it is now.
12. **Not run.** No app, server or phone run was done for this document. All behaviour above is from static reading of code and docs.
