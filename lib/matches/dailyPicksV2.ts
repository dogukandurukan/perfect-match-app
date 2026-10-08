// Real V2 Matches: the server-owned daily picks (get_daily_picks_v2 from
// supabase/proposed/20261009090000_v2_matches_daily_picks.sql). The server
// decides the period (12:00 Istanbul), the people and their live state; the
// app never computes a pick, a period or a refresh from the device clock.
import { supabase } from '@/lib/supabaseClient';

export type DailyCardState = 'new' | 'like_sent' | 'matched' | 'conversation_started';

export type DailyCard = {
  user_id: string;
  first_name: string | null;
  age: number | null;
  city: string | null;
  photo_path: string | null;
  state: DailyCardState;
  match_id: string | null;
  like: { target_type: string; target_key: string | null; note: string | null } | null;
};

export type DailyPicks = {
  member: boolean;
  period?: string;
  refresh_at?: string;
  pick: DailyCard | null;
  /** 'none' = nobody eligible this period; 'unavailable' = the stored person
   * became unavailable (not replaced until 12:00). */
  pick_reason: 'none' | 'unavailable' | null;
  mutual: DailyCard | null;
  mutual_reason: 'none' | 'unavailable' | null;
  has_matches: boolean;
};

export type DailyPicksResult =
  | { kind: 'ok'; value: DailyPicks }
  /** The server doesn't have daily picks yet (package not applied there). */
  | { kind: 'unsupported' }
  | { kind: 'error'; message: string };

export async function loadDailyPicks(): Promise<DailyPicksResult> {
  try {
    const { data, error } = await supabase.rpc('get_daily_picks_v2');
    if (error) {
      // PostgREST: function not in the schema cache.
      if (error.code === 'PGRST202' || /could not find the function/i.test(error.message ?? '')) return { kind: 'unsupported' };
      return { kind: 'error', message: 'Couldn’t load your matches. Check your connection and try again.' };
    }
    const d = (data ?? {}) as Partial<DailyPicks>;
    return {
      kind: 'ok',
      value: {
        member: d.member === true,
        period: d.period,
        refresh_at: d.refresh_at,
        pick: d.pick ?? null,
        pick_reason: d.pick_reason ?? null,
        mutual: d.mutual ?? null,
        mutual_reason: d.mutual_reason ?? null,
        has_matches: d.has_matches === true,
      },
    };
  } catch {
    return { kind: 'error', message: 'Couldn’t load your matches. Check your connection and try again.' };
  }
}

/** Which empty state the "You both liked" section shows (D66). */
export function mutualEmptyKind(p: DailyPicks): 'none_today' | 'none' {
  return p.has_matches ? 'none_today' : 'none';
}
