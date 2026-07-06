/** Centralised TanStack Query keys so cache reads/writes stay consistent. */
export const queryKeys = {
  me: ['me'] as const,
  conversations: ['conversations'] as const,
  messages: (conversationId: number) => ['messages', conversationId] as const,
  contacts: ['contacts'] as const,
  contactRequests: ['contactRequests'] as const,
  contactRequestsOutgoing: ['contactRequests', 'outgoing'] as const,
  blocked: ['blocked'] as const,
  notifications: ['notifications'] as const,
  group: (id: number) => ['group', id] as const,
  userSearch: (q: string) => ['userSearch', q] as const,
  messageSearch: (q: string) => ['messageSearch', q] as const,
};
