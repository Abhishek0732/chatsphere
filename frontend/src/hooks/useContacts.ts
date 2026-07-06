import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  acceptContactRequest,
  addContact,
  declineContactRequest,
  deleteContact,
  getContacts,
  getIncomingRequests,
  getOutgoingRequests,
} from '@/api/contacts';
import { queryKeys } from '@/api/queryKeys';
import { toast } from '@/store/toastStore';
import type { SendRequestResult } from '@/types';

export function useContacts() {
  return useQuery({
    queryKey: queryKeys.contacts,
    queryFn: getContacts,
  });
}

/** Invitations sent to me (that I can accept/decline). */
export function useIncomingRequests() {
  return useQuery({
    queryKey: queryKeys.contactRequests,
    queryFn: getIncomingRequests,
  });
}

/** Invitations I've sent that are still pending. */
export function useOutgoingRequests() {
  return useQuery({
    queryKey: queryKeys.contactRequestsOutgoing,
    queryFn: getOutgoingRequests,
  });
}

/** Sends a contact invitation (the user is added only after they accept). */
export function useAddContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (contactUserId: number) => addContact(contactUserId),
    onSuccess: (result: SendRequestResult) => {
      void qc.invalidateQueries({ queryKey: queryKeys.contactRequestsOutgoing });
      if (result.status === 'ACCEPTED') {
        // They had already invited us → became contacts immediately.
        void qc.invalidateQueries({ queryKey: queryKeys.contacts });
        void qc.invalidateQueries({ queryKey: queryKeys.contactRequests });
        void qc.invalidateQueries({ queryKey: queryKeys.conversations });
        toast({ title: 'Contact added', variant: 'success' });
      } else {
        toast({ title: 'Invitation sent', variant: 'success' });
      }
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Could not send invitation';
      toast({ title: message, variant: 'error' });
    },
  });
}

export function useAcceptRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => acceptContactRequest(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.contactRequests });
      void qc.invalidateQueries({ queryKey: queryKeys.contacts });
      // Accepting creates the direct conversation — show it in the chat list now.
      void qc.invalidateQueries({ queryKey: queryKeys.conversations });
      toast({ title: 'Contact added', variant: 'success' });
    },
  });
}

export function useDeclineRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => declineContactRequest(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.contactRequests });
      toast({ title: 'Invitation declined', variant: 'default' });
    },
  });
}

export function useDeleteContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteContact(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.contacts });
      toast({ title: 'Contact removed', variant: 'default' });
    },
  });
}
