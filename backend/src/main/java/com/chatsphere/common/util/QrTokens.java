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

    /** A fresh url-safe token (~32 chars). */
    public static String newToken() {
        byte[] bytes = new byte[24];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
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
