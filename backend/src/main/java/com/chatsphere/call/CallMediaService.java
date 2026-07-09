package com.chatsphere.call;

import com.chatsphere.call.dto.CallDtos.IceConfigDto;
import com.chatsphere.call.dto.CallDtos.IceServer;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;

/**
 * Supplies the ICE servers the browser needs to negotiate a native peer-to-peer
 * WebRTC call. There is no SFU and no media token anymore — audio flows directly
 * between the two browsers, relayed through TURN only when a direct path can't be
 * found. We hand the client three tiers so a path exists on any network:
 *
 *  1. Public STUN — discover each peer's own public address (cheap, no relay).
 *  2. Self-hosted Coturn — a short-lived HMAC credential; ideal on the LAN.
 *  3. Free public TURN — the relay that carries audio across different networks
 *     (or through an HTTP-only tunnel) when neither peer is directly reachable.
 *
 * ICE tries them all and picks the best working pair, so the same config just
 * works over localhost, LAN, and a public tunnel.
 */
@Service
public class CallMediaService {

    private final MediaProperties props;

    public CallMediaService(MediaProperties props) {
        this.props = props;
    }

    public IceConfigDto iceConfig(Long userId) {
        List<IceServer> servers = new ArrayList<>();

        // 1. Public STUN — reflexive candidate discovery, works from any network.
        servers.add(new IceServer(List.of("stun:stun.l.google.com:19302"), null, null));

        // 2. Self-hosted Coturn with a short-lived HMAC credential (LAN-optimal;
        //    harmless elsewhere — unreachable candidates are simply skipped).
        MediaProperties.Turn turn = props.turn();
        if (turn != null && turn.enabled() && turn.secret() != null && !turn.secret().isBlank()) {
            long expiry = Instant.now().getEpochSecond() + turn.ttlSeconds();
            String username = expiry + ":" + userId;
            String credential = turnCredential(username, turn.secret());
            servers.add(new IceServer(
                    List.of("turn:" + turn.host() + ":3478?transport=udp",
                            "turn:" + turn.host() + ":3478?transport=tcp"),
                    username, credential));
        }

        // 3. Free public TURN relay — the cross-network fallback.
        MediaProperties.PublicTurn pt = props.publicTurn();
        if (pt != null && pt.enabled() && pt.urls() != null && !pt.urls().isEmpty()) {
            servers.add(new IceServer(pt.urls(), pt.username(), pt.credential()));
        }

        return new IceConfigDto(servers);
    }

    /** Coturn REST auth: base64(HMAC-SHA1(secret, "expiry:userId")). */
    private static String turnCredential(String username, String secret) {
        try {
            Mac mac = Mac.getInstance("HmacSHA1");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA1"));
            byte[] raw = mac.doFinal(username.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(raw);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to compute TURN credential", e);
        }
    }
}
