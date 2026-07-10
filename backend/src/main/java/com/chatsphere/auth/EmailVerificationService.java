package com.chatsphere.auth;

import com.chatsphere.common.error.ApiException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.util.HexFormat;

/**
 * Email-ownership verification for signup: emails a 6-digit OTP, verifies it,
 * and remembers (briefly, in Redis) that an address was proven so registration
 * can require it. OTPs are stored hashed with a TTL; a small attempt cap blocks
 * brute force.
 */
@Service
public class EmailVerificationService {

    private static final Logger log = LoggerFactory.getLogger(EmailVerificationService.class);
    private static final SecureRandom RANDOM = new SecureRandom();

    private static final Duration OTP_TTL = Duration.ofMinutes(10);
    private static final Duration VERIFIED_TTL = Duration.ofMinutes(30);
    private static final int MAX_ATTEMPTS = 5;

    private static final String OTP_KEY = "otp:register:";
    private static final String ATTEMPTS_KEY = "otp:attempts:";
    private static final String VERIFIED_KEY = "otp:verified:";

    private final StringRedisTemplate redis;
    private final JavaMailSender mailSender;
    private final String from;

    public EmailVerificationService(
            StringRedisTemplate redis,
            JavaMailSender mailSender,
            @Value("${chatsphere.app.mail-from:ChatSphere <no-reply@chatsphere.local>}") String from) {
        this.redis = redis;
        this.mailSender = mailSender;
        this.from = from;
    }

    /** Generate + email a fresh OTP for an address (replaces any prior code). */
    public void sendOtp(String rawEmail) {
        String email = normalize(rawEmail);
        String code = String.format("%06d", RANDOM.nextInt(1_000_000));
        redis.opsForValue().set(OTP_KEY + email, sha256Hex(code), OTP_TTL);
        redis.delete(ATTEMPTS_KEY + email);
        sendOtpEmail(email, code);
    }

    /** Verify a submitted code; on success remember the address as verified. */
    public void verifyOtp(String rawEmail, String code) {
        String email = normalize(rawEmail);
        String stored = redis.opsForValue().get(OTP_KEY + email);
        if (stored == null) {
            throw ApiException.badRequest("The code has expired. Please request a new one");
        }
        Long attempts = redis.opsForValue().increment(ATTEMPTS_KEY + email);
        redis.expire(ATTEMPTS_KEY + email, OTP_TTL);
        if (attempts != null && attempts > MAX_ATTEMPTS) {
            redis.delete(OTP_KEY + email);
            throw ApiException.badRequest("Too many attempts. Please request a new code");
        }
        if (!stored.equals(sha256Hex(code.trim()))) {
            throw ApiException.badRequest("Incorrect code. Please try again");
        }
        redis.delete(OTP_KEY + email);
        redis.delete(ATTEMPTS_KEY + email);
        redis.opsForValue().set(VERIFIED_KEY + email, "1", VERIFIED_TTL);
    }

    public boolean isVerified(String rawEmail) {
        return Boolean.TRUE.equals(redis.hasKey(VERIFIED_KEY + normalize(rawEmail)));
    }

    /** Require a proven address (used at registration); throws if not verified. */
    public void assertVerified(String rawEmail) {
        if (!isVerified(rawEmail)) {
            throw ApiException.badRequest("Please verify your email address first");
        }
    }

    /** Drop the verified marker once the account is created. */
    public void clearVerified(String rawEmail) {
        redis.delete(VERIFIED_KEY + normalize(rawEmail));
    }

    @Async
    void sendOtpEmail(String toEmail, String code) {
        try {
            SimpleMailMessage msg = new SimpleMailMessage();
            msg.setFrom(from);
            msg.setTo(toEmail);
            msg.setSubject(code + " is your ChatSphere verification code");
            msg.setText(
                    "Welcome to ChatSphere!\n\n"
                    + "Your email verification code is:\n\n"
                    + "    " + code + "\n\n"
                    + "Enter it to finish creating your account. The code expires in 10 minutes.\n\n"
                    + "If you didn't try to sign up, you can ignore this email.\n\n"
                    + "— ChatSphere");
            mailSender.send(msg);
            log.info("Verification code sent to {}", toEmail);
        } catch (MailException e) {
            log.error("Failed to send verification code to {}: {}", toEmail, e.getMessage());
        }
    }

    private static String normalize(String email) {
        return email == null ? "" : email.trim().toLowerCase();
    }

    private static String sha256Hex(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }
}
