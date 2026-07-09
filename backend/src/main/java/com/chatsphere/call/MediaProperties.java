package com.chatsphere.call;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Media-plane configuration for native peer-to-peer WebRTC. Calls flow
 * browser↔browser; these servers only help the two peers find a path to each
 * other (NAT traversal):
 *
 *  - {@code turn}       — our self-hosted Coturn, great on the LAN (short-lived
 *                         HMAC credentials signed with the Coturn secret).
 *  - {@code publicTurn} — a free public TURN relay, the fallback that makes
 *                         cross-network calls work when neither peer is directly
 *                         reachable (behind NAT or an HTTP-only tunnel).
 *
 * Secrets come from the environment, never committed. The legacy {@code livekit}
 * block is unused now (media is native P2P, no SFU) but kept so existing config
 * binds cleanly.
 */
@ConfigurationProperties(prefix = "chatsphere.media")
public record MediaProperties(LiveKit livekit, Turn turn, PublicTurn publicTurn) {

    public record LiveKit(String url, String apiKey, String apiSecret, long tokenTtlSeconds) {}

    public record Turn(boolean enabled, String host, String secret, long ttlSeconds) {}

    /** A shared-credential public TURN relay (e.g. OpenRelay, or Cloudflare TURN). */
    public record PublicTurn(boolean enabled, java.util.List<String> urls,
                             String username, String credential) {}
}
