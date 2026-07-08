package com.chatsphere.call;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Media-plane configuration: the LiveKit SFU the client connects to, and the
 * Coturn TURN/STUN server for NAT traversal. Secrets come from the environment
 * (never committed) — the shared LiveKit api secret signs access tokens; the
 * Coturn secret signs short-lived TURN credentials.
 */
@ConfigurationProperties(prefix = "chatsphere.media")
public record MediaProperties(LiveKit livekit, Turn turn) {

    public record LiveKit(String url, String apiKey, String apiSecret, long tokenTtlSeconds) {}

    public record Turn(boolean enabled, String host, String secret, long ttlSeconds) {}
}
