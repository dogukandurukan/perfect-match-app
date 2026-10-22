import { useRouter } from 'expo-router';
import { useCallback, useRef } from 'react';
import { Alert } from 'react-native';

import { ackVisitsNotice, recordProfileVisit, VISITS_NOTICE } from '@/lib/visits/visits';

/**
 * Records a profile visit once per screen for the person shown — call it only
 * after their FULL profile loaded. Before the very first recorded visit the
 * server asks for the visibility notice: "Go back" leaves without recording,
 * "OK" acknowledges it and records. Re-renders / reloads don't record again
 * (and the server ignores opens inside its 24 h window anyway).
 */
export function useProfileVisit(): (userId: string) => void {
  const router = useRouter();
  const done = useRef(new Set<string>());
  return useCallback(
    (userId: string) => {
      if (!userId || done.current.has(userId)) return;
      done.current.add(userId);
      void (async () => {
        const r = await recordProfileVisit(userId);
        if (r !== 'notice') return;
        Alert.alert(VISITS_NOTICE.title, VISITS_NOTICE.body, [
          { text: 'Go back', style: 'cancel', onPress: () => (router.canGoBack() ? router.back() : undefined) },
          {
            text: 'OK',
            onPress: async () => {
              if (await ackVisitsNotice()) await recordProfileVisit(userId);
            },
          },
        ]);
      })();
    },
    [router],
  );
}
