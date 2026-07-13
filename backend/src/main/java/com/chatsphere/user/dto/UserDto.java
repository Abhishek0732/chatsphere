package com.chatsphere.user.dto;

import com.chatsphere.user.User;

import java.time.Instant;

/**
 * A user as the client sees them. {@code deleted} is true once the account has
 * been closed — the client uses it to stop offering a composer in that chat.
 */
public record UserDto(
        Long id,
        String username,
        String email,
        String displayName,
        String about,
        String avatarUrl,
        Boolean online,
        Instant lastSeen,
        boolean protectAvatar,
        boolean deleted) {

    public static UserDto from(User u) {
        return new UserDto(u.getId(), u.getUsername(), u.getEmail(), u.getDisplayName(),
                u.getAbout(), u.getAvatarUrl(), null, null, u.isProtectAvatar(),
                u.getDeletedAt() != null);
    }

    public static UserDto from(User u, Boolean online, Instant lastSeen) {
        return new UserDto(u.getId(), u.getUsername(), u.getEmail(), u.getDisplayName(),
                u.getAbout(), u.getAvatarUrl(), online, lastSeen, u.isProtectAvatar(),
                u.getDeletedAt() != null);
    }
}
