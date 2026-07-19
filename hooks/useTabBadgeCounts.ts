import { useEffect, useState } from 'react';

import {
  fetchUnreadMessageCount,
  onUnreadMessageCountChange,
} from '@/lib/unreadMessageCount';
import {
  fetchUnreadNotificationCount,
  onUnreadNotificationCountChange,
} from '@/lib/unreadNotificationCount';

export function useTabBadgeCounts() {
  const [messageCount, setMessageCount] = useState(0);
  const [notificationCount, setNotificationCount] = useState(0);

  useEffect(() => {
    void fetchUnreadMessageCount().then(setMessageCount);
    void fetchUnreadNotificationCount().then(setNotificationCount);

    const unsubMessages = onUnreadMessageCountChange(setMessageCount);
    const unsubNotifications = onUnreadNotificationCountChange(setNotificationCount);

    return () => {
      unsubMessages();
      unsubNotifications();
    };
  }, []);

  return {
    messageCount,
    showNotificationDot: notificationCount > 0,
  };
}
