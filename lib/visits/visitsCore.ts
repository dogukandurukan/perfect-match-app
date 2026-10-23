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

/**
 * The small notice shown before the first recorded visit (no hidden visits).
 * One action: "Got it" acknowledges, then the visit is recorded. Leaving or
 * closing it records nothing and saves no acknowledgement, so it shows again
 * on the next eligible profile open.
 */
export const VISITS_NOTICE = {
  body: 'People whose profiles you visit can see you in their profile visitors.',
  cta: 'Got it',
  closeLabel: 'Close',
  saveError: 'Couldn’t save that. Try again.',
};

export type RecordResult = 'recorded' | 'skipped' | 'notice' | 'error';

/**
 * The client side of one profile screen's visit (pure; server calls injected).
 *  • loaded(userId): called only after the FULL profile loaded; records once
 *    per person per screen. The server answers 'notice' until acknowledged.
 *  • gotIt(): acknowledge, THEN record the pending person — never before.
 *    A failed acknowledgement keeps the notice and records nothing.
 *  • dismiss(): close without acknowledging — nothing is recorded or saved.
 * Leaving the screen simply drops the flow (same as dismiss).
 */
export function createVisitFlow(
  deps: { record: (userId: string) => Promise<RecordResult>; ack: () => Promise<boolean> },
  onNotice: (userId: string | null) => void,
) {
  const asked = new Set<string>();
  let pending: string | null = null;
  let busy = false;
  return {
    async loaded(userId: string): Promise<RecordResult | null> {
      if (!userId || asked.has(userId)) return null;
      asked.add(userId);
      const r = await deps.record(userId);
      if (r === 'notice') {
        pending = userId;
        onNotice(userId);
      }
      return r;
    },
    async gotIt(): Promise<boolean> {
      const id = pending;
      if (!id || busy) return false;
      busy = true;
      try {
        if (!(await deps.ack())) return false;
        if (pending !== id) return false; // closed meanwhile
        pending = null;
        onNotice(null);
        await deps.record(id);
        return true;
      } finally {
        busy = false;
      }
    },
    dismiss() {
      pending = null;
      onNotice(null);
    },
  };
}

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
