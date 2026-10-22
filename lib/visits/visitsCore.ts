// Profile visits (pure). Never an exact visit count: the first counted visit
// reads "Viewed your profile", a later separate one "Visited again".

export type ProfileVisit = {
  user_id: string;
  first_name: string | null;
  age: number | null;
  city: string | null;
  photo_path: string | null;
  last_visit_at: string;
  again: boolean;
};
export type VisitsData = { member: boolean; premium: boolean; count: number; visits: ProfileVisit[]; noticeAck: boolean };

export const visitLabel = (v: Pick<ProfileVisit, 'again'>) => (v.again ? 'Visited again' : 'Viewed your profile');

/** The notice shown once, before the first recorded visit (no hidden visits). */
export const VISITS_NOTICE = {
  title: 'Profile visits are visible',
  body: 'When you open someone’s full profile, they can see that you visited — as “Viewed your profile”, or “Visited again” on a later day. Visits are never hidden.',
};

/** Shown on the visits screen: visits are visible both ways. */
export const VISITS_INFO = 'Visits are visible both ways: when you open someone’s full profile, they can see it too.';

export const visitsCountLine = (n: number) => (n === 1 ? '1 person visited your profile' : `${n} people visited your profile`);

/** The Activity entry's second line — a count of people, never of visits. */
export const visitsEntrySub = (n: number) => (n === 0 ? 'No visits yet' : n === 1 ? '1 person' : `${n} people`);

export function parseVisits(raw: unknown): VisitsData {
  const d = (raw ?? {}) as Record<string, unknown>;
  const list = Array.isArray(d.visits) ? (d.visits as ProfileVisit[]) : [];
  return {
    member: d.member === true,
    premium: d.premium === true,
    count: Number(d.count ?? list.length) || 0,
    visits: list.map((v) => ({ ...v, again: v.again === true })),
    noticeAck: d.notice_ack === true,
  };
}
