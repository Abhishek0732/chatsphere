import { useEffect, useState } from 'react';
import {
  Ban,
  Bell,
  BellOff,
  Flag,
  Search,
  ShieldCheck,
  User as UserIcon,
  X,
  Lock,
} from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { useMuteStore } from '@/store/muteStore';
import { useBlockUser, useIsBlocked, useUnblockUser } from '@/hooks/useBlocks';
import { canEncryptWith, getMyPublicKey } from '@/services/e2ee';
import { getPeerKey } from '@/api/keys';
import { safetyNumber } from '@/services/crypto';
import { useVerifiedStore } from '@/store/verifiedStore';
import { useE2eeStore } from '@/store/e2eeStore';
import { useImageViewer } from '@/store/imageViewerStore';
import { ConversationMediaPreview } from './ConversationMediaPreview';
import { SafetyNumberModal } from './SafetyNumberModal';
import { ReportModal } from './ReportModal';
import { toast } from '@/store/toastStore';
import { cn } from '@/utils/cn';
import type { ConversationSummary, User } from '@/types';

function Action({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="group flex flex-col items-center gap-1.5">
      <span
        className={cn(
          'flex h-11 w-11 items-center justify-center rounded-full glass-panel transition-all group-hover:bg-primary group-hover:text-on-primary',
          active && 'bg-primary text-on-primary',
        )}
      >
        {icon}
      </span>
      <span className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">{label}</span>
    </button>
  );
}

