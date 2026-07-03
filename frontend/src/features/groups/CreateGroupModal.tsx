import { useState } from 'react';
import { Check } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
import { Spinner } from '@/components/ui/Spinner';
import { useContacts } from '@/hooks/useContacts';
import { useCreateGroup } from '@/hooks/useGroups';
import { cn } from '@/utils/cn';

interface CreateGroupModalProps {
  open: boolean;
  onClose: () => void;
}

export function CreateGroupModal({ open, onClose }: CreateGroupModalProps) {
  const { data: contacts, isLoading } = useContacts();
  const createGroup = useCreateGroup();

  const [name, setName] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const toggle = (userId: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const reset = () => {
    setName('');
    setSelected(new Set());
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const canCreate = name.trim().length >= 2 && selected.size >= 1;

  const handleCreate = () => {
    if (!canCreate) return;
    createGroup.mutate(
      { name: name.trim(), memberIds: Array.from(selected) },
      {
        onSuccess: () => {
          reset();
          onClose();
        },
      },
    );
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="New group"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleCreate} loading={createGroup.isPending} disabled={!canCreate}>
            Create
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Group name"
        />

        <div>
          <p className="mb-2 text-sm font-medium text-slate-600 dark:text-slate-300">
            Add members ({selected.size})
          </p>
          <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 scrollbar-thin dark:border-slate-700">
            {isLoading ? (
              <div className="flex justify-center py-6">
                <Spinner />
              </div>
            ) : (contacts ?? []).length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-slate-400">
                No contacts. Add contacts first.
              </p>
            ) : (
              (contacts ?? []).map((c) => {
                const isSel = selected.has(c.user.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => toggle(c.user.id)}
                    className="flex w-full items-center gap-3 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <Avatar name={c.user.displayName} src={c.user.avatarUrl} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-left text-sm">
                      {c.user.displayName}
                    </span>
                    <span
                      className={cn(
                        'flex h-5 w-5 items-center justify-center rounded-full border',
                        isSel
                          ? 'border-brand-600 bg-brand-600 text-white'
                          : 'border-slate-300 dark:border-slate-600',
                      )}
                    >
                      {isSel && <Check className="h-3.5 w-3.5" />}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
