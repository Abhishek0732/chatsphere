import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
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
import type { CreateStatusPayload, StatusPrivacy, StatusReplyPayload } from '@/types';

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

/** Fire-and-forget view mark; refreshes the feed rings when the viewer closes. */
export function useMarkStatusViewed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => markStatusViewed(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.status });
    },
  });
}
