// ---------------------------------------------------------------------------
// Domain types. These mirror the backend API contract exactly.
// ---------------------------------------------------------------------------

export interface User {
  id: number;
  username: string;
  email: string;
  displayName: string;
  about?: string;
  avatarUrl?: string;
  online?: boolean;
  lastSeen?: string;
}

export type MessageType = 'TEXT' | 'IMAGE' | 'FILE';
export type MessageStatus = 'SENT' | 'DELIVERED' | 'READ';

export interface Message {
  id: number;
  conversationId: number;
  senderId: number;
  senderName: string;
  content: string;
  type: MessageType;
  attachmentUrl?: string;
  createdAt: string;
  status: MessageStatus;
  /** Present only for optimistic messages awaiting server echo. */
  tempId?: string;
  /** Client-only flag: message failed to send. */
  failed?: boolean;
  /** Soft-deleted message ("This message was deleted"). */
  deleted?: boolean;
  /** Snapshot of the message this one replies to. */
  replyTo?: ReplyPreview | null;
  /** Emoji reactions grouped by emoji. */
  reactions?: MessageReaction[];
  /** Pinned in the conversation. */
  pinned?: boolean;
  /** ISO timestamp if the message was edited; null/absent otherwise. */
  editedAt?: string | null;
}

export interface MessageReaction {
  emoji: string;
  userIds: number[];
}

export type StatusType = 'IMAGE' | 'VIDEO' | 'TEXT';

export interface StatusItem {
  id: number;
  type: StatusType;
  mediaUrl?: string | null;
  caption?: string | null;
  bgColor?: string | null;
  musicUrl?: string | null;
  createdAt: string;
  viewed: boolean;
  viewCount: number;
}

export interface StatusUser {
  user: User;
  me: boolean;
  allViewed: boolean;
  items: StatusItem[];
}

export interface StatusViewer {
  user: User;
  viewedAt: string;
}

export interface CreateStatusPayload {
  type: StatusType;
  mediaUrl?: string;
  caption?: string;
  bgColor?: string;
  musicUrl?: string;
}

export interface ReplyPreview {
  id: number;
  senderName: string;
  content: string | null;
  type: MessageType;
}

export type ConversationType = 'DIRECT' | 'GROUP';

export interface ConversationSummary {
  id: number;
  /** Opaque, unguessable id used in URLs (the numeric `id` stays internal). */
  publicId: string;
  type: ConversationType;
  name: string;
  avatarUrl?: string;
  lastMessage?: Message | null;
  unreadCount: number;
  members: User[];
  updatedAt: string;
}

export interface Contact {
  id: number;
  contactUserId: number;
  user: User;
  createdAt?: string;
}

export interface ContactRequest {
  id: number;
  user: User;
  direction: 'INCOMING' | 'OUTGOING';
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  createdAt: string;
}

export interface SendRequestResult {
  status: 'PENDING' | 'ACCEPTED';
}

export type GroupRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export interface GroupMember {
  user: User;
  role: GroupRole;
}

export interface GroupDetail {
  id: number;
  name: string;
  avatarUrl?: string;
  members: GroupMember[];
  createdBy: number;
}

export interface MediaUploadResult {
  url: string;
  fileName: string;
  contentType: string;
  size: number;
}

export type NotificationType = 'MESSAGE' | 'GROUP_INVITE' | 'CONTACT_REQUEST' | 'SYSTEM';

export interface AppNotification {
  id: number;
  type: NotificationType | string;
  title: string;
  body: string;
  conversationId?: number;
  read: boolean;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
  displayName: string;
}

export interface LoginPayload {
  usernameOrEmail: string;
  password: string;
}

// ---------------------------------------------------------------------------
// WebSocket payloads
// ---------------------------------------------------------------------------

export interface ChatSendPayload {
  conversationId: number;
  content: string;
  type: MessageType;
  attachmentUrl?: string;
  replyToId?: number;
  tempId: string;
}

export interface MessageDeletedEvent {
  conversationId: number;
  messageId: number;
}

export interface TypingEvent {
  conversationId: number;
  userId: number;
  userName: string;
  typing: boolean;
}

export interface ReadEvent {
  conversationId: number;
  userId: number;
  messageId: number;
}

export interface PresenceEvent {
  userId: number;
  online: boolean;
  lastSeen?: string;
}
