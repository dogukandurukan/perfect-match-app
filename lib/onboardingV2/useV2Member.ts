// Is the signed-in user an active V2 member (server gate 'member')? Re-checked
// on every focus. Always 'no' when the V2 backend isn't selected (live/V1),
// so V1 accounts keep their existing screens.
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { getAccessGate } from '@/lib/onboardingV2/remote';
import { v2Enabled } from '@/lib/supabaseClient';

export type V2MemberState = 'checking' | 'yes' | 'no';

export function useV2Member(): V2MemberState {
  const [state, setState] = useState<V2MemberState>(v2Enabled ? 'checking' : 'no');
  useFocusEffect(
    useCallback(() => {
      if (!v2Enabled) return;
      let live = true;
      void getAccessGate().then((g) => {
        if (live) setState(g.gate === 'member' ? 'yes' : 'no');
      });
      return () => {
        live = false;
      };
    }, []),
  );
  return state;
}
