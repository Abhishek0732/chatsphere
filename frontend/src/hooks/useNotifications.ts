import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/api/notifications';
import { queryKeys } from '@/api/queryKeys';
import type { AppNotification } from '@/types';

export function useNotifications() {
  return useQuery({
    queryKey: queryKeys.notifications,
    queryFn: getNotifications,
  });
}

/** Only unread notifications are surfaced in the bell; read ones drop off. */
export function useUnreadNotifications(): AppNotification[] {
  const { data } = useNotifications();
  return (data ?? []).filter((n) => !n.read);
}

export function useUnreadNotificationCount(): number {
  const { data } = useNotifications();
  return (data ?? []).filter((n) => !n.read).length;
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => markNotificationRead(id),
    onSuccess: (_data, id) => {
      qc.setQueryData<AppNotification[]>(queryKeys.notifications, (prev) =>
        (prev ?? []).map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
    },
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => {
      qc.setQueryData<AppNotification[]>(queryKeys.notifications, (prev) =>
        (prev ?? []).map((n) => ({ ...n, read: true })),
      );
    },
  });
}
