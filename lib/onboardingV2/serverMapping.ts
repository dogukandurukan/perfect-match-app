// Onboarding V2 ⇄ server mapping (pure — no React / Supabase imports, so it is
// testable in Node: scripts/p0-checks/v2_mapping.check.mjs). Column names
// and value keys are those of supabase/proposed/20260930120000_v2_onboarding_persistence.sql,
// which uses the V2 code keys unchanged.
import type { BasicsDraft, Gender, InterestedIn } from './basics';
import type { CompatDraft } from './compatibility';
import type { FlowPos, SectionId } from './previewFlow';
import type { DatesDraft, DaysKey, TimeKey } from './yourDates';
import type { LifeDraft } from './yourLife';
import type { LocalPhoto, PromptAnswer, PublicProfileInput } from './yourProfile';
import type { TasteItem, WorldDraft } from './yourWorld';

export type ServerDraft = {
  resume_section: SectionId | null;
  resume_step: number | null;
  first_name: string | null;
  last_name: string | null;
  date_of_birth: string | null; // YYYY-MM-DD
  gender: string | null;
  interested_in: string[] | null;
  location_id: string | null;
  location_city: string | null;
  location_district: string | null;
  location_label: string | null;
  height_cm: number | null;
  intent: string | null;
  social_energy: string | null;
  message_frequency: string | null;
  relationship_space: string | null;
  emotional_expression: string | null;
  meeting_pace: string | null;
  core_values: string[] | null;
  smoking: string | null;
  drinking: string | null;
  pets: string | null;
  pet_kind: string | null;
  activity: string | null;
  work_status: string | null;
  job_title: string | null;
  school: TasteItem | null;
  hometown: TasteItem | null;
  interests: string[] | null;
  artists: TasteItem[] | null;
  books: TasteItem[] | null;
  screen: TasteItem[] | null;
  date_types: string[] | null;
  favorite_spot: string | null;
  days_pref: string | null;
  time_pref: string | null;
};

export type ServerBundle = {
  draft: Partial<ServerDraft> | null;
  prompts: { slot: number; prompt_id: string; answer: string }[];
  photos: { id: string; path: string; position: number }[];
  state: {
    application_status: 'draft' | 'submitted' | 'accepted' | 'rejected' | 'changes_requested';
    verification_status: string;
    membership_status: string;
    has_selfie: boolean;
    submitted_at: string | null;
    /** Only while application_status = 'changes_requested'. */
    review_note?: string | null;
    review_items?: string[] | null;
  } | null;
  email: { address: string | null; confirmed: boolean } | null;
};

const pad = (n: number) => String(n).padStart(2, '0');

// ─── server → drafts ────────────────────────────────────────────────────────

export function basicsFromServer(d: Partial<ServerDraft>): BasicsDraft {
  const [y, m, day] = d.date_of_birth ? d.date_of_birth.split('-') : ['', '', ''];
  const location =
    d.location_id && d.location_city && d.location_label
      ? {
          id: d.location_id,
          kind: d.location_district ? ('district' as const) : ('city' as const),
          city: d.location_city,
          district: d.location_district ?? null,
          country: 'Turkey' as const,
          label: d.location_label,
        }
      : null;
  return {
    firstName: d.first_name ?? '',
    lastName: d.last_name ?? '',
    dobDay: day ? String(Number(day)) : '',
    dobMonth: m ? String(Number(m)) : '',
    dobYear: y ?? '',
    gender: (d.gender as Gender | null) ?? null,
    interestedIn: (d.interested_in as InterestedIn[] | null) ?? [],
    locationQuery: location?.label ?? '',
    location,
    heightCm: d.height_cm ? String(d.height_cm) : '',
  };
}

export function compatFromServer(d: Partial<ServerDraft>): CompatDraft {
  return {
    intent: d.intent ?? null,
    socialEnergy: d.social_energy ?? null,
    messageFrequency: d.message_frequency ?? null,
    relationshipSpace: d.relationship_space ?? null,
    emotionalExpression: d.emotional_expression ?? null,
    meetingPace: d.meeting_pace ?? null,
    values: d.core_values ?? [],
  };
}

export function lifeFromServer(d: Partial<ServerDraft>): LifeDraft {
  return {
    smoking: d.smoking ?? null,
    drinking: d.drinking ?? null,
    pets: d.pets ?? null,
    activity: d.activity ?? null,
    petKind: d.pet_kind ?? null,
  };
}

