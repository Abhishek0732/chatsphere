import type { ConversationSummary, User } from '@/types';

/** For a DIRECT conversation, return the member that isn't the current user. */
export function otherMember(
  conversation: ConversationSummary,
  myId: number | undefined,
): User | undefined {
  if (conversation.type !== 'DIRECT') return undefined;
  return conversation.members.find((m) => m.id !== myId) ?? conversation.members[0];
}

/** Preview text for the last message in a conversation. */
export function lastMessagePreview(conversation: ConversationSummary): string {
  const m = conversation.lastMessage;
  if (!m) return 'No messages yet';
  switch (m.type) {
    case 'IMAGE':
      return m.content ? `📷 ${m.content}` : '📷 Photo';
    case 'FILE':
      return m.content ? `📎 ${m.content}` : '📎 Attachment';
    default:
      return m.content;
  }
}
