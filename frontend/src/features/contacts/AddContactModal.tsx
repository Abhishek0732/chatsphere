import { useState } from 'react';
import { Check, Clock, UserPlus } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { useUserSearch } from '@/hooks/useUserSearch';
import { useAddContact, useContacts, useOutgoingRequests } from '@/hooks/useContacts';
import { useAuthStore } from '@/store/authStore';

interface AddContactModalProps {
  open: boolean;
  onClose: () => void;
}

export function AddContactModal({ open, onClose }: AddContactModalProps) {
  const myId = useAuthStore((s) => s.user?.id);
  const [term, setTerm] = useState('');
  const { data: results, isFetching } = useUserSearch(term);
  const { data: contacts } = useContacts();
  const { data: outgoing } = useOutgoingRequests();
  const addContact = useAddContact();

  // Who's already a contact, and who has a pending invitation from me.
  const contactIds = new Set((contacts ?? []).map((c) => c.user.id));
  const invitedIds = new Set((outgoing ?? []).map((r) => r.user.id));

  return (
    <Modal open={open} onClose={onClose} title="Add contact">
      <div className="space-y-3">
        <Input
          autoFocus
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search by name, username or email"
        />

        <div className="max-h-72 overflow-y-auto scrollbar-thin">
          {isFetching ? (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          ) : term.trim().length < 2 ? (
            <p className="py-6 text-center text-sm text-slate-400">Type at least 2 characters.</p>
          ) : (results ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">No users found.</p>
          ) : (
            (results ?? [])
              .filter((u) => u.id !== myId)
              .map((u) => {
                const isContact = contactIds.has(u.id);
                const isInvited = invitedIds.has(u.id);
                return (
                  <div
                    key={u.id}
                    className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <Avatar name={u.displayName} src={u.avatarUrl} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{u.displayName}</p>
                      <p className="truncate text-xs text-slate-400">@{u.username}</p>
                    </div>

                    {isContact ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
                        <Check className="h-3.5 w-3.5" /> Added
                      </span>
                    ) : isInvited ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                        <Clock className="h-3.5 w-3.5" /> Invited
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => addContact.mutate(u.id)}
                        loading={addContact.isPending && addContact.variables === u.id}
                      >
                        <UserPlus className="h-4 w-4" /> Invite
                      </Button>
                    )}
                  </div>
                );
              })
          )}
        </div>
      </div>
    </Modal>
  );
}