export function worldFromServer(d: Partial<ServerDraft>): WorldDraft {
  return {
    workStatus: d.work_status ?? null,
    jobTitle: d.job_title ?? '',
    school: d.school ?? null,
    hometown: d.hometown ?? null,
    interests: d.interests ?? [],
    artists: d.artists ?? [],
    books: d.books ?? [],
    screen: d.screen ?? [],
  };
}

export function datesFromServer(d: Partial<ServerDraft>): DatesDraft {
  return {
    dateTypes: d.date_types ?? [],
    spotText: d.favorite_spot ?? '',
    days: (d.days_pref as DaysKey | null) ?? null,
    time: (d.time_pref as TimeKey | null) ?? null,
  };
}

/** Server prompts → the 3 UI slots (empty slots stay empty). */
export function promptsFromServer(rows: ServerBundle['prompts']): PromptAnswer[] {
  const slots: PromptAnswer[] = [1, 2, 3].map(() => ({ promptId: null, answer: '' }));
  for (const r of rows) if (r.slot >= 1 && r.slot <= 3) slots[r.slot - 1] = { promptId: r.prompt_id, answer: r.answer };
  return slots;
}

/** Server photos (already signed) → LocalPhoto entries that carry their server id. */
export function photosFromServer(rows: ServerBundle['photos'], signed: Map<string, string | null>): LocalPhoto[] {
  return [...rows]
    .sort((a, b) => a.position - b.position)
    .map((r) => ({ id: `server:${r.id}`, uri: signed.get(r.path) ?? '', serverId: r.id, path: r.path, broken: !signed.get(r.path) }));
}

const SECTIONS: SectionId[] = ['basics', 'compatibility', 'yourLife', 'yourWorld', 'yourDates', 'yourProfile'];

// Steps per section (mirrors lib/onboardingV2/previewFlow.ts SECTIONS). In
// live mode Your Profile resumes at most on the submit screen (6): the
// email-entry step (5) is skipped and "received" (7) needs a real submission.
const MAX_STEP: Record<SectionId, number> = {
  basics: 6, compatibility: 7, yourLife: 4, yourWorld: 6, yourDates: 2, yourProfile: 6,
};

export function resumePos(d: Partial<ServerDraft> | null): FlowPos {
  if (!d?.resume_section || !SECTIONS.includes(d.resume_section)) return { section: 'basics', step: 1 };
  const section = d.resume_section;
  let step = d.resume_step && d.resume_step >= 1 ? Math.min(d.resume_step, MAX_STEP[section]) : 1;
  if (section === 'yourProfile' && step === 5) step = 6;
  return { section, step };
}

// ─── drafts → server payloads (whole section; unanswered = null) ───────────

export function basicsToServer(b: BasicsDraft, dobIso: string | null): Record<string, unknown> {
  const h = /^\d{1,3}$/.test(b.heightCm) ? Number(b.heightCm) : null;
  return {
    first_name: b.firstName.trim() || null,
    last_name: b.lastName.trim() || null,
    date_of_birth: dobIso,
    gender: b.gender,
    interested_in: b.interestedIn.length ? b.interestedIn : null,
    location_id: b.location?.id ?? null,
    location_city: b.location?.city ?? null,
    location_district: b.location?.district ?? null,
    location_label: b.location?.label ?? null,
    height_cm: h,
  };
}

