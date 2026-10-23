import { useCallback, useMemo, useRef, useState } from 'react';

import { ackVisitsNotice, createVisitFlow, recordProfileVisit } from '@/lib/visits/visits';

export type VisitNoticeState = {
  visible: boolean;
  busy: boolean;
  error: boolean;
  gotIt: () => void;
  dismiss: () => void;
};

/**
 * Records a profile visit once per screen for the person shown — call
 * `recordVisit` only after their FULL profile loaded. Before the very first
 * recorded visit the server asks for the visibility notice; render `notice`
 * with <VisitsNotice>. "Got it" acknowledges, then records; closing it or
 * leaving the screen records nothing and saves no acknowledgement, so the
 * notice shows again on the next eligible open. Re-renders / reloads don't
 * record again (and the server ignores opens inside its 24 h window anyway).
 */
export function useProfileVisit(): { recordVisit: (userId: string) => void; notice: VisitNoticeState } {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const flowRef = useRef<ReturnType<typeof createVisitFlow> | null>(null);
  if (!flowRef.current) {
    flowRef.current = createVisitFlow({ record: recordProfileVisit, ack: ackVisitsNotice }, (id) => {
      setVisible(!!id);
      setError(false);
    });
  }
  const flow = flowRef.current;

  const recordVisit = useCallback((userId: string) => void flow.loaded(userId), [flow]);
  const gotIt = useCallback(() => {
    setBusy(true);
    setError(false);
    void flow.gotIt().then((ok) => {
      setBusy(false);
      if (!ok) setError(true);
    });
  }, [flow]);
  const dismiss = useCallback(() => flow.dismiss(), [flow]);

  const notice = useMemo(() => ({ visible, busy, error: error && visible, gotIt, dismiss }), [visible, busy, error, gotIt, dismiss]);
  return { recordVisit, notice };
}
