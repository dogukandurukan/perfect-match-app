// Profile → Edit profile (Package 1, owner 2026-10-27): the few PUBLIC details
// an approved member may change — Looking for (optional), height, work status
// (optional), lifestyle and first-date type / days / time. Pure (no React
// Native), so it is testable in Node.
//
// Saving sends only the changed fields plus the values this screen loaded for
// them; the server (update_member_profile_v2) refuses anything else and
// reports a change made elsewhere instead of overwriting it. Private
// preferences (D104b) are never read or written here, and
// nothing is derived from them.
import { SINGLE_QUESTIONS } from '@/lib/onboardingV2/compatibility';
import { DATE_TYPES, DAY_OPTIONS, MAX_DATE_TYPES, MIN_DATE_TYPES, TIME_OPTIONS } from '@/lib/onboardingV2/yourDates';
import { HAVE_PETS, LIFE_QUESTIONS, PET_KIND_OPTIONS } from '@/lib/onboardingV2/yourLife';
import { WORK_OPTIONS } from '@/lib/onboardingV2/yourWorld';

export type MemberFields = {
  intent: string | null;
  heightCm: number | null;
  workStatus: string | null;
  smoking: string | null;
  drinking: string | null;
  pets: string | null;
  petKind: string | null;
  activity: string | null;
  dateTypes: string[];
  days: string | null;
  time: string | null;
};
export type FieldKey = keyof MemberFields;

export type SectionId = 'lookingFor' | 'height' | 'work' | 'lifestyle' | 'dates';
export const SECTION_FIELDS: Record<SectionId, FieldKey[]> = {
  lookingFor: ['intent'],
  height: ['heightCm'],
  work: ['workStatus'],
  lifestyle: ['smoking', 'drinking', 'pets', 'petKind', 'activity'],
  dates: ['dateTypes', 'days', 'time'],
};
export const SECTION_TITLES: Record<SectionId, string> = {
  lookingFor: 'Looking for',
  height: 'Height',
  work: 'Work',
  lifestyle: 'Lifestyle',
  dates: 'First dates',
};
export const isSectionId = (s: unknown): s is SectionId => typeof s === 'string' && s in SECTION_FIELDS;

export const MIN_HEIGHT_CM = 90;
export const MAX_HEIGHT_CM = 250;

const SERVER_KEY: Record<FieldKey, string> = {
  intent: 'intent',
  heightCm: 'height_cm',
  workStatus: 'work_status',
  smoking: 'smoking',
  drinking: 'drinking',
  pets: 'pets',
  petKind: 'pet_kind',
  activity: 'activity',
  dateTypes: 'date_types',
  days: 'days_pref',
  time: 'time_pref',
};
/** The only server keys this screen may send (mirrors the server allow-list). */
export const EDITABLE_SERVER_KEYS = Object.values(SERVER_KEY);

const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

/** From get_my_onboarding_v2's draft (or the save result's `profile`). */
export function fieldsFromServer(d: Record<string, unknown> | null | undefined): MemberFields {
  const x = d ?? {};
  const h = typeof x.height_cm === 'number' ? x.height_cm : Number(x.height_cm);
  return {
    intent: str(x.intent),
    heightCm: Number.isFinite(h) && h > 0 ? h : null,
    workStatus: str(x.work_status),
    smoking: str(x.smoking),
    drinking: str(x.drinking),
    pets: str(x.pets),
    petKind: str(x.pet_kind),
    activity: str(x.activity),
    dateTypes: Array.isArray(x.date_types) ? x.date_types.filter((t): t is string => typeof t === 'string') : [],
    days: str(x.days_pref),
    time: str(x.time_pref),
  };
}

const toServerValue = (k: FieldKey, f: MemberFields): unknown => f[k];
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Pet kind only goes with "I have pets"; any other answer clears it. */
export function normalise(f: MemberFields): MemberFields {
  return f.pets === HAVE_PETS ? f : { ...f, petKind: null };
}

/**
 * The changed fields of one section as server keys, plus the loaded values
 * for exactly those keys (the server's field-level conflict check).
 */
export function changesFor(section: SectionId, loaded: MemberFields, draft: MemberFields): { changes: Record<string, unknown>; expected: Record<string, unknown> } {
  const d = normalise(draft);
  const changes: Record<string, unknown> = {};
  const expected: Record<string, unknown> = {};
  for (const k of SECTION_FIELDS[section]) {
    if (same(toServerValue(k, d), toServerValue(k, loaded))) continue;
    changes[SERVER_KEY[k]] = toServerValue(k, d);
    expected[SERVER_KEY[k]] = toServerValue(k, loaded);
  }
  return { changes, expected };
}