export function dobToIso(date: Date | null): string | null {
  return date ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` : null;
}

export function compatToServer(c: CompatDraft): Record<string, unknown> {
  return {
    intent: c.intent,
    social_energy: c.socialEnergy,
    message_frequency: c.messageFrequency,
    relationship_space: c.relationshipSpace,
    emotional_expression: c.emotionalExpression,
    meeting_pace: c.meetingPace,
    core_values: c.values.length ? c.values : null,
  };
}

export function lifeToServer(l: LifeDraft): Record<string, unknown> {
  return {
    smoking: l.smoking,
    drinking: l.drinking,
    pets: l.pets,
    pet_kind: l.pets === 'have_pets' ? l.petKind : null,
    activity: l.activity,
  };
}

const cleanItem = (i: TasteItem | null) =>
  i ? { kind: i.kind, source: i.source, id: i.id, title: i.title, ...(i.subtitle ? { subtitle: i.subtitle } : {}),
        ...(i.imageUrl ? { imageUrl: i.imageUrl } : {}) } : null;

export function worldToServer(w: WorldDraft): Record<string, unknown> {
  return {
    work_status: w.workStatus,
    job_title: w.jobTitle.trim() || null,
    school: cleanItem(w.school),
    hometown: cleanItem(w.hometown),
    interests: w.interests.length ? w.interests : null,
    artists: w.artists.map(cleanItem),
    books: w.books.map(cleanItem),
    screen: w.screen.map(cleanItem),
  };
}

export function datesToServer(d: DatesDraft): Record<string, unknown> {
  return {
    date_types: d.dateTypes.length ? d.dateTypes : null,
    favorite_spot: d.spotText.trim() || null,
    days_pref: d.days,
    time_pref: d.time,
  };
}

export function promptsToServer(list: PromptAnswer[]): { slot: number; prompt_id: string; answer: string }[] {
  return list
    .map((a, i) => ({ slot: i + 1, prompt_id: a.promptId ?? '', answer: a.answer.trim() }))
    .filter((a) => a.prompt_id && a.answer);
}

// ─── submit: server "missing" keys → where to send the user ────────────────

const MISSING_POS: Record<string, FlowPos> = {
  'basics.name': { section: 'basics', step: 1 },
  'basics.birthday': { section: 'basics', step: 2 },
  'basics.gender': { section: 'basics', step: 3 },
  'basics.interested_in': { section: 'basics', step: 4 },
  'basics.location': { section: 'basics', step: 5 },
  'basics.height': { section: 'basics', step: 6 },
  'compatibility.answers': { section: 'compatibility', step: 1 },
  'compatibility.values': { section: 'compatibility', step: 7 },
  'yourLife.answers': { section: 'yourLife', step: 1 },
  'yourLife.pet_kind': { section: 'yourLife', step: 3 },
  'yourWorld.interests': { section: 'yourWorld', step: 4 },
  'yourDates.date_types': { section: 'yourDates', step: 1 },
  'yourDates.when': { section: 'yourDates', step: 2 },
  'yourProfile.photos': { section: 'yourProfile', step: 1 },
  'yourProfile.prompts': { section: 'yourProfile', step: 2 },
  'yourProfile.selfie': { section: 'yourProfile', step: 4 },
};

export function firstMissingPos(missing: string[]): FlowPos | null {
  for (const key of Object.keys(MISSING_POS)) if (missing.includes(key)) return MISSING_POS[key];
  return null;
}

// ─── another member's public profile (get_profile_v2) ──────────────────────

/** Exactly the fields get_profile_v2 returns (supabase/proposed/20261001090000_v2_public_profile.sql). */
export type ServerPublicProfile = {
  user_id: string;
  first_name: string | null;
  age: number | null;
  zodiac: string | null;
  city: string | null;
  height_cm: number | null;
  work_status: string | null;
  job_title: string | null;
  school: TasteItem | null;
  hometown: TasteItem | null;
  intent: string | null;
  core_values: string[] | null;
  interests: string[] | null;
  smoking: string | null;
  drinking: string | null;
  pets: string | null;
  pet_kind: string | null;
  activity: string | null;
  artists: TasteItem[] | null;
  books: TasteItem[] | null;
  screen: TasteItem[] | null;
  date_types: string[] | null;
  favorite_spot: string | null;
  days_pref: string | null;
  time_pref: string | null;
  prompts: { slot: number; prompt_id: string; answer: string }[] | null;
  photo_paths: string[] | null;
};

/** Server public profile + signed photo URLs → the shared preview input. Photos
 * that could not be signed are dropped (never shown as a broken slot). */
export function publicProfileFromServer(p: ServerPublicProfile, signed: Map<string, string | null>): PublicProfileInput {
  const photos: LocalPhoto[] = (p.photo_paths ?? [])
    .map((path) => ({ path, uri: signed.get(path) ?? '' }))
    .filter((x) => !!x.uri)
    .map((x) => ({ id: `public:${x.path}`, uri: x.uri, path: x.path }));
  return {
    name: (p.first_name ?? '').trim(),
    age: typeof p.age === 'number' ? p.age : null,
    zodiac: p.zodiac ?? null,
    city: p.city ?? null,
    heightCm: typeof p.height_cm === 'number' ? p.height_cm : null,
    workStatus: p.work_status ?? null,
    jobTitle: p.job_title ?? '',
    school: p.school ?? null,
    hometown: p.hometown ?? null,
    intent: p.intent ?? null,
    values: p.core_values ?? [],
    interests: p.interests ?? [],
    life: lifeFromServer(p),
    dates: datesFromServer(p),
    artists: p.artists ?? [],
    books: p.books ?? [],
    screen: p.screen ?? [],
    prompts: [...(p.prompts ?? [])].sort((a, b) => a.slot - b.slot).map((r) => ({ promptId: r.prompt_id, answer: r.answer })),
    photos,
  };
}
