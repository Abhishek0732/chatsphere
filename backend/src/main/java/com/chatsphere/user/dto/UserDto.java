package com.chatsphere.user.dto;

import com.chatsphere.user.User;

import java.time.Instant;

public record UserDto(
        Long id,
        String username,
        String email,
        String displayName,
        String about,
        String avatarUrl,
        Boolean online,
        Instant lastSeen) {

    public static UserDto from(User u) {
        return new UserDto(u.getId(), u.getUsername(), u.getEmail(), u.getDisplayName(),
                u.getAbout(), u.getAvatarUrl(), null, null);
    }

    public static UserDto from(User u, Boolean online, Instant lastSeen) {
        return new UserDto(u.getId(), u.getUsername(), u.getEmail(), u.getDisplayName(),
                u.getAbout(), u.getAvatarUrl(), online, lastSeen);
    }
}
