package com.chatsphere.auth.dto;

import com.chatsphere.user.dto.UserDto;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Container for the auth-related request/response records. */
public final class AuthDtos {

    private AuthDtos() {}

    public record RegisterRequest(
            @NotBlank @Size(min = 3, max = 50) String username,
            @NotBlank @Email String email,
            @NotBlank @Size(min = 6, max = 100) String password,
            @NotBlank @Size(max = 100) String displayName) {}

    public record LoginRequest(
            @NotBlank String usernameOrEmail,
            @NotBlank String password) {}

    public record RefreshRequest(@NotBlank String refreshToken) {}

    public record LogoutRequest(@NotBlank String refreshToken) {}

    public record TokenPair(String accessToken, String refreshToken) {}

    public record AuthResponse(String accessToken, String refreshToken, UserDto user) {}
}
