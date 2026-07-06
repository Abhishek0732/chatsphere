import { useState } from 'react';
import { Check, MessageSquarePlus, Trash2, UserPlus, Users, X } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { PresenceDot } from '@/components/ui/PresenceDot';
import {
  useAcceptRequest,
  useContacts,
  useDeclineRequest,
  useDeleteContact,
  useIncomingRequests,
} from '@/hooks/useContacts';
import { useOpenDirect } from '@/hooks/useConversations';
import { useChatStore } from '@/store/chatStore';
import { AddContactModal } from './AddContactModal';
import { CreateGroupModal } from '@/features/groups/CreateGroupModal';
import { StatusBar } from '@/features/status/StatusBar';

export function ContactsPanel() {
  const { data: contacts, isLoading } = useContacts();
  const { data: requests } = useIncomingRequests();
  const acceptRequest = useAcceptRequest();
  const declineRequest = useDeclineRequest();
  const deleteContact = useDeleteContact();
  const openDirect = useOpenDirect();
  const presence = useChatStore((s) => s.presence);

  const [addOpen, setAddOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);

  const incoming = requests ?? [];

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <h1 className="text-lg font-semibold">Contacts</h1>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => setGroupOpen(true)}>
            <Users className="h-4 w-4" /> New group
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <UserPlus className="h-4 w-4" /> Add
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {/* Status / stories row */}
        <StatusBar />

        {incoming.length > 0 && (
          <section className="border-b border-slate-200 dark:border-slate-800">
            <h2 className="flex items-center gap-2 px-4 pt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Invitations
              <span className="rounded-full bg-brand-600 px-1.5 text-[10px] font-bold text-white">
                {incoming.length}
              </span>
            </h2>
            <ul className="divide-y divide-slate-100 py-1 dark:divide-slate-800">
              {incoming.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                  <Avatar name={r.user.displayName} src={r.user.avatarUrl} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.user.displayName}</p>
                    <p className="truncate text-xs text-slate-400">
                      wants to add you as a contact
                    </p>
                  </div>
                  <button
                    onClick={() => acceptRequest.mutate(r.id)}
                    disabled={acceptRequest.isPending || declineRequest.isPending}
                    aria-label="Accept"
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-white transition hover:bg-brand-700 disabled:opacity-50"
                  >
                    <Check className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => declineRequest.mutate(r.id)}
                    disabled={acceptRequest.isPending || declineRequest.isPending}
                    aria-label="Decline"
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : (contacts ?? []).length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-400">
            No contacts yet. Tap “Add” to find people.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {(contacts ?? []).map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                <div className="relative">
                  <Avatar name={c.user.displayName} src={c.user.avatarUrl} size="md" />
                  <PresenceDot
                    online={Boolean(presence[c.user.id]?.online)}
                    className="absolute bottom-0 right-0"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.user.displayName}</p>
                  <p className="truncate text-xs text-slate-400">@{c.user.username}</p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Message"
                  onClick={() => openDirect.mutate(c.user.id)}
                >
                  <MessageSquarePlus className="h-5 w-5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Remove contact"
                  onClick={() => deleteContact.mutate(c.id)}
                >
                  <Trash2 className="h-5 w-5 text-red-500" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <AddContactModal open={addOpen} onClose={() => setAddOpen(false)} />
      <CreateGroupModal open={groupOpen} onClose={() => setGroupOpen(false)} />
    </div>
  );
}