export const isDirty = (section: SectionId, loaded: MemberFields, draft: MemberFields): boolean =>
  Object.keys(changesFor(section, loaded, draft).changes).length > 0;

const oneOf = (v: string | null, opts: { key: string }[]) => v !== null && opts.some((o) => o.key === v);
const intentQ = SINGLE_QUESTIONS.find((q) => q.id === 'intent')!;
const lifeQ = (id: string) => LIFE_QUESTIONS.find((q) => q.id === id)!;

/** Why Save is disabled (null = the section is valid). */
export function sectionProblem(section: SectionId, f: MemberFields): string | null {
  switch (section) {
    case 'lookingFor':
      return f.intent === null || oneOf(f.intent, intentQ.options) ? null : 'Choose one option.';
    case 'height':
      return f.heightCm !== null && Number.isInteger(f.heightCm) && f.heightCm >= MIN_HEIGHT_CM && f.heightCm <= MAX_HEIGHT_CM
        ? null
        : `Choose a height between ${MIN_HEIGHT_CM} and ${MAX_HEIGHT_CM} cm.`;
    case 'work':
      return f.workStatus === null || oneOf(f.workStatus, WORK_OPTIONS) ? null : 'Choose one option.';
    case 'lifestyle':
      if (!(['smoking', 'drinking', 'pets', 'activity'] as const).every((k) => oneOf(f[k], lifeQ(k).options))) return 'Answer each question.';
      if (f.pets === HAVE_PETS && !oneOf(f.petKind, PET_KIND_OPTIONS)) return 'Choose what kind of pet.';
      return null;
    case 'dates':
      if (f.dateTypes.length < MIN_DATE_TYPES || f.dateTypes.length > MAX_DATE_TYPES || !f.dateTypes.every((t) => DATE_TYPES.some((d) => d.key === t)))
        return 'Choose 1 or 2 kinds of first date.';
      if (!oneOf(f.days, DAY_OPTIONS) || !oneOf(f.time, TIME_OPTIONS)) return 'Choose days and a time.';
      return null;
  }
}

// ─── Short summaries for the Edit profile list ────────────────────────────
const titleOf = (opts: { key: string; title?: string; label?: string }[], k: string | null) => {
  const o = opts.find((x) => x.key === k);
  return o ? (o.title ?? o.label ?? null) : null;
};
export function sectionSummary(section: SectionId, f: MemberFields): string {
  switch (section) {
    case 'lookingFor':
      return titleOf(intentQ.options, f.intent) ?? 'Not shown on your profile';
    case 'height':
      return f.heightCm ? `${f.heightCm} cm` : 'Not set';
    case 'work':
      return titleOf(WORK_OPTIONS, f.workStatus) ?? 'Not set';
    case 'lifestyle':
      return [titleOf(lifeQ('smoking').options, f.smoking), titleOf(lifeQ('drinking').options, f.drinking), titleOf(lifeQ('pets').options, f.pets)]
        .filter(Boolean)
        .join(' · ') || 'Not set';
    case 'dates': {
      const types = f.dateTypes.map((t) => DATE_TYPES.find((d) => d.key === t)?.label).filter(Boolean).join(' · ');
      const when = [DAY_OPTIONS.find((o) => o.key === f.days)?.summary, TIME_OPTIONS.find((o) => o.key === f.time)?.summary].filter(Boolean).join(' · ');
      return [types, when].filter(Boolean).join(' — ') || 'Not set';
    }
  }
}

// ─── Save errors → copy ───────────────────────────────────────────────────
export type SaveFailure = { text: string; changed: boolean };
export function saveError(code: string | null | undefined): SaveFailure {
  switch (code) {
    case 'profile_changed':
      return { text: 'Your profile changed on another screen or device. Reload to see the latest.', changed: true };
    case 'not_member':
      return { text: 'Profile editing is only available to approved members.', changed: false };
    case 'invalid_value':
    case 'field_not_editable':
    case 'invalid_request':
      return { text: 'That can’t be saved. Check your choices and try again.', changed: false };
    default:
      return { text: 'Couldn’t save. Check your connection and try again.', changed: false };
  }
}

/** Whole years from an ISO birth date (null when missing / invalid). */
export function ageFromIso(iso: unknown, now: Date = new Date()): number | null {
  if (typeof iso !== 'string') return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  let a = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) a -= 1;
  return a;
}
