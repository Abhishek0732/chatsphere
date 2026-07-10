package com.chatsphere.user.dto;

/** The current user's QR: {@code token} identifies them, {@code payload} is what the QR image encodes. */
public record QrDto(String token, String payload) {}
