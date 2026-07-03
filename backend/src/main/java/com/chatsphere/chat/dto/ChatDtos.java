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
            ReplyPreview replyTo) {}

    /** Lightweight snapshot of the message being replied to. */
    public record ReplyPreview(Long id, String senderName, String content, String type) {}

    public record ConversationSummaryDto(
            Long id,
            String publicId,
            String type,
            String name,
            String avatarUrl,
            MessageDto lastMessage,
            long unreadCount,
            List<UserDto> members,
            Instant updatedAt) {}

    public record CreateDirectRequest(@NotNull Long targetUserId) {}

    // ── WebSocket inbound commands ──
    public record SendMessageCommand(
            @NotNull Long conversationId,
            String content,
            String type,
            String attachmentUrl,
            Long replyToId,
            String tempId) {}

    public record TypingCommand(@NotNull Long conversationId, boolean typing) {}

    public record ReadCommand(@NotNull Long conversationId, @NotNull Long messageId) {}

    public record DeleteCommand(@NotNull Long conversationId, @NotNull Long messageId) {}

    // ── WebSocket outbound events ──
    public record TypingEvent(Long conversationId, Long userId, String userName, boolean typing) {}

    public record ReadEvent(Long conversationId, Long userId, Long messageId) {}

    public record MessageDeletedEvent(Long conversationId, Long messageId) {}
}
