import { useEffect, useState } from 'react';
import { Check, Pencil, Plus, UserMinus } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
import { Spinner } from '@/components/ui/Spinner';
import {
  useAddGroupMembers,
  useGroup,
  useRemoveGroupMember,
  useUpdateGroup,
} from '@/hooks/useGroups';
import { useContacts } from '@/hooks/useContacts';
import { useAuthStore } from '@/store/authStore';

interface GroupInfoModalProps {
  open: boolean;
  onClose: () => void;
  groupId: number;
}

export function GroupInfoModal({ open, onClose, groupId }: GroupInfoModalProps) {
  const myId = useAuthStore((s) => s.user?.id);
  const { data: group, isLoading } = useGroup(open ? groupId : null);
  const { data: contacts } = useContacts();
  const updateGroup = useUpdateGroup(groupId);
  const addMembers = useAddGroupMembers(groupId);
  const removeMember = useRemoveGroupMember(groupId);

  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (group) setName(group.name);
  }, [group]);

  const isOwner = group?.createdBy === myId;
  const memberIds = new Set((group?.members ?? []).map((m) => m.id));
  const addableContacts = (contacts ?? []).filter((c) => !memberIds.has(c.user.id));

  const saveName = () => {
    if (name.trim().length < 2) return;
    updateGroup.mutate(
      { name: name.trim(), avatarUrl: group?.avatarUrl },
      { onSuccess: () => setEditingName(false) },
    );
  };

  return (
    <Modal open={open} onClose={onClose} title="Group info">
      {isLoading || !group ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-col items-center gap-2">
            <Avatar name={group.name} src={group.avatarUrl} size="xl" />
            {editingName ? (
              <div className="flex w-full items-center gap-2">
                <Input value={name} onChange={(e) => setName(e.target.value)} />
                <Button size="icon" onClick={saveName} loading={updateGroup.isPending}>
                  <Check className="h-5 w-5" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold">{group.name}</h3>
                {isOwner && (
                  <button
                    onClick={() => setEditingName(true)}
                    className="text-slate-400 hover:text-slate-600"
                    aria-label="Edit name"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                {group.members.length} members
              </p>
              {isOwner && (
                <Button size="sm" variant="ghost" onClick={() => setAdding((v) => !v)}>
                  <Plus className="h-4 w-4" /> Add
                </Button>
              )}
            </div>

            {adding && (
              <div className="mb-3 max-h-40 overflow-y-auto rounded-lg border border-slate-200 scrollbar-thin dark:border-slate-700">
                {addableContacts.length === 0 ? (
                  <p className="px-3 py-4 text-center text-sm text-slate-400">
                    No contacts to add.
                  </p>
                ) : (
                  addableContacts.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => addMembers.mutate([c.user.id])}
                      className="flex w-full items-center gap-3 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <Avatar name={c.user.displayName} src={c.user.avatarUrl} size="sm" />
                      <span className="flex-1 truncate text-left text-sm">
                        {c.user.displayName}
                      </span>
                      <Plus className="h-4 w-4 text-brand-600" />
                    </button>
                  ))
                )}
              </div>
            )}

            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {group.members.map((m) => (
                <li key={m.id} className="flex items-center gap-3 py-2">
                  <Avatar name={m.displayName} src={m.avatarUrl} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {m.displayName}
                      {m.id === myId && ' (you)'}
                    </p>
                    {m.id === group.createdBy && (
                      <p className="text-xs text-brand-600">Admin</p>
                    )}
                  </div>
                  {isOwner && m.id !== myId && (
                    <button
                      onClick={() => removeMember.mutate(m.id)}
                      className="rounded p-1 text-slate-400 hover:text-red-500"
                      aria-label="Remove member"
                    >
                      <UserMinus className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Modal>
  );
}