export function ContactInfoPanel({
  conversation,
  other,
  onClose,
}: {
  conversation: ConversationSummary;
  other?: User;
  onClose: () => void;
}) {
  const openViewer = useImageViewer((s) => s.open);
  const muted = useMuteStore((s) => s.muted[conversation.id]);
  const toggleMute = useMuteStore((s) => s.toggleMute);
  const blocked = useIsBlocked(other?.id);
  const blockUser = useBlockUser();
  const unblockUser = useUnblockUser();
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  // Only claim encryption when it is genuinely happening (both sides hold keys).
  const e2eeReady = useE2eeStore((st) => st.ready);
  const [encrypted, setEncrypted] = useState(false);
  // The current safety number, so the panel can show whether this contact is verified
  // and invalidate the badge automatically if either key changes.
  const [safetyNum, setSafetyNum] = useState<string | null>(null);
  const verified = useVerifiedStore((s) =>
    other?.id != null && safetyNum ? s.verified[other.id] === safetyNum : false,
  );
  useEffect(() => {
    let live = true;
    if (conversation.type !== 'DIRECT' || other?.id == null) {
      setEncrypted(false);
      setSafetyNum(null);
      return;
    }
    const peerId = other.id;
    void canEncryptWith(peerId)
      .then(async (can) => {
        if (!live) return;
        setEncrypted(can);
        if (!can) {
          setSafetyNum(null);
          return;
        }
        const num = await safetyNumber(getMyPublicKey(), (await getPeerKey(peerId)).publicKey);
        if (live) setSafetyNum(num);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [conversation.type, other?.id, e2eeReady]);

  const subtitle = other?.about || (other?.username ? `@${other.username}` : `${conversation.memberCount ?? conversation.members.length} members`);

  return (
    <aside className="fixed inset-0 z-40 flex h-full w-full shrink-0 flex-col overflow-y-auto border-white/5 bg-surface-container-lowest cs-scroll lg:static lg:z-auto lg:w-80 lg:border-l">
      <div className="flex justify-end p-3">
        <button onClick={onClose} className="rounded-lg p-1.5 text-on-surface-variant transition hover:bg-white/5 hover:text-on-surface" aria-label="Close info">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Profile */}
      <div className="flex flex-col items-center gap-4 px-5 pb-2 text-center">
        <button onClick={() => openViewer(conversation.name, conversation.avatarUrl, { circle: true, protected: !!other?.protectAvatar })}>
          <Avatar name={conversation.name} src={conversation.avatarUrl} guarded={!!other?.protectAvatar} className="h-28 w-28 border-4 border-primary/20 p-1 text-3xl shadow-2xl" />
        </button>
        <div>
          <h3 className="text-2xl font-bold leading-tight text-on-surface">{conversation.name}</h3>
          <p className="mt-1 text-sm text-on-surface-variant">{subtitle}</p>
        </div>
        <div className="flex gap-6 pt-1">
          <Action icon={<UserIcon className="h-5 w-5" />} label="Profile" onClick={() => openViewer(conversation.name, conversation.avatarUrl, { circle: true, protected: !!other?.protectAvatar })} />
          <Action icon={muted ? <BellOff className="h-5 w-5" /> : <Bell className="h-5 w-5" />} label={muted ? 'Unmute' : 'Mute'} active={muted} onClick={() => toggleMute(conversation.id)} />
          <Action icon={<Search className="h-5 w-5" />} label="Search" onClick={() => toast({ title: 'In-chat search coming soon', variant: 'info' })} />
        </div>
      </div>

      {/* Media, Links and Docs — preview + See more (shared with the group info). */}
      <div className="px-5 pb-4 pt-6">
        <ConversationMediaPreview conversationId={conversation.id} />
      </div>

      {/* Options */}
      <div className="mt-auto space-y-2 px-5 pb-6">
        {/* Where someone looks when they want to know whether this chat is private.
            Shown only when the messages really are encrypted — and it replaces a
            "Starred Messages" row that was a button wired to nothing at all. */}
        {encrypted && (
          <div className="flex w-full items-start gap-3 rounded-xl glass-panel p-3.5 text-left">
            <Lock className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <span>
              <span className="block text-base text-on-surface">End-to-end encrypted</span>
              <span className="block text-sm text-on-surface-variant">
                Messages are locked on your device. Only you and {other?.displayName ?? 'they'}{' '}
                can read them — not ChatSphere.
              </span>
            </span>
          </div>
        )}
        {encrypted && other && (
          <button
            onClick={() => setVerifyOpen(true)}
            className="flex w-full items-center gap-3 rounded-xl glass-panel p-3.5 text-left transition hover:bg-white/5"
          >
            <ShieldCheck className={cn('h-5 w-5 shrink-0', verified ? 'text-emerald-500' : 'text-on-surface-variant')} />
            <span className="min-w-0 flex-1">
              <span className="block text-base text-on-surface">Verify security code</span>
              <span className="block text-sm text-on-surface-variant">
                {verified ? 'Verified — no one is in the middle' : 'Confirm no one is intercepting'}
              </span>
            </span>
          </button>
        )}
        {other && (
          <button onClick={() => (blocked ? unblockUser.mutate(other) : blockUser.mutate(other))} className="flex w-full items-center gap-3 rounded-xl glass-panel p-3.5 text-left transition hover:bg-white/5">
            <Ban className="h-5 w-5 text-error" />
            <span className="text-base text-error">{blocked ? `Unblock ${other.displayName}` : 'Block Contact'}</span>
          </button>
        )}
        {other && (
          <button onClick={() => setReportOpen(true)} className="flex w-full items-center gap-3 rounded-xl glass-panel p-3.5 text-left transition hover:bg-white/5">
            <Flag className="h-5 w-5 text-error" />
            <span className="text-base text-error">Report {other.displayName}</span>
          </button>
        )}
      </div>

      {other && (
        <>
          <SafetyNumberModal
            open={verifyOpen}
            onClose={() => setVerifyOpen(false)}
            peerId={other.id}
            peerName={other.displayName}
          />
          <ReportModal
            open={reportOpen}
            onClose={() => setReportOpen(false)}
            user={other}
            onAlsoBlock={() => !blocked && blockUser.mutate(other)}
          />
        </>
      )}
    </aside>
  );
}
