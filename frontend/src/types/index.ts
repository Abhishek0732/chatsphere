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
  /** When true, other clients block download + deter screenshots of this photo. */
  protectAvatar?: boolean;
  /** This account was deleted — they can't be messaged. */
  deleted?: boolean;
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
  /** Snapshot of the status this message replies/reacts to, if any. */
  statusRef?: StatusRef | null;
  /** Ids of the users @mentioned in this message (group chats). */
  mentions?: number[];
}

/** Quoted snapshot of a status a message answers (WhatsApp-style). */
export interface StatusRef {
  id: number;
  type: StatusType;
  mediaUrl?: string | null;
  caption?: string | null;
  bgColor?: string | null;
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
  musicTitle?: string | null;
  musicArtist?: string | null;
  musicDurationMs?: number | null;
  createdAt: string;
  viewed: boolean;
  viewCount: number;
  /** People @mentioned in the caption/text. */
  mentions?: User[];
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
  musicTitle?: string;
  musicArtist?: string;
  musicDurationMs?: number;
  /** Ids of the contacts @mentioned in the caption/text. */
  mentions?: number[];
}

export interface StatusReplyPayload {
  text?: string;
  emoji?: string;
}

export type StatusPrivacyMode = 'ALL' | 'EXCEPT' | 'ONLY';

export interface StatusPrivacy {
  mode: StatusPrivacyMode;
  /** Chosen user ids: excluded when EXCEPT, allowed when ONLY. */
  userIds: number[];
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
  /** DIRECT: both participants. GROUP: empty — fetch the roster with useGroup(). */
  members: User[];
  /** True member count, even when `members` is empty (groups). */
  memberCount: number;
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

/** Outcome of adding people to a group: contacts join, strangers are invited. */
export interface AddMembersResult {
  group: GroupDetail;
  added: User[];
  invited: User[];
}

/** A pending "join this group" invite, as shown to the invitee. */
export interface GroupInvite {
  id: number;
  groupId: number;
  groupName: string;
  groupAvatarUrl?: string;
  inviter: User;
  createdAt: string;
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
  mentions?: number[];
}

/** WhatsApp-style "Message info": who has seen one of my messages. */
export interface MessageInfo {
  readBy: User[];
  pending: User[];
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

// ---------------------------------------------------------------------------
// Calls (voice signaling — Phase 1: no media yet)
// ---------------------------------------------------------------------------

export type CallType = 'VOICE' | 'VIDEO';

/**
 * Server -> client call signal. One flat shape discriminated by `type`, mirroring
 * the backend CallSignal. `type` ∈ INCOMING_CALL, CALL_RINGING, CALL_ACCEPTED,
 * CALL_DECLINED, CALL_CANCELLED, CALL_ENDED, CALL_MISSED, CALL_BUSY,
 * CALL_UNAVAILABLE, CALL_TAKEN, CALL_FAILED.
 */
export interface CallSignal {
  type: string;
  callId: string | null;
  callType: CallType;
  callerId: number;
  callerName?: string;
  callerAvatarUrl?: string;
  calleeId: number;
  calleeName?: string;
  calleeAvatarUrl?: string;
  conversationId?: number | null;
  durationSeconds?: number | null;
  reason?: string | null;
  at: string;
  /** WEBRTC_OFFER / WEBRTC_ANSWER: the SDP. */
  sdp?: string | null;
  /** WEBRTC_ICE: a JSON-encoded RTCIceCandidate. */
  candidate?: string | null;
}

/** Outbound invite command (client generates callId so it can cancel instantly). */
export interface CallInvitePayload {
  callId: string;
  calleeId: number;
  type: CallType;
  conversationId?: number | null;
}

/** The current on-screen call, framed from this user's perspective. */
export type CallPhase = 'incoming' | 'outgoing' | 'active' | 'ended';

export interface ActiveCall {
  callId: string;
  type: CallType;
  phase: CallPhase;
  peer: { id: number; name: string; avatarUrl?: string };
  outgoing: boolean;
  /** epoch ms the call went active — drives the on-screen timer */
  answeredAt?: number;
  /** short human label shown on the ended screen (e.g. "No answer") */
  endedLabel?: string;
  durationSeconds?: number;
  /** live connection quality of the local leg: excellent | good | poor | lost */
  quality?: string;
}

/** A WebRTC ICE server (STUN, or TURN with a credential) from the backend. */
export interface IceServer {
  urls: string[];
  username?: string | null;
  credential?: string | null;
}

/** GET /api/calls/ice-servers — ICE servers for the native P2P connection. */
export interface IceConfig {
  iceServers: IceServer[];
}

/** A shared media/attachment item (GET /conversations/{id}/media). */
export interface MediaItem {
  id: number;
  type: string;
  attachmentUrl?: string;
  content?: string;
  createdAt: string;
}

/** One line of an exported chat transcript (GET /conversations/{id}/export). */
export interface ExportMessage {
  senderName: string;
  type: string;
  content?: string | null;
  createdAt: string;
  deleted: boolean;
}

/** GET /api/calls row. */
export interface CallHistoryItem {
  callId: string;
  type: CallType;
  status: string;
  endReason?: string | null;
  counterpartId: number;
  counterpartName?: string;
  counterpartAvatarUrl?: string;
  outgoing: boolean;
  conversationId?: number | null;
  createdAt: string;
  answeredAt?: string | null;
  endedAt?: string | null;
  durationSeconds?: number | null;
}

/** GET /api/calls/active (204 -> null). */
export interface ActiveCallDto {
  callId: string;
  type: CallType;
  status: string;
  callerId: number;
  callerName?: string;
  callerAvatarUrl?: string;
  calleeId: number;
  calleeName?: string;
  calleeAvatarUrl?: string;
  outgoing: boolean;
  conversationId?: number | null;
  createdAt: string;
  answeredAt?: string | null;
}
