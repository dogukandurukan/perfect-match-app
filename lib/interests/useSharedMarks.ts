// "Both into this" for a full V2 profile (D101): the viewer's OWN saved
// selections (get_my_interests_v2, own row only) intersected with what the
// other person's profile already shows. Re-read on every open / focus, never
// persisted; a result is only shown for the exact person + selections it was
// computed for, and cleared on any sign-in change — nothing from a previous
// profile or account can appear. A failed read (or a server without the
// package) shows nothing and is retried on the next focus.
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { loadMyInterests } from '@/lib/interests/interestsV2';
import { sharedHighlights, type ShareableSelections } from '@/lib/interests/shared';
import { supabase } from '@/lib/supabaseClient';

export type MarkablePerson = ShareableSelections & { id: string; takes?: { kind: string; subjectId: string }[] };

const tagOf = (p: MarkablePerson) =>
  [p.id, p.interests.join(','), (p.activities ?? []).join(','), ...[p.artists, p.books, p.screen].map((l) => l.map((x) => `${x.source}:${x.id}`).join(',')),
    (p.takes ?? []).map((t) => `${t.kind}:${t.subjectId}`).join(',')].join('|');

const NONE: ReadonlySet<string> = new Set();

export function useSharedMarks(them: MarkablePerson | null, enabled = true): ReadonlySet<string> {
  const tag = them && enabled ? tagOf(them) : null;
  const [res, setRes] = useState<{ tag: string; keys: string[] } | null>(null);

  // Another account signed in / out: drop whatever was computed.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange(() => setRes(null));
    return () => data.subscription.unsubscribe();
  }, []);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      if (!tag || !them) return;
      void (async () => {
        const [{ data: s }, r] = await Promise.all([supabase.auth.getSession(), loadMyInterests()]);
        if (!live) return;
        const viewerId = s.session?.user?.id;
        // Error / unsupported / own profile → nothing marked (not cached).
        if (r.kind !== 'ok' || !viewerId || viewerId === them.id) return setRes({ tag, keys: [] });
        const starters = (them.takes ?? []).map((t) => ({ kind: t.kind, id: t.subjectId }));
        setRes({ tag, keys: sharedHighlights(r.value, them, starters) });
      })();
      return () => {
        live = false;
      };
      // `them` is captured through `tag` (its full selection signature).
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tag]),
  );

  return useMemo(() => (res && tag && res.tag === tag && res.keys.length ? new Set(res.keys) : NONE), [res, tag]);
}
