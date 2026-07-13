import { memo, useEffect, useRef, useState } from 'react';
import {
  Check,
  CircleDashed,
  Lock,
  MessageSquarePlus,
  MoreVertical,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
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
import { useAcceptGroupInvite, useDeclineGroupInvite, useGroupInvites } from '@/hooks/useGroups';
import { useChatStore } from '@/store/chatStore';
import { AddContactModal } from './AddContactModal';
import { CreateGroupModal } from '@/features/groups/CreateGroupModal';
import { StatusBar } from '@/features/status/StatusBar';
import { AddStatusModal } from '@/features/status/AddStatusModal';
import { StatusPrivacyModal } from '@/features/status/StatusPrivacyModal';
import type { Contact } from '@/types';

// Memoized row that subscribes to ONLY its own user's presence, so a presence
// change for one user re-renders just that row — not the whole contact list.
const ContactRow = memo(function ContactRow({
  contact,
  onMessage,
  onRemove,
}: {
  contact: Contact;
  onMessage: (userId: number) => void;
  onRemove: (contactId: number) => void;
}) {
  const online = useChatStore((s) => Boolean(s.presence[contact.user.id]?.online));
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div className="relative">
        <Avatar name={contact.user.displayName} src={contact.user.avatarUrl} size="md" />
        <PresenceDot online={online} className="absolute bottom-0 right-0" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{contact.user.displayName}</p>
        <p className="truncate text-xs text-slate-400">@{contact.user.username}</p>
      </div>
      <Button size="icon" variant="ghost" aria-label="Message" onClick={() => onMessage(contact.user.id)}>
        <MessageSquarePlus className="h-5 w-5" />
      </Button>
      <Button size="icon" variant="ghost" aria-label="Remove contact" onClick={() => onRemove(contact.id)}>
        <Trash2 className="h-5 w-5 text-red-500" />
      </Button>
    </li>
  );
});

export function ContactsPanel() {
  const { data: contacts, isLoading } = useContacts();
  const { data: requests } = useIncomingRequests();
  const { data: groupInvites } = useGroupInvites();
  const acceptRequest = useAcceptRequest();
  const declineRequest = useDeclineRequest();
  const acceptGroupInvite = useAcceptGroupInvite();
  const declineGroupInvite = useDeclineGroupInvite();
  const deleteContact = useDeleteContact();
  const openDirect = useOpenDirect();

  const [addOpen, setAddOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const incoming = requests ?? [];
  const invites = groupInvites ?? [];
  const invitesBusy = acceptGroupInvite.isPending || declineGroupInvite.isPending;

  // Close the 3-dot menu when clicking outside of it.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  const menuAction = (fn: () => void) => () => {
    setMenuOpen(false);
    fn();
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <h1 className="text-lg font-semibold">Updates</h1>
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Menu"
            className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant transition hover:bg-white/5 hover:text-on-surface"
          >
            <MoreVertical className="h-5 w-5" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-12 z-20 w-52 overflow-hidden rounded-xl border border-white/10 bg-surface-container/95 text-sm text-on-surface shadow-2xl backdrop-blur-xl">
              <button
                onClick={menuAction(() => setStatusOpen(true))}
                className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-on-surface transition hover:bg-white/5"
              >
                <CircleDashed className="h-4 w-4" /> Add status
              </button>
              <button
                onClick={menuAction(() => setPrivacyOpen(true))}
                className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-on-surface transition hover:bg-white/5"
              >
                <Lock className="h-4 w-4" /> Status privacy
              </button>
              <button
                onClick={menuAction(() => setAddOpen(true))}
                className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-on-surface transition hover:bg-white/5"
              >
                <UserPlus className="h-4 w-4" /> Add contact
              </button>
              <button
                onClick={menuAction(() => setGroupOpen(true))}
                className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-on-surface transition hover:bg-white/5"
              >
                <Users className="h-4 w-4" /> New group
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {/* Status / stories row */}
        <StatusBar />

        {/* Group invites — someone who isn't a contact tried to add me to a group;
            I join only when I accept. */}
        {invites.length > 0 && (
          <section className="border-b border-slate-200 dark:border-slate-800">
            <h2 className="flex items-center gap-2 px-4 pt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Group invites
              <span className="rounded-full bg-brand-600 px-1.5 text-[10px] font-bold text-white">
                {invites.length}
              </span>
            </h2>
            <ul className="divide-y divide-slate-100 py-1 dark:divide-slate-800">
              {invites.map((inv) => (
                <li key={inv.id} className="flex items-center gap-3 px-4 py-3">
                  <Avatar name={inv.groupName} src={inv.groupAvatarUrl} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{inv.groupName}</p>
                    <p className="truncate text-xs text-slate-400">
                      {inv.inviter.displayName} invited you to join
                    </p>
                  </div>
                  <button
                    onClick={() => acceptGroupInvite.mutate(inv.id)}
                    disabled={invitesBusy}
                    aria-label="Join group"
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-white transition hover:bg-brand-700 disabled:opacity-50"
                  >
                    <Check className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => declineGroupInvite.mutate(inv.id)}
                    disabled={invitesBusy}
                    aria-label="Decline group invite"
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

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

        <h2 className="flex items-center gap-2 px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
          <Users className="h-3.5 w-3.5" /> Contacts
        </h2>

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
              <ContactRow
                key={c.id}
                contact={c}
                onMessage={openDirect.mutate}
                onRemove={deleteContact.mutate}
              />
            ))}
          </ul>
        )}
      </div>

      <AddContactModal open={addOpen} onClose={() => setAddOpen(false)} />
      <CreateGroupModal open={groupOpen} onClose={() => setGroupOpen(false)} />
      <AddStatusModal open={statusOpen} onClose={() => setStatusOpen(false)} />
      <StatusPrivacyModal open={privacyOpen} onClose={() => setPrivacyOpen(false)} />
    </div>
  );
}
