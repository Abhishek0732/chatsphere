package com.chatsphere.user.dto;

import jakarta.validation.constraints.Size;

public record UpdateProfileRequest(
        @Size(max = 100) String displayName,
        @Size(max = 255) String about,
        @Size(max = 512) String avatarUrl,
        Boolean protectAvatar,
        Boolean readReceiptsEnabled,
        Boolean lastSeenEnabled) {}
