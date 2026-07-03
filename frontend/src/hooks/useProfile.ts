import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getMe, updateMe, type UpdateProfilePayload } from '@/api/users';
import { queryKeys } from '@/api/queryKeys';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/toastStore';
import type { User } from '@/types';

export function useMe() {
  const setUser = useAuthStore((s) => s.setUser);
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: async () => {
      const me = await getMe();
      setUser(me);
      return me;
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);

  return useMutation({
    mutationFn: (payload: UpdateProfilePayload) => updateMe(payload),
    onSuccess: (user: User) => {
      setUser(user);
      qc.setQueryData(queryKeys.me, user);
      toast({ title: 'Profile updated', variant: 'success' });
    },
    onError: () => {
      toast({ title: 'Could not update profile', variant: 'error' });
    },
  });
}
