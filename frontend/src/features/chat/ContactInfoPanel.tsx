import { Ban, Bell, BellOff, ChevronRight, Search, Star, User as UserIcon, X } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { useMuteStore } from '@/store/muteStore';
import { useBlockUser, useIsBlocked, useUnblockUser } from '@/hooks/useBlocks';
import { useImageViewer } from '@/store/imageViewerStore';
import { mediaSrc } from '@/utils/media';
import { toast } from '@/store/toastStore';
import { cn } from '@/utils/cn';
import type { ConversationSummary, Message, User } from '@/types';

/** Circular glass action with a caps label (Profile / Mute / Search). */
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

/**
 * The reference contact/media info panel — a slide-in third column with the
 * contact's photo, quick actions, shared media and block control.
 */
export function ContactInfoPanel({
  conversation,
  other,
  images,
  onClose,
}: {
  conversation: ConversationSummary;
  other?: User;
  images: Message[];
  onClose: () => void;
}) {
  const openViewer = useImageViewer((s) => s.open);
  const muted = useMuteStore((s) => s.muted[conversation.id]);
  const toggleMute = useMuteStore((s) => s.toggleMute);
  const blocked = useIsBlocked(other?.id);
  const blockUser = useBlockUser();
  const unblockUser = useUnblockUser();

  const media = images.filter((m) => m.attachmentUrl).slice(-9).reverse();
  const subtitle = other?.about || (other?.username ? `@${other.username}` : `${conversation.members.length} members`);

  return (
    <aside className="hidden h-full w-72 shrink-0 flex-col overflow-y-auto border-l border-white/5 bg-surface-container-lowest cs-scroll xl:flex">
      <div className="flex justify-end p-3">
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-on-surface-variant transition hover:bg-white/5 hover:text-on-surface"
          aria-label="Close info"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Profile */}
      <div className="flex flex-col items-center gap-4 px-5 pb-2 text-center">
        <button
          onClick={() =>
            openViewer(conversation.name, conversation.avatarUrl, {
              circle: true,
              protected: !!other?.protectAvatar,
            })
          }
        >
          <Avatar
            name={conversation.name}
            src={conversation.avatarUrl}
            guarded={!!other?.protectAvatar}
            className="h-28 w-28 border-4 border-primary/20 p-1 text-3xl shadow-2xl"
          />
        </button>
        <div>
          <h3 className="text-2xl font-bold leading-tight text-on-surface">{conversation.name}</h3>
          <p className="mt-1 text-sm text-on-surface-variant">{subtitle}</p>
        </div>

        <div className="flex gap-6 pt-1">
          <Action
            icon={<UserIcon className="h-5 w-5" />}
            label="Profile"
            onClick={() => openViewer(conversation.name, conversation.avatarUrl, { circle: true })}
          />
          <Action
            icon={muted ? <BellOff className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
            label={muted ? 'Unmute' : 'Mute'}
            active={muted}
            onClick={() => toggleMute(conversation.id)}
          />
          <Action
            icon={<Search className="h-5 w-5" />}
            label="Search"
            onClick={() => toast({ title: 'In-chat search coming soon', variant: 'info' })}
          />
        </div>
      </div>

      {/* Media */}
      <div className="space-y-3 px-5 pb-4 pt-6">
        <div className="flex items-center justify-between">
          <h4 className="text-base font-semibold text-on-surface">Media, Links and Docs</h4>
          {media.length > 0 && (
            <span className="cursor-pointer text-sm text-primary hover:underline">See all</span>
          )}
        </div>
        {media.length > 0 ? (
          <div className="grid grid-cols-3 gap-1.5">
            {media.map((m) => (
              <button
                key={m.tempId ?? m.id}
                onClick={() => openViewer(m.content || 'Photo', m.attachmentUrl)}
                className="aspect-square overflow-hidden rounded-lg glass-panel"
              >
                <img
                  src={mediaSrc(m.attachmentUrl)}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 hover:scale-110"
                />
              </button>
            ))}
          </div>
        ) : (
          <p className="rounded-xl glass-panel px-3 py-4 text-center text-sm text-on-surface-variant">
            Shared media appears here
          </p>
        )}
      </div>

      {/* Options */}
      <div className="mt-auto space-y-2 px-5 pb-6">
        <button className="flex w-full items-center justify-between rounded-xl glass-panel p-3.5 text-left transition hover:bg-white/5">
          <span className="flex items-center gap-3">
            <Star className="h-5 w-5 text-on-surface-variant" />
            <span className="text-base text-on-surface">Starred Messages</span>
          </span>
          <ChevronRight className="h-5 w-5 text-on-surface-variant" />
        </button>
        {other && (
          <button
            onClick={() => (blocked ? unblockUser.mutate(other) : blockUser.mutate(other))}
            className="flex w-full items-center gap-3 rounded-xl glass-panel p-3.5 text-left transition hover:bg-white/5"
          >
            <Ban className="h-5 w-5 text-error" />
            <span className="text-base text-error">
              {blocked ? `Unblock ${other.displayName}` : 'Block Contact'}
            </span>
          </button>
        )}
      </div>
    </aside>
  );
}
