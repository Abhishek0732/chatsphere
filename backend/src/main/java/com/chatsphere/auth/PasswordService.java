package com.chatsphere.auth;

import com.chatsphere.auth.dto.AuthDtos.*;
import com.chatsphere.common.error.ApiException;
import com.chatsphere.user.User;
import com.chatsphere.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.HexFormat;

/**
 * Change / forgot / reset password. Reset tokens are random 256-bit values;
 * only their SHA-256 hash is stored. On any password change we revoke every
 * refresh token so other sessions are logged out (messenger-style).
 */
@Service
public class PasswordService {

    private static final Logger log = LoggerFactory.getLogger(PasswordService.class);
    private static final long RESET_TTL_MINUTES = 30;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final PasswordResetTokenRepository resetTokenRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordResetEmailService emailService;

    public PasswordService(UserRepository userRepository,
                           PasswordEncoder passwordEncoder,
                           PasswordResetTokenRepository resetTokenRepository,
                           RefreshTokenRepository refreshTokenRepository,
                           PasswordResetEmailService emailService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.resetTokenRepository = resetTokenRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.emailService = emailService;
    }

    /** Change the password of the currently authenticated user. */
    @Transactional
    public void changePassword(Long userId, ChangePasswordRequest req) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> ApiException.unauthorized("Not authenticated"));
        if (!passwordEncoder.matches(req.currentPassword(), user.getPasswordHash())) {
            throw ApiException.badRequest("Current password is incorrect");
        }
        if (passwordEncoder.matches(req.newPassword(), user.getPasswordHash())) {
            throw ApiException.badRequest("New password must be different from the current one");
        }
        user.setPasswordHash(passwordEncoder.encode(req.newPassword()));
        userRepository.save(user);
        refreshTokenRepository.revokeAllForUser(userId);
    }

    /**
     * Begin a reset. Always returns normally (never reveals whether the email is
     * registered); if it is, an outstanding-token sweep runs and a fresh link is
     * emailed.
     */
    @Transactional
    public void forgotPassword(ForgotPasswordRequest req) {
        userRepository.findByEmail(req.email().trim()).ifPresent(user -> {
            resetTokenRepository.invalidateAllForUser(user.getId());

            String rawToken = newRawToken();
            PasswordResetToken token = new PasswordResetToken();
            token.setUserId(user.getId());
            token.setTokenHash(sha256Hex(rawToken));
            token.setExpiresAt(Instant.now().plus(RESET_TTL_MINUTES, ChronoUnit.MINUTES));
            resetTokenRepository.save(token);

            emailService.sendResetLink(user.getEmail(), user.getDisplayName(), rawToken);
        });
        // Fall through silently for unknown addresses — no account enumeration.
    }

    /** Complete a reset using the emailed token. */
    @Transactional
    public void resetPassword(ResetPasswordRequest req) {
        PasswordResetToken token = resetTokenRepository.findByTokenHash(sha256Hex(req.token().trim()))
                .orElseThrow(() -> ApiException.badRequest("This reset link is invalid or has already been used"));
        if (token.getUsedAt() != null) {
            throw ApiException.badRequest("This reset link has already been used");
        }
        if (token.getExpiresAt().isBefore(Instant.now())) {
            throw ApiException.badRequest("This reset link has expired. Please request a new one");
        }
        User user = userRepository.findById(token.getUserId())
                .orElseThrow(() -> ApiException.badRequest("Account no longer exists"));

        user.setPasswordHash(passwordEncoder.encode(req.newPassword()));
        userRepository.save(user);

        token.setUsedAt(Instant.now());
        resetTokenRepository.save(token);

        // Log out every existing session after a reset.
        refreshTokenRepository.revokeAllForUser(user.getId());
        log.info("Password reset completed for user {}", user.getId());
    }

    private static String newRawToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static String sha256Hex(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }
}
