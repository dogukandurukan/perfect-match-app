// Tempa onboarding V2 — Section 4 Your Life (P04): approved copy (D52/D53,
// docs/tempa/ONBOARDING_FLOW.md §4) and pure draft logic. All keys here are
// local preview keys only and do NOT approve a backend schema or scoring.
// Personal habits never derive partner restrictions (D23).

export const YOUR_LIFE_TOTAL_STEPS = 4;

export type LifeIcon = { family: 'mci' | 'ion'; name: string };
export type LifeKey = 'smoking' | 'drinking' | 'pets' | 'activity';

export type LifeQuestion = {
  id: LifeKey;
  title: string;
  helper?: string;
  options: { key: string; title: string }[];
};

export const HAVE_PETS = 'have_pets';

export const LIFE_QUESTIONS: LifeQuestion[] = [
  {
    id: 'smoking',
    title: 'Do you smoke?',
    options: [
      { key: 'no', title: 'No' },
      { key: 'sometimes', title: 'Sometimes' },
      { key: 'yes', title: 'Yes' },
    ],
  },
  {
    id: 'drinking',
    title: 'Do you drink alcohol?',
    options: [
      { key: 'none', title: "I don't drink" },
      { key: 'sometimes', title: 'Sometimes' },
      { key: 'regularly', title: 'Regularly' },
    ],
  },
  {
    id: 'pets',
    title: 'How do you feel about pets?',
    options: [
      { key: HAVE_PETS, title: 'I have pets' },
      { key: 'like_no_pets', title: 'No pets, but I like them' },
      { key: 'neutral', title: "I'm neutral about pets" },
      { key: 'rather_not', title: "I'd rather not live with pets" },
    ],
  },
  {
    id: 'activity',
    title: 'How active are you?',
    helper: 'Physical activity',
    options: [
      { key: 'very', title: 'Very active' },
      { key: 'somewhat', title: 'Somewhat active' },
      { key: 'not_very', title: 'Not very active' },
    ],
  },
];

export const PET_KIND_TITLE = 'What kind?';
// "Both" = dog and cat; its icon is the dog and cat glyphs side by side.
export const PET_KIND_OPTIONS: { key: string; label: string; icons: LifeIcon[] }[] = [
  { key: 'dog', label: 'Dog', icons: [{ family: 'mci', name: 'dog' }] },
  { key: 'cat', label: 'Cat', icons: [{ family: 'mci', name: 'cat' }] },
  { key: 'both', label: 'Both', icons: [{ family: 'mci', name: 'dog' }, { family: 'mci', name: 'cat' }] },
  { key: 'other', label: 'Other', icons: [{ family: 'ion', name: 'paw-outline' }] },
];

export type LifeDraft = Record<LifeKey, string | null> & { petKind: string | null };

export const EMPTY_LIFE_DRAFT: LifeDraft = {
  smoking: null,
  drinking: null,
  pets: null,
  activity: null,
  petKind: null,
};

/** Selecting a primary answer. Moving the pets answer away from "I have
 * pets" clears the contextual pet kind so it never stays in active answers. */
export function selectLifeAnswer(d: LifeDraft, id: LifeKey, key: string): Partial<LifeDraft> {
  if (id === 'pets' && key !== HAVE_PETS) return { pets: key, petKind: null };
  return { [id]: key } as Partial<LifeDraft>;
}

/** Pet kind is only accepted while "I have pets" is the primary answer;
 * tapping the selected kind again deselects it. */
export function selectPetKind(d: LifeDraft, key: string): Partial<LifeDraft> {
  if (d.pets !== HAVE_PETS) return {};
  return { petKind: d.petKind === key ? null : key };
}

export function showPetKind(d: LifeDraft): boolean {
  return d.pets === HAVE_PETS;
}

/** step is 1-based within Your Life. Pet kind is contextual: never required. */
export function isLifeStepValid(step: number, d: LifeDraft): boolean {
  const q = LIFE_QUESTIONS[step - 1];
  if (!q) return false;
  const v = d[q.id];
  return v !== null && q.options.some((o) => o.key === v);
}
