package com.chatsphere.auth;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

/**
 * Sends the password-reset email. Kept deliberately simple (plain text) and
 * fire-and-forget: a mail failure must never leak whether an address exists nor
 * fail the request, so sending is async and swallows errors (logged only).
 */
@Service
public class PasswordResetEmailService {

    private static final Logger log = LoggerFactory.getLogger(PasswordResetEmailService.class);

    private final JavaMailSender mailSender;
    private final String frontendUrl;
    private final String from;

    public PasswordResetEmailService(
            JavaMailSender mailSender,
            @Value("${chatsphere.app.frontend-url:http://localhost:5173}") String frontendUrl,
            @Value("${chatsphere.app.mail-from:ChatSphere <no-reply@chatsphere.local>}") String from) {
        this.mailSender = mailSender;
        this.frontendUrl = frontendUrl.replaceAll("/+$", "");
        this.from = from;
    }

    @Async
    public void sendResetLink(String toEmail, String displayName, String rawToken) {
        String link = frontendUrl + "/reset-password?token="
                + URLEncoder.encode(rawToken, StandardCharsets.UTF_8);
        try {
            SimpleMailMessage msg = new SimpleMailMessage();
            msg.setFrom(from);
            msg.setTo(toEmail);
            msg.setSubject("Reset your ChatSphere password");
            msg.setText(
                    "Hi " + (displayName == null || displayName.isBlank() ? "there" : displayName) + ",\n\n"
                    + "We received a request to reset your ChatSphere password. "
                    + "Click the link below to choose a new one:\n\n"
                    + link + "\n\n"
                    + "This link expires in 30 minutes and can be used once. "
                    + "If you didn't request this, you can safely ignore this email — "
                    + "your password won't change.\n\n"
                    + "— ChatSphere");
            mailSender.send(msg);
            log.info("Password reset email sent to {}", toEmail);
        } catch (MailException e) {
            log.error("Failed to send password reset email to {}: {}", toEmail, e.getMessage());
        }
    }
}
