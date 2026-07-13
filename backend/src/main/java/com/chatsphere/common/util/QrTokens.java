package com.chatsphere.common.util;

import java.security.SecureRandom;
import java.util.Base64;

/**
 * Helpers for the "add me" QR token. The QR encodes {@code chatsphere:add:<token>};
 * scanning it adds the owner instantly. Tokens are rotatable, so a leaked QR
 * image can be invalidated.
 */
public final class QrTokens {

    public static final String PREFIX = "chatsphere:add:";
    private static final SecureRandom RANDOM = new SecureRandom();

    private QrTokens() {}

    /** Alphabet for the short invite code: no 0/O/1/l, so it survives being read aloud. */
    private static final String CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    private static final int CODE_LENGTH = 8;

    /** A fresh url-safe token (~32 chars). */
    public static String newToken() {
        byte[] bytes = new byte[24];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    /**
     * A short random invite code for a shareable "add me" link ({@code /i/<code>}).
     * It encodes nothing — it is a random lookup key, so the link gives away no
     * user id and no long-lived secret, and stays short enough to read out.
     * 56^8 ≈ 9.6e13 possibilities, so guessing one is not feasible.
     */
    public static String newInviteCode() {
        StringBuilder sb = new StringBuilder(CODE_LENGTH);
        for (int i = 0; i < CODE_LENGTH; i++) {
            sb.append(CODE_ALPHABET.charAt(RANDOM.nextInt(CODE_ALPHABET.length())));
        }
        return sb.toString();
    }

    /** Pull the code out of an invite link ({@code https://host/i/<code>}) or take it raw. */
    public static String parseInviteCode(String input) {
        if (input == null) return "";
        String c = input.trim();
        int idx = c.lastIndexOf("/i/");
        if (idx >= 0) c = c.substring(idx + 3);
        int q = c.indexOf('?');
        if (q >= 0) c = c.substring(0, q);
        return c.trim();
    }

    public static String payload(String token) {
        return PREFIX + token;
    }

    /**
     * Accept any form the token might arrive in: a deep-link URL
     * ({@code https://host/add?token=XYZ}), the {@code chatsphere:add:<token>}
     * payload, or the raw token itself.
     */
    public static String parse(String code) {
        if (code == null) return "";
        String c = code.trim();
        int idx = c.indexOf("token=");
        if (idx >= 0) {
            String t = c.substring(idx + "token=".length());
            int amp = t.indexOf('&');
            return amp >= 0 ? t.substring(0, amp) : t;
        }
        return c.startsWith(PREFIX) ? c.substring(PREFIX.length()) : c;
    }
}
