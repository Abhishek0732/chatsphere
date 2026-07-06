import { useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Ban,
  Bell,
  BellOff,
  FileText,
  Image as ImageIcon,
  Link as LinkIcon,
  Pin,
  Play,
  UserCheck,
  Users,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/utils/cn';
import { useMessages } from '@/hooks/useMessages';
import { useCommonGroups } from '@/hooks/useConversations';
import { useMuteStore } from '@/store/muteStore';
import { useChatStore } from '@/store/chatStore';
import { useImageViewer } from '@/store/imageViewerStore';
import { useBlockUser, useIsBlocked, useUnblockUser } from '@/hooks/useBlocks';
import { fileNameFromUrl, formatLastSeen, isAudioUrl, isVideoUrl } from '@/utils/format';
import { mediaSrc } from '@/utils/media';
import { downloadFile } from '@/utils/download';
import type { ConversationSummary, Message, User } from '@/types';

interface ChatInfoModalProps {
  open: boolean;
  onClose: () => void;
  conversation: ConversationSummary;
  other?: User;
}

const URL_RE = /(https?:\/\/[^\s]+)/gi;
type Tab = 'media' | 'links' | 'files';

export function ChatInfoModal({ open, onClose, conversation, other }: ChatInfoModalProps) {
  const { messages } = useMessages(conversation.id);
  const { data: commonGroups } = useCommonGroups(conversation.id, open);
  const isMuted = useMuteStore((s) => s.muted[conversation.id]);
  const toggleMute = useMuteStore((s) => s.toggleMute);
  const openViewer = useImageViewer((s) => s.open);
  const presence = useChatStore((s) => (other ? s.presence[other.id] : undefined));
  const blockUser = useBlockUser();
  const unblockUser = useUnblockUser();
  const blocked = useIsBlocked(other?.id);

  const [tab, setTab] = useState<Tab>('media');

  const { media, files, links, pinned } = useMemo(() => {
    const list = messages.filter((m) => !m.deleted);
    const media = list.filter(
      (m) => m.type === 'IMAGE' || (m.type === 'FILE' && isVideoUrl(m.attachmentUrl)),
    );
    const files = list.filter(
      (m) =>
        m.type === 'FILE' && !isVideoUrl(m.attachmentUrl) && !isAudioUrl(m.attachmentUrl),
    );
    const links: { message: Message; url: string }[] = [];
    for (const m of list) {
      const found = m.content?.match(URL_RE);
      if (found) found.forEach((url) => links.push({ message: m, url }));
    }
    const pinned = list.filter((m) => m.pinned);
    return { media, files, links, pinned };
  }, [messages]);

  const subtitle = other
    ? presence?.online
      ? 'online'
      : formatLastSeen(presence?.lastSeen ?? other.lastSeen)
    : `${conversation.members.length} members`;

  const tabs: { key: Tab; label: string; count: number; icon: typeof ImageIcon }[] = [
    { key: 'media', label: 'Media', count: media.length, icon: ImageIcon },
    { key: 'links', label: 'Links', count: links.length, icon: LinkIcon },
    { key: 'files', label: 'Files', count: files.length, icon: FileText },
  ];

  return (
    <Modal open={open} onClose={onClose} title="Contact info">
      <div className="max-h-[70vh] space-y-5 overflow-y-auto scrollbar-thin">
        {/* Profile header */}
        <div className="flex flex-col items-center text-center">
          <Avatar
            name={conversation.name}
            src={conversation.avatarUrl}
            size="xl"
            className="ring-2 ring-brand-500/30"
            onClick={() => openViewer(conversation.name, conversation.avatarUrl, { circle: true })}
          />
          <h2 className="mt-3 text-lg font-semibold">{conversation.name}</h2>
          {other?.username && (
            <p className="text-sm text-slate-400">@{other.username}</p>
          )}
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
          {other?.about && (
            <p className="mt-2 max-w-xs text-sm text-slate-600 dark:text-slate-300">{other.about}</p>
          )}
        </div>

        {/* Media / Links / Files */}
        <section>
          <div className="mb-2 flex gap-2">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition',
                  tab === t.key
                    ? 'bg-brand-gradient text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300',
                )}
              >
                <t.icon className="h-3.5 w-3.5" /> {t.label} · {t.count}
              </button>
            ))}
          </div>

          {tab === 'media' &&
            (media.length ? (
              <div className="grid grid-cols-3 gap-1.5">
                {media.map((m) => (
                  <button
                    key={m.id}
                    onClick={() =>
                      m.type === 'IMAGE' && openViewer(m.content || 'Photo', m.attachmentUrl)
                    }
                    className="relative aspect-square overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800"
                  >
                    {m.type === 'IMAGE' ? (
                      <img
                        src={mediaSrc(m.attachmentUrl)}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <>
                        <video
                          src={mediaSrc(m.attachmentUrl)}
                          preload="metadata"
                          className="h-full w-full object-cover"
                        />
                        <span className="absolute inset-0 flex items-center justify-center bg-black/30 text-white">
                          <Play className="h-6 w-6" />
                        </span>
                      </>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <Empty text="No media shared yet" />
            ))}

          {tab === 'links' &&
            (links.length ? (
              <ul className="space-y-1.5">
                {links.map(({ message, url }, i) => (
                  <li key={`${message.id}-${i}`}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block truncate rounded-lg bg-slate-50 px-3 py-2 text-sm text-brand-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-brand-400 dark:hover:bg-slate-700"
                    >
                      {url}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty text="No links shared yet" />
            ))}

          {tab === 'files' &&
            (files.length ? (
              <ul className="space-y-1.5">
                {files.map((m) => (
                  <li key={m.id}>
                    <button
                      onClick={() =>
                        void downloadFile(m.attachmentUrl!, fileNameFromUrl(m.attachmentUrl))
                      }
                      className="flex w-full items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-left text-sm hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700"
                    >
                      <FileText className="h-5 w-5 shrink-0 text-slate-400" />
                      <span className="min-w-0 flex-1 truncate">
                        {fileNameFromUrl(m.attachmentUrl)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty text="No files shared yet" />
            ))}
        </section>

        {/* Pinned messages */}
        {pinned.length > 0 && (
          <Section icon={Pin} title={`Pinned messages · ${pinned.length}`}>
            <ul className="space-y-1.5">
              {pinned.map((m) => (
                <li
                  key={m.id}
                  className="truncate rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                >
                  {m.content || (m.type === 'IMAGE' ? '📷 Photo' : '📎 Attachment')}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Groups in common */}
        {other && (commonGroups?.length ?? 0) > 0 && (
          <Section icon={Users} title={`Groups in common · ${commonGroups!.length}`}>
            <ul className="space-y-1">
              {commonGroups!.map((g) => (
                <li key={g.id}>
                  <NavLink
                    to={`/chat/${g.publicId}`}
                    onClick={onClose}
                    className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <Avatar name={g.name} src={g.avatarUrl} size="sm" />
                    <span className="truncate text-sm font-medium">{g.name}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Mute + Block */}
        <div className="space-y-1 border-t border-slate-200 pt-3 dark:border-slate-700">
          <button
            onClick={() => toggleMute(conversation.id)}
            className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {isMuted ? <BellOff className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
            {isMuted ? 'Unmute notifications' : 'Mute notifications'}
          </button>
          {other && (
            <button
              onClick={() => (blocked ? unblockUser.mutate(other) : blockUser.mutate(other))}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left',
                blocked
                  ? 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                  : 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20',
              )}
            >
              {blocked ? <UserCheck className="h-5 w-5" /> : <Ban className="h-5 w-5" />}
              {blocked ? `Unblock ${other.displayName}` : `Block ${other.displayName}`}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof ImageIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
        <Icon className="h-3.5 w-3.5" /> {title}
      </h3>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-6 text-center text-sm text-slate-400">{text}</p>;
}
