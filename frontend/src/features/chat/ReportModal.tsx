import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useReportUser } from '@/hooks/useReport';
import { cn } from '@/utils/cn';
import type { User } from '@/types';

const REASONS: { key: string; label: string }[] = [
  { key: 'spam', label: 'Spam' },
  { key: 'harassment', label: 'Harassment or bullying' },
  { key: 'nudity', label: 'Nudity or sexual content' },
  { key: 'scam', label: 'Scam or fraud' },
  { key: 'other', label: 'Something else' },
];

export function ReportModal({
  open,
  onClose,
  user,
  onAlsoBlock,
}: {
  open: boolean;
  onClose: () => void;
  user: User;
  /** Offered as a convenience — reporting and blocking are separate actions. */
  onAlsoBlock?: () => void;
}) {
  const [reason, setReason] = useState('spam');
  const [details, setDetails] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(true);
  const report = useReportUser();

  useEffect(() => {
    if (open) {
      setReason('spam');
      setDetails('');
      setAlsoBlock(true);
    }
  }, [open]);

  const submit = () => {
    report.mutate(
      { userId: user.id, payload: { reason, details: details.trim() || undefined } },
      {
        onSuccess: () => {
          if (alsoBlock) onAlsoBlock?.();
          onClose();
        },
      },
    );
  };

  return (
    <Modal open={open} onClose={onClose} title={`Report ${user.displayName}`}>
      <div className="space-y-4">
        <p className="text-sm text-on-surface-variant">
          Tell us what's wrong. Reports are private — {user.displayName} won't be notified.
        </p>

        <div className="space-y-1.5">
          {REASONS.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setReason(r.key)}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm transition',
                reason === r.key ? 'bg-primary/15 text-primary' : 'glass-panel hover:bg-white/5',
              )}
            >
              <span
                className={cn(
                  'grid h-4 w-4 place-items-center rounded-full border',
                  reason === r.key ? 'border-primary' : 'border-white/30',
                )}
              >
                {reason === r.key && <span className="h-2 w-2 rounded-full bg-primary" />}
              </span>
              {r.label}
            </button>
          ))}
        </div>

        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="Add any details (optional)"
          rows={3}
          maxLength={1000}
          className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/70 focus:border-primary/60 focus:outline-none"
        />

        <label className="flex items-center gap-2.5 text-sm text-on-surface">
          <input
            type="checkbox"
            checked={alsoBlock}
            onChange={(e) => setAlsoBlock(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          Also block {user.displayName}
        </label>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-4 py-2 text-sm font-medium text-on-surface-variant transition hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={report.isPending}
            className="rounded-full bg-error px-5 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
          >
            {report.isPending ? 'Reporting…' : 'Report'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
