import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  acceptGroupInvite,
  addGroupMembers,
  createGroup,
  declineGroupInvite,
  getGroup,
  getGroupInvites,
  removeGroupMember,
  setGroupMemberRole,
  updateGroup,
  type CreateGroupPayload,
} from '@/api/groups';
import { queryKeys } from '@/api/queryKeys';
import { toast } from '@/store/toastStore';
import { useAuthStore } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';
import type { AddMembersResult, ConversationSummary } from '@/types';

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

/**
 * Add people to a group. Contacts join right away; anyone else only gets an
 * invite, so the toast must say which actually happened rather than claiming
 * everyone was added.
 */
export function useAddGroupMembers(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userIds: number[]) => addGroupMembers(id, userIds),
    onSuccess: (result: AddMembersResult) => {
      void qc.invalidateQueries({ queryKey: queryKeys.group(id) });
      void qc.invalidateQueries({ queryKey: queryKeys.conversations });

      const parts: string[] = [];
      if (result.added.length) parts.push(`${result.added.length} added`);
      if (result.invited.length) parts.push(`${result.invited.length} invited`);
      const invitedNames = result.invited.map((u) => u.displayName).join(', ');
      toast({
        title: parts.join(' · ') || 'No changes',
        description: invitedNames
          ? `${invitedNames} will join once they accept the invite.`
          : undefined,
        variant: 'success',
      });
    },
    onError: () => toast({ title: 'Could not add members', variant: 'error' }),
  });
}

/** Group invites waiting on me (someone who isn't my contact added me). */
export function useGroupInvites() {
  return useQuery({
    queryKey: queryKeys.groupInvites,
    queryFn: getGroupInvites,
  });
}

export function useAcceptGroupInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: number) => acceptGroupInvite(inviteId),
    onSuccess: (conversation: ConversationSummary) => {
      // Only now am I a member — the group appears in my chat list.
      qc.setQueryData<ConversationSummary[]>(queryKeys.conversations, (prev) => [
        conversation,
        ...(prev ?? []).filter((c) => c.id !== conversation.id),
      ]);
      void qc.invalidateQueries({ queryKey: queryKeys.groupInvites });
      void qc.invalidateQueries({ queryKey: queryKeys.conversations });
      toast({ title: `You joined ${conversation.name ?? 'the group'}`, variant: 'success' });
    },
    onError: () => toast({ title: 'Could not join the group', variant: 'error' }),
  });
}

export function useDeclineGroupInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: number) => declineGroupInvite(inviteId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.groupInvites });
      toast({ title: 'Invite declined', variant: 'default' });
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

/** Leave a group I'm a member of (removes myself). */
export function useLeaveGroup() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const myId = useAuthStore((s) => s.user?.id);

  return useMutation({
    mutationFn: (groupId: number) => {
      if (myId == null) return Promise.reject(new Error('Not authenticated'));
      return removeGroupMember(groupId, myId);
    },
    onSuccess: (_data, groupId) => {
      // Drop it from the chat list immediately.
      qc.setQueryData<ConversationSummary[]>(queryKeys.conversations, (prev) =>
        (prev ?? []).filter((c) => c.id !== groupId),
      );
      void qc.invalidateQueries({ queryKey: queryKeys.conversations });
      // Only navigate away if the group we left is the one currently open.
      if (useChatStore.getState().activeConversationId === groupId) {
        navigate('/');
      }
      toast({ title: 'You left the group', variant: 'default' });
    },
    onError: () => toast({ title: 'Could not leave group', variant: 'error' }),
  });
}

export function useSetGroupMemberRole(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: number; role: 'ADMIN' | 'MEMBER' }) =>
      setGroupMemberRole(id, userId, role),
    onSuccess: (_data, { role }) => {
      void qc.invalidateQueries({ queryKey: queryKeys.group(id) });
      toast({
        title: role === 'ADMIN' ? 'Promoted to admin' : 'Removed as admin',
        variant: 'success',
      });
    },
  });
}
