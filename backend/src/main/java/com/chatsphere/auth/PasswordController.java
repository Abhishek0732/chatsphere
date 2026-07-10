package com.chatsphere.auth;

import com.chatsphere.auth.dto.AuthDtos.*;
import com.chatsphere.common.security.SecurityUtils;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * Password management. Forgot/reset live under {@code /api/auth/**} (public, per
 * SecurityConfig); change-password lives under {@code /api/account/**} so it
 * requires authentication.
 */
@RestController
public class PasswordController {

    private final PasswordService passwordService;

    public PasswordController(PasswordService passwordService) {
        this.passwordService = passwordService;
    }

    /** Authenticated: change your own password (needs the current password). */
    @PostMapping("/api/account/password")
    public ResponseEntity<Void> changePassword(@Valid @RequestBody ChangePasswordRequest req) {
        passwordService.changePassword(SecurityUtils.currentUserId(), req);
        return ResponseEntity.noContent().build();
    }

    /** Public: request a reset link. Always 204 — never reveals if the email exists. */
    @PostMapping("/api/auth/forgot-password")
    public ResponseEntity<Void> forgotPassword(@Valid @RequestBody ForgotPasswordRequest req) {
        passwordService.forgotPassword(req);
        return ResponseEntity.noContent().build();
    }

    /** Public: set a new password using the emailed token. */
    @PostMapping("/api/auth/reset-password")
    public ResponseEntity<Void> resetPassword(@Valid @RequestBody ResetPasswordRequest req) {
        passwordService.resetPassword(req);
        return ResponseEntity.noContent().build();
    }
}
