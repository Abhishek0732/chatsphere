import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Spinner } from '@/components/ui/Spinner';
import { useContacts } from '@/hooks/useContacts';
import { useStatusPrivacy, useSetStatusPrivacy } from '@/hooks/useStatus';
import { cn } from '@/utils/cn';
import type { StatusPrivacyMode } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
}

const OPTIONS: { mode: StatusPrivacyMode; title: string; hint: string }[] = [
  { mode: 'ALL', title: 'My contacts', hint: 'Everyone in your contacts can see your status' },
  {
    mode: 'EXCEPT',
    title: 'My contacts except…',
    hint: 'Hide your status from the people you pick',
  },
  { mode: 'ONLY', title: 'Only share with…', hint: 'Only the people you pick can see your status' },
];

export function StatusPrivacyModal({ open, onClose }: Props) {
  const { data: privacy, isLoading: loadingPrivacy } = useStatusPrivacy(open);
  const { data: contacts, isLoading: loadingContacts } = useContacts();
  const save = useSetStatusPrivacy();

  const [mode, setMode] = useState<StatusPrivacyMode>('ALL');
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // Load the saved setting into the form whenever the modal (re)opens.
  useEffect(() => {
    if (open && privacy) {
      setMode(privacy.mode);
      setSelected(new Set(privacy.userIds));
    }
  }, [open, privacy]);

  const toggle = (userId: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleSave = () => {
    save.mutate(
      { mode, userIds: mode === 'ALL' ? [] : Array.from(selected) },
      { onSuccess: onClose },
    );
  };

  const needsPicker = mode !== 'ALL';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Status privacy"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={save.isPending}>
            Save
          </Button>
        </>
      }
    >
      {loadingPrivacy ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Who can see your status updates
          </p>

          <div className="space-y-1.5">
            {OPTIONS.map((o) => {
              const active = mode === o.mode;
              return (
                <button
                  key={o.mode}
                  onClick={() => setMode(o.mode)}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-xl border p-3 text-left transition',
                    active
                      ? 'border-brand-500 bg-brand-50 dark:border-brand-500 dark:bg-brand-500/10'
                      : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800',
                  )}
                >
                  <span
                    className={cn(
                      'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                      active ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 dark:border-slate-600',
                    )}
                  >
                    {active && <Check className="h-3.5 w-3.5" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{o.title}</span>
                    <span className="block text-xs text-slate-400">{o.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {needsPicker && (
            <div>
              <p className="mb-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                {mode === 'EXCEPT' ? 'Hide from' : 'Share with'} ({selected.size})
              </p>
              <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200 scrollbar-thin dark:border-slate-700">
                {loadingContacts ? (
                  <div className="flex justify-center py-6">
                    <Spinner />
                  </div>
                ) : (contacts ?? []).length === 0 ? (
                  <p className="px-3 py-6 text-center text-sm text-slate-400">
                    No contacts yet.
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
          )}
        </div>
      )}
    </Modal>
  );
}
