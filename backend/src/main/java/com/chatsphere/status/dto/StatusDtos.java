package com.chatsphere.status.dto;

import com.chatsphere.user.dto.UserDto;
import jakarta.validation.constraints.NotBlank;

import java.time.Instant;
import java.util.List;

public final class StatusDtos {

    private StatusDtos() {}

    public record CreateStatusRequest(
            @NotBlank String type,
            String mediaUrl,
            String caption,
            String bgColor,
            String musicUrl) {}

    /** Reply to a status: a free-text message, an emoji reaction, or both. */
    public record StatusReplyRequest(String text, String emoji) {}

    /** Current status-privacy setting: mode plus the chosen user ids. */
    public record StatusPrivacyDto(String mode, List<Long> userIds) {}

    public record StatusItemDto(
            Long id,
            String type,
            String mediaUrl,
            String caption,
            String bgColor,
            String musicUrl,
            Instant createdAt,
            boolean viewed,
            long viewCount) {}

    /** All of one user's active statuses, grouped. */
    public record StatusUserDto(UserDto user, boolean me, boolean allViewed, List<StatusItemDto> items) {}

    public record StatusViewerDto(UserDto user, Instant viewedAt) {}
}
