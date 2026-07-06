import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { blockUser, getBlockedUsers, unblockUser } from '@/api/blocks';
import { queryKeys } from '@/api/queryKeys';
import { toast } from '@/store/toastStore';
import type { User } from '@/types';

/** The users I've blocked. */
export function useBlockedUsers() {
  return useQuery({
    queryKey: queryKeys.blocked,
    queryFn: getBlockedUsers,
  });
}

/** Convenience: is this user currently blocked by me? */
export function useIsBlocked(userId: number | undefined): boolean {
  const { data } = useBlockedUsers();
  if (userId == null) return false;
  return (data ?? []).some((u) => u.id === userId);
}

function invalidateAfterBlockChange(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: queryKeys.blocked });
  // Message history + list previews are block-filtered on the server.
  void qc.invalidateQueries({ queryKey: queryKeys.conversations });
  void qc.invalidateQueries({ queryKey: ['messages'] });
}

export function useBlockUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (user: User) => blockUser(user.id),
    onSuccess: (_data, user) => {
      invalidateAfterBlockChange(qc);
      toast({ title: `Blocked ${user.displayName}`, variant: 'default' });
    },
    onError: () => toast({ title: 'Could not block user', variant: 'error' }),
  });
}

export function useUnblockUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (user: User) => unblockUser(user.id),
    onSuccess: (_data, user) => {
      invalidateAfterBlockChange(qc);
      toast({ title: `Unblocked ${user.displayName}`, variant: 'default' });
    },
    onError: () => toast({ title: 'Could not unblock user', variant: 'error' }),
  });
}
