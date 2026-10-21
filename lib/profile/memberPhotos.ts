// Save an approved member's photo order (reorder_member_photos_v2): the new
// order plus the order the screen loaded, so a change made elsewhere is
// reported instead of silently overwritten.
import { supabase } from '@/lib/supabaseClient';

import { photoOrderError } from './photoOrder';

export async function saveMemberPhotoOrder(
  ids: string[],
  expected: string[],
): Promise<{ ok: true; changed: boolean } | { ok: false; text: string; changed: boolean }> {
  try {
    const { data, error } = await supabase.rpc('reorder_member_photos_v2', { p_ids: ids, p_expected: expected });
    if (error || !data?.ok) {
      if (__DEV__) console.warn('[Photos] reorder failed', error?.message);
      return { ok: false, ...photoOrderError(error?.message) };
    }
    return { ok: true, changed: data.changed === true };
  } catch (e) {
    if (__DEV__) console.warn('[Photos] reorder threw', e);
    return { ok: false, ...photoOrderError((e as Error)?.message) };
  }
}
