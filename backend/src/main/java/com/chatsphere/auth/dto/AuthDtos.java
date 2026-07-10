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

    /** Signup step 1: request an email verification code. */
    public record SendOtpRequest(@NotBlank @Email String email) {}

    /** Signup step 2: confirm the emailed code. */
    public record VerifyOtpRequest(
            @NotBlank @Email String email,
            @NotBlank @Size(min = 4, max = 8) String code) {}

    public record RefreshRequest(@NotBlank String refreshToken) {}

    public record LogoutRequest(@NotBlank String refreshToken) {}

    /** Authenticated user changing their own password (must know the current one). */
    public record ChangePasswordRequest(
            @NotBlank String currentPassword,
            @NotBlank @Size(min = 6, max = 100) String newPassword) {}

    /** Start a reset: we email a link if the address maps to an account. */
    public record ForgotPasswordRequest(@NotBlank @Email String email) {}

    /** Finish a reset with the emailed token. */
    public record ResetPasswordRequest(
            @NotBlank String token,
            @NotBlank @Size(min = 6, max = 100) String newPassword) {}

    public record TokenPair(String accessToken, String refreshToken) {}

    public record AuthResponse(String accessToken, String refreshToken, UserDto user) {}
}
