import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addStatusToMine,
  createStatus,
  deleteStatus,
  getStatusFeed,
  getStatusPrivacy,
  getStatusViewers,
  markStatusViewed,
  replyToStatus,
  setStatusPrivacy,
} from '@/api/status';
import { queryKeys } from '@/api/queryKeys';
import { toast } from '@/store/toastStore';
import type { CreateStatusPayload, StatusPrivacy, StatusReplyPayload, StatusUser } from '@/types';

export function useStatusFeed() {
  return useQuery({
    queryKey: queryKeys.status,
    queryFn: getStatusFeed,
    staleTime: 30_000,
  });
}

export function useCreateStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateStatusPayload) => createStatus(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.status });
      toast({ title: 'Status posted', variant: 'success' });
    },
    onError: () => toast({ title: 'Could not post status', variant: 'error' }),
  });
}

/**
 * Add a status I was @mentioned in to my own. The feed is invalidated because my
 * own row in it gains an item — the same refetch posting a status does.
 */
export function useAddStatusToMine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => addStatusToMine(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.status });
      toast({ title: 'Added to your status', variant: 'success' });
    },
    onError: (err) =>
      toast({
        title:
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Could not add to your status',
        variant: 'error',
      }),
  });
}

export function useDeleteStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteStatus(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.status });
      toast({ title: 'Status deleted', variant: 'default' });
    },
  });
}

export function useStatusViewers(id: number | null, enabled: boolean) {
  return useQuery({
    queryKey: id != null ? queryKeys.statusViewers(id) : ['status', 'views', 'none'],
    queryFn: () => getStatusViewers(id as number),
    enabled: enabled && id != null,
  });
}

/** Read the current status-privacy setting (who can see my statuses). */
export function useStatusPrivacy(enabled = true) {
  return useQuery({
    queryKey: queryKeys.statusPrivacy,
    queryFn: getStatusPrivacy,
    enabled,
  });
}

export function useSetStatusPrivacy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: StatusPrivacy) => setStatusPrivacy(payload),
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.statusPrivacy, data);
      // Visibility changed — refresh the feed rings.
      void qc.invalidateQueries({ queryKey: queryKeys.status });
      toast({ title: 'Privacy updated', variant: 'success' });
    },
    onError: () => toast({ title: 'Could not update privacy', variant: 'error' }),
  });
}

/** Send a reply or emoji reaction to a status (arrives as a chat message). */
export function useReplyToStatus() {
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: StatusReplyPayload }) =>
      replyToStatus(id, payload),
    onSuccess: () => toast({ title: 'Sent', variant: 'success' }),
    onError: () => toast({ title: 'Could not send reply', variant: 'error' }),
  });
}

/**
 * Fire-and-forget view mark. We deliberately DON'T invalidate the feed here —
 * marking fires on every story advance, so invalidating would trigger a full
 * feed refetch per item (a refetch storm). Instead we flip the item's `viewed`
 * flag in the cache locally; the ring state refreshes once when the viewer
 * closes (see StatusViewer).
 */
export function useMarkStatusViewed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => markStatusViewed(id),
    onSuccess: (_data, id) => {
      qc.setQueryData<StatusUser[]>(queryKeys.status, (prev) =>
        prev?.map((u) => ({
          ...u,
          items: u.items.map((it) => (it.id === id ? { ...it, viewed: true } : it)),
          allViewed: u.items.every((it) => it.id === id || it.viewed),
        })),
      );
    },
  });
}
