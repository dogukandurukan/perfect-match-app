// Framework-free typeahead controller (P05): ≥2 trimmed characters, ~300 ms
// debounce, stale-response protection, loading / done / error states, and an
// empty (idle) state with NO suggestions for short or cleared queries.
import type { TasteItem } from '@/lib/onboardingV2/yourWorld';

export type TypeaheadState =
  | { status: 'idle'; query: string; results: [] }
  | { status: 'loading'; query: string; results: [] }
  | { status: 'done'; query: string; results: TasteItem[] }
  | { status: 'error'; query: string; results: [] };

type Timer = ReturnType<typeof setTimeout>;

export function makeTypeahead(
  search: (q: string, signal?: AbortSignal) => Promise<TasteItem[]>,
  emit: (s: TypeaheadState) => void,
  opts: { delay?: number; minChars?: number; schedule?: typeof setTimeout; cancel?: typeof clearTimeout } = {},
) {
  const delay = opts.delay ?? 300;
  const minChars = opts.minChars ?? 2;
  const schedule = opts.schedule ?? setTimeout;
  const cancel = opts.cancel ?? clearTimeout;
  let timer: Timer | null = null;
  let requestId = 0;
  let inflight: AbortController | null = null;

  return {
    setQuery(raw: string) {
      const query = raw.trim();
      if (timer) cancel(timer);
      timer = null;
      const id = ++requestId; // any in-flight response is now stale
      inflight?.abort(); // and a queued/in-flight network request is cancelled
      inflight = null;
      if (query.length < minChars) {
        emit({ status: 'idle', query, results: [] });
        return;
      }
      emit({ status: 'loading', query, results: [] });
      timer = schedule(() => {
        const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
        inflight = ctrl;
        search(query, ctrl?.signal).then(
          (results) => {
            if (id === requestId) emit({ status: 'done', query, results });
          },
          () => {
            if (id === requestId) emit({ status: 'error', query, results: [] });
          },
        );
      }, delay);
    },
    dispose() {
      if (timer) cancel(timer);
      inflight?.abort();
      requestId++;
    },
  };
}
