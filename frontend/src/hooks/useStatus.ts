import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createStatus,
  deleteStatus,
  getStatusFeed,
  getStatusViewers,
  markStatusViewed,
} from '@/api/status';
import { queryKeys } from '@/api/queryKeys';
import { toast } from '@/store/toastStore';
import type { CreateStatusPayload } from '@/types';

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
