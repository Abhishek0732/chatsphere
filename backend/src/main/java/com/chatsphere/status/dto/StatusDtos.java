package com.chatsphere.status.dto;

import com.chatsphere.user.dto.UserDto;
import jakarta.validation.constraints.NotBlank;

import java.time.Instant;
import java.util.List;

public final class StatusDtos {

    private StatusDtos() {}

    /** One photo/video within a status. `type` is IMAGE or VIDEO. */
    public record StatusMediaDto(String url, String type) {}

    public record CreateStatusRequest(
            @NotBlank String type,
            String mediaUrl,
            /**
             * Several photos/videos picked at once, shown together in one status
             * frame. When present (2+ items) this wins; `mediaUrl` still carries the
             * first item for older single-media consumers.
             */
            List<StatusMediaDto> media,
            String caption,
            String bgColor,
            String musicUrl,
            String musicTitle,
            String musicArtist,
            Integer musicDurationMs,
            /** Ids of the contacts @mentioned in the caption/text. */
            List<Long> mentions) {}

    /** Reply to a status: a free-text message, an emoji reaction, or both. */
    public record StatusReplyRequest(String text, String emoji) {}

    /** Current status-privacy setting: mode plus the chosen user ids. */
    public record StatusPrivacyDto(String mode, List<Long> userIds) {}

    public record StatusItemDto(
            Long id,
            String type,
            String mediaUrl,
            /** The full album (1+ items). A single-media status has exactly one. */
            List<StatusMediaDto> media,
            String caption,
            String bgColor,
            String musicUrl,
            String musicTitle,
            String musicArtist,
            Integer musicDurationMs,
            Instant createdAt,
            boolean viewed,
            long viewCount,
            /** The people @mentioned in this status, resolved for rendering. */
            List<UserDto> mentions,
            /** Set when this status was added from someone else's: who made it. */
            UserDto originalUser,
            /**
             * Whether the viewer may add this status to their own — true only when
             * they were @mentioned in it and haven't already added it.
             */
            boolean canAdd) {}

    /** All of one user's active statuses, grouped. */
    public record StatusUserDto(UserDto user, boolean me, boolean allViewed, List<StatusItemDto> items) {}

    public record StatusViewerDto(UserDto user, Instant viewedAt) {}
}
