import { create } from 'zustand';
import { authAccessors } from './authStore';
import type { PresenceEvent, ReplyPreview } from '@/types';

interface TypingUser {
  userId: number;
  userName: string;
}

interface PresenceInfo {
  online: boolean;
  lastSeen?: string;
}

interface ChatState {
  activeConversationId: number | null;

  /** conversationId -> set of users currently typing */
  typing: Record<number, TypingUser[]>;
  /** userId -> presence */
  presence: Record<number, PresenceInfo>;
  /** conversationId -> draft text */
  drafts: Record<number, string>;
  /** conversationId -> message being replied to (null = none) */
  replyTo: Record<number, ReplyPreview | null>;
  /** conversationId -> message being edited (null = none) */
  editing: Record<number, { id: number; content: string } | null>;

  connected: boolean;

  setActiveConversation: (id: number | null) => void;

  setReplyTo: (conversationId: number, target: ReplyPreview | null) => void;
  clearReplyTo: (conversationId: number) => void;

  setEditing: (conversationId: number, target: { id: number; content: string } | null) => void;
  clearEditing: (conversationId: number) => void;

  setTyping: (conversationId: number, user: TypingUser, typing: boolean) => void;
  clearTyping: (conversationId: number) => void;

  setPresence: (event: PresenceEvent) => void;
  bulkSetPresence: (events: PresenceEvent[]) => void;
  isOnline: (userId: number) => boolean;

  setDraft: (conversationId: number, text: string) => void;
  clearDraft: (conversationId: number) => void;

  setConnected: (connected: boolean) => void;
}

export const useChatStore = create<ChatState>()((set, get) => ({
  activeConversationId: null,
  typing: {},
  presence: {},
  drafts: {},
  replyTo: {},
  editing: {},
  connected: false,

  setActiveConversation: (id) => set({ activeConversationId: id }),

  setReplyTo: (conversationId, target) =>
    set((state) => ({ replyTo: { ...state.replyTo, [conversationId]: target } })),

  clearReplyTo: (conversationId) =>
    set((state) => ({ replyTo: { ...state.replyTo, [conversationId]: null } })),

  setEditing: (conversationId, target) =>
    set((state) => ({ editing: { ...state.editing, [conversationId]: target } })),

  clearEditing: (conversationId) =>
    set((state) => ({ editing: { ...state.editing, [conversationId]: null } })),

  setTyping: (conversationId, user, typing) =>
    set((state) => {
      const current = state.typing[conversationId] ?? [];
      const without = current.filter((u) => u.userId !== user.userId);
      const next = typing ? [...without, user] : without;
      return { typing: { ...state.typing, [conversationId]: next } };
    }),

  clearTyping: (conversationId) =>
    set((state) => ({ typing: { ...state.typing, [conversationId]: [] } })),

  setPresence: (event) =>
    set((state) => {
      // Reciprocal last-seen: if I've hidden mine, I don't get to see anyone's.
      // The server already withholds it; this is the client half of the mirror.
      if (authAccessors.getUser()?.lastSeenEnabled === false) return state;
      return {
        presence: {
          ...state.presence,
          [event.userId]: { online: event.online, lastSeen: event.lastSeen },
        },
      };
    }),

  bulkSetPresence: (events) =>
    set((state) => {
      const next = { ...state.presence };
      for (const e of events) {
        next[e.userId] = { online: e.online, lastSeen: e.lastSeen };
      }
      return { presence: next };
    }),

  isOnline: (userId) => Boolean(get().presence[userId]?.online),

  setDraft: (conversationId, text) =>
    set((state) => ({ drafts: { ...state.drafts, [conversationId]: text } })),

  clearDraft: (conversationId) =>
    set((state) => {
      const next = { ...state.drafts };
      delete next[conversationId];
      return { drafts: next };
    }),

  setConnected: (connected) => set({ connected }),
}));
