import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Check, Copy, Eye, EyeOff, Mail, MessageCircle, RefreshCw, Share2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/Avatar';
import { Spinner } from '@/components/ui/Spinner';
import { getMyInvite, rotateMyInvite } from '@/api/users';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/toastStore';
import { copyText } from '@/utils/clipboard';
import { queryClient } from '@/services/queryClient';
import { cn } from '@/utils/cn';

const INVITE_KEY = ['invite', 'me'] as const;

/**
 * Share a personal "add me" link.
 *
 * The link is deliberately SHORT and opaque — /i/<random code> — so it can be
 * pasted anywhere without exposing a long-lived secret or a user id, and the
 * full URL is masked on screen by default: it's meant to be sent, not read.
 * Resetting it invalidates every copy already shared.
 */
export function InviteFriendsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const me = useAuthStore((s) => s.user);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: INVITE_KEY,
    queryFn: getMyInvite,
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const rotate = useMutation({
    mutationFn: rotateMyInvite,
    onSuccess: (next) => {
      queryClient.setQueryData(INVITE_KEY, next);
      setCopied(false);
      toast({
        title: 'New invite link created',
        description: 'Links you shared before no longer work.',
        variant: 'success',
      });
    },
    onError: () => toast({ title: 'Could not reset the link', variant: 'error' }),
  });

  // Built from the CURRENT origin, so the link works on localhost, a LAN IP or
  // a public tunnel without anything being baked in at build time.
  const url = data ? `${window.location.origin}/i/${data.code}` : '';
  // Masked form: enough to recognise, not enough to leak over someone's shoulder.
  const masked = data ? `${window.location.origin}/i/${'•'.repeat(data.code.length)}` : '';
  const text = `Add me on ChatSphere 👋`;

  const copy = async () => {
    const ok = await copyText(url);
    setCopied(ok);
    toast({ title: ok ? 'Invite link copied' : 'Copy failed', variant: ok ? 'success' : 'error' });
    if (ok) setTimeout(() => setCopied(false), 2000);
  };

  const share = async () => {
    if (!navigator.share) return copy();
    try {
      await navigator.share({ title: 'Join me on ChatSphere', text, url });
    } catch {
      // Share sheet dismissed — nothing to do.
    }
  };

  const openExternal = (href: string) => window.open(href, '_blank', 'noopener,noreferrer');

  return (
    <Modal open={open} onClose={onClose} title="Invite friends">
      {isLoading || !data ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-2 text-center">
            <Avatar name={me?.displayName ?? '?'} src={me?.avatarUrl} size="lg" />
            <p className="text-sm text-on-surface-variant">
              Share your personal link. Whoever opens it sends you a contact
              request — you still choose whether to accept.
            </p>
          </div>

          {/* The link itself is masked: it is meant to be shared, not read. */}
          <div className="flex items-center gap-2 rounded-xl bg-surface-container-high px-3 py-2.5">
            <span className="min-w-0 flex-1 truncate font-mono text-sm text-on-surface">
              {revealed ? url : masked}
            </span>
            <button
              onClick={() => setRevealed((r) => !r)}
              className="shrink-0 rounded-lg p-1.5 text-on-surface-variant transition hover:bg-white/5 hover:text-on-surface"
              aria-label={revealed ? 'Hide link' : 'Show link'}
            >
              {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={copy}
              className={cn(
                'flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition',
                copied
                  ? 'bg-primary-container text-on-primary-container'
                  : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest',
              )}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied' : 'Copy link'}
            </button>
            <button
              onClick={share}
              className="message-gradient-sent flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-on-primary shadow transition active:scale-[0.98]"
            >
              <Share2 className="h-4 w-4" /> Share
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() =>
                openExternal(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`)
              }
              className="flex items-center justify-center gap-2 rounded-xl bg-surface-container-high px-4 py-2.5 text-sm font-medium text-on-surface transition hover:bg-surface-container-highest"
            >
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </button>
            <button
              onClick={() =>
                openExternal(
                  `mailto:?subject=${encodeURIComponent('Join me on ChatSphere')}&body=${encodeURIComponent(`${text}\n\n${url}`)}`,
                )
              }
              className="flex items-center justify-center gap-2 rounded-xl bg-surface-container-high px-4 py-2.5 text-sm font-medium text-on-surface transition hover:bg-surface-container-highest"
            >
              <Mail className="h-4 w-4" /> Email
            </button>
          </div>

          <button
            onClick={() => rotate.mutate()}
            disabled={rotate.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-on-surface-variant transition hover:bg-white/5 hover:text-on-surface disabled:opacity-60"
          >
            <RefreshCw className={cn('h-4 w-4', rotate.isPending && 'animate-spin')} />
            Reset link
          </button>
          <p className="text-center text-xs text-on-surface-variant">
            Resetting stops every link you’ve already shared from working.
          </p>
        </div>
      )}
    </Modal>
  );
}
