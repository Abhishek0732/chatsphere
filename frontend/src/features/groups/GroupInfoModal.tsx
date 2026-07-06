import { useEffect, useRef, useState } from 'react';
import { Camera, Check, Pencil, Plus, Shield, ShieldOff, Trash2, UserMinus } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
import { Spinner } from '@/components/ui/Spinner';
import {
  useAddGroupMembers,
  useGroup,
  useRemoveGroupMember,
  useSetGroupMemberRole,
  useUpdateGroup,
} from '@/hooks/useGroups';
import { useContacts } from '@/hooks/useContacts';
import { useAuthStore } from '@/store/authStore';
import { useImageViewer } from '@/store/imageViewerStore';
import { uploadMedia, uploadSizeError } from '@/api/media';
import { toast } from '@/store/toastStore';

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
  const setRole = useSetGroupMemberRole(groupId);
  const openViewer = useImageViewer((s) => s.open);

  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (group) setName(group.name);
  }, [group]);

  // My own role decides what controls I see (owner OR admin can manage).
  const myRole = group?.members.find((m) => m.user.id === myId)?.role ?? 'MEMBER';
  const isAdmin = myRole === 'OWNER' || myRole === 'ADMIN';

  const memberIds = new Set((group?.members ?? []).map((m) => m.user.id));
  const addableContacts = (contacts ?? []).filter((c) => !memberIds.has(c.user.id));

  const saveName = () => {
    if (name.trim().length < 2) return;
    updateGroup.mutate(
      { name: name.trim(), avatarUrl: group?.avatarUrl },
      { onSuccess: () => setEditingName(false) },
    );
  };

  const onAvatarPicked = async (file: File | undefined) => {
    if (!file || !group) return;
    const sizeError = uploadSizeError(file);
    if (sizeError) {
      toast({ title: sizeError, variant: 'error' });
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    setUploading(true);
    try {
      const result = await uploadMedia(file);
      updateGroup.mutate({ name: group.name, avatarUrl: result.url });
    } catch {
      toast({ title: 'Could not upload group photo', variant: 'error' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removeAvatar = () => {
    if (!group) return;
    updateGroup.mutate({ name: group.name, avatarUrl: '' });
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
            <div className="relative">
              <Avatar
                name={group.name}
                src={group.avatarUrl}
                size="xl"
                onClick={() => openViewer(group.name, group.avatarUrl, { circle: true })}
              />
              {isAdmin && (
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-white shadow-md hover:bg-brand-700"
                  aria-label="Change group photo"
                >
                  {uploading ? (
                    <Spinner className="h-4 w-4 text-white" />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onAvatarPicked(e.target.files?.[0])}
              />
            </div>

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
                {isAdmin && (
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

            {isAdmin && group.avatarUrl && (
              <button
                type="button"
                onClick={removeAvatar}
                disabled={uploading || updateGroup.isPending}
                className="flex items-center gap-1.5 text-xs font-medium text-red-500 transition hover:text-red-600 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" /> Remove group photo
              </button>
            )}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                {group.members.length} members
              </p>
              {isAdmin && (
                <Button size="sm" variant="ghost" onClick={() => setAdding((v) => !v)}>
                  <Plus className="h-4 w-4" /> Add
                </Button>
              )}
            </div>

            {adding && (
              <div className="mb-3 max-h-40 overflow-y-auto rounded-lg border border-slate-200 scrollbar-thin dark:border-slate-700">
                {addableContacts.length === 0 ? (
                  <p className="px-3 py-4 text-center text-sm text-slate-400">No contacts to add.</p>
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
              {group.members.map((m) => {
                const isMe = m.user.id === myId;
                const isTargetOwner = m.role === 'OWNER';
                const busy = setRole.isPending || removeMember.isPending;
                return (
                  <li key={m.user.id} className="flex items-center gap-3 py-2">
                    <Avatar name={m.user.displayName} src={m.user.avatarUrl} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {m.user.displayName}
                        {isMe && ' (you)'}
                      </p>
                      {m.role !== 'MEMBER' && (
                        <p className="text-xs text-brand-600">
                          {m.role === 'OWNER' ? 'Owner' : 'Admin'}
                        </p>
                      )}
                    </div>

                    {/* Admin controls — never on the owner or yourself */}
                    {isAdmin && !isMe && !isTargetOwner && (
                      <div className="flex items-center gap-1">
                        {m.role === 'MEMBER' ? (
                          <button
                            onClick={() => setRole.mutate({ userId: m.user.id, role: 'ADMIN' })}
                            disabled={busy}
                            className="rounded p-1 text-slate-400 hover:text-brand-600 disabled:opacity-50"
                            title="Make admin"
                            aria-label="Make admin"
                          >
                            <Shield className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => setRole.mutate({ userId: m.user.id, role: 'MEMBER' })}
                            disabled={busy}
                            className="rounded p-1 text-brand-600 hover:text-slate-500 disabled:opacity-50"
                            title="Dismiss as admin"
                            aria-label="Dismiss as admin"
                          >
                            <ShieldOff className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => removeMember.mutate(m.user.id)}
                          disabled={busy}
                          className="rounded p-1 text-slate-400 hover:text-red-500 disabled:opacity-50"
                          title="Remove from group"
                          aria-label="Remove member"
                        >
                          <UserMinus className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </Modal>
  );
}
