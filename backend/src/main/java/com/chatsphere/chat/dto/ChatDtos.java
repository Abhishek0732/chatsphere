package com.chatsphere.chat.dto;

import com.chatsphere.user.dto.UserDto;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.util.List;

/** Request/response and WebSocket payload records for the chat module. */
public final class ChatDtos {

    private ChatDtos() {}

    public record MessageDto(
            Long id,
            Long conversationId,
            Long senderId,
            String senderName,
            String content,
            String type,
            String attachmentUrl,
            Instant createdAt,
            String status,
            String tempId,
            boolean deleted,
            ReplyPreview replyTo,
            List<ReactionDto> reactions,
            boolean pinned,
            Instant editedAt,
            StatusRef statusRef,
            /** Ids of the users @mentioned in this message (group chats). */
            List<Long> mentions,
            /** True when `content` is ciphertext: only the two participants can read it. */
            boolean encrypted,
            /** When set, the message auto-disappears after this instant (client hides it too). */
            Instant expiresAt,
            /** View-once media: opens once for the recipient, then is gone. */
            boolean viewOnce,
            /** True once the recipient has opened a view-once message (then `attachmentUrl` is null). */
            boolean viewOnceSeen,
            /** Server-unfurled preview of a URL in the message; null when there is none. */
            LinkPreviewDto linkPreview) {}

    /** A small Open Graph preview of a link found in a message. */
    public record LinkPreviewDto(String title, String description, String imageUrl,
                                 String siteName, String url) {}

    /** An emoji and the ids of everyone who reacted with it. */
    public record ReactionDto(String emoji, List<Long> userIds) {}

    /** Lightweight snapshot of the message being replied to. */
    public record ReplyPreview(Long id, String senderName, String content, String type) {}

    /** Snapshot of the status a message replies/reacts to (messenger-style quote). */
    public record StatusRef(Long id, String type, String mediaUrl, String caption, String bgColor) {}

    public record ConversationSummaryDto(
            Long id,
            String publicId,
            String type,
            String name,
            String avatarUrl,
            MessageDto lastMessage,
            long unreadCount,
            /**
             * DIRECT: both participants (the client resolves the other person's
             * name/avatar from this). GROUP: empty — a 500-member roster has no
             * business in a list of 350 chats; the thread fetches it on demand.
             */
            List<UserDto> members,
            /** Always the true member count, even when `members` is empty. */
            int memberCount,
            Instant updatedAt,
            /** Disappearing-messages timer in seconds; null = off. */
            Integer disappearingTtlSeconds) {}

    public record CreateDirectRequest(@NotNull Long targetUserId) {}

    // ── WebSocket inbound commands ──
    public record SendMessageCommand(
            @NotNull Long conversationId,
            String content,
            String type,
            String attachmentUrl,
            Long replyToId,
            String tempId,
            List<Long> mentions,
            /** True when `content` is ciphertext the server cannot read (direct chats). */
            boolean encrypted,
            /** True to make an attached media message view-once (opens once, then gone). */
            boolean viewOnce) {}

    public record TypingCommand(@NotNull Long conversationId, boolean typing) {}

    public record ReadCommand(@NotNull Long conversationId, @NotNull Long messageId) {}

    public record DeleteCommand(@NotNull Long conversationId, @NotNull Long messageId) {}

    public record ReactCommand(@NotNull Long conversationId, @NotNull Long messageId, String emoji) {}

    public record PinCommand(@NotNull Long conversationId, @NotNull Long messageId, boolean pinned) {}

    public record EditCommand(@NotNull Long conversationId, @NotNull Long messageId, String content) {}

    /** Set (or clear, with null) the disappearing-messages timer for a conversation. */
    public record DisappearingRequest(Integer ttlSeconds) {}

    /** Pushed to a conversation's members when its disappearing timer changes. */
    public record DisappearingEvent(Long conversationId, Long changedByUserId,
                                    String changedByName, Integer ttlSeconds) {}

    // ── WebSocket outbound events ──
    public record TypingEvent(Long conversationId, Long userId, String userName, boolean typing) {}

    public record ReadEvent(Long conversationId, Long userId, Long messageId) {}

    public record MessageDeletedEvent(Long conversationId, Long messageId) {}

    /** A single line of an exported chat transcript (text-only). */
    public record ExportMessageDto(String senderName, String type, String content,
                                   java.time.Instant createdAt, boolean deleted) {}

    /** messenger-style "Message info": who has seen one of my messages, and who hasn't. */
    public record MessageInfoDto(List<UserDto> readBy, List<UserDto> pending) {}

    /** A shared media/attachment item for the contact info panel. */
    public record MediaItemDto(Long id, String type, String attachmentUrl, String content,
                               java.time.Instant createdAt) {}
}
