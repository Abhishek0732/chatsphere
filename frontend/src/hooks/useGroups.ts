import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  addGroupMembers,
  createGroup,
  getGroup,
  removeGroupMember,
  updateGroup,
  type CreateGroupPayload,
} from '@/api/groups';
import { queryKeys } from '@/api/queryKeys';
import { toast } from '@/store/toastStore';
import type { ConversationSummary } from '@/types';

export function useGroup(id: number | null) {
  return useQuery({
    queryKey: id != null ? queryKeys.group(id) : ['group', 'none'],
    queryFn: () => getGroup(id as number),
    enabled: id != null,
  });
}

export function useCreateGroup() {
  const qc = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (payload: CreateGroupPayload) => createGroup(payload),
    onSuccess: (conversation: ConversationSummary) => {
      qc.setQueryData<ConversationSummary[]>(queryKeys.conversations, (prev) => [
        conversation,
        ...(prev ?? []),
      ]);
      toast({ title: 'Group created', variant: 'success' });
      navigate(`/chat/${conversation.publicId}`);
    },
    onError: () => toast({ title: 'Could not create group', variant: 'error' }),
  });
}

export function useUpdateGroup(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; avatarUrl?: string }) => updateGroup(id, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.group(id) });
      void qc.invalidateQueries({ queryKey: queryKeys.conversations });
    },
  });
}

export function useAddGroupMembers(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userIds: number[]) => addGroupMembers(id, userIds),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.group(id) });
      toast({ title: 'Members added', variant: 'success' });
    },
  });
}

export function useRemoveGroupMember(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: number) => removeGroupMember(id, userId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.group(id) });
    },
  });
}
