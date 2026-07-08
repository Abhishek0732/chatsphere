package com.chatsphere.call;

import com.chatsphere.call.domain.Call;
import com.chatsphere.call.dto.CallDtos.CallTokenDto;
import com.chatsphere.call.dto.CallDtos.IceServer;
import com.chatsphere.call.repo.CallRepository;
import com.chatsphere.common.error.ApiException;
import com.chatsphere.user.User;
import com.chatsphere.user.UserRepository;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.Mac;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * The one bridge between the signaling plane and the media plane: mints the
 * LiveKit access token (a signed room grant) and the short-lived Coturn TURN
 * credential for a participant. The client asks for this only for a call it's
 * actually in, and only while it's ACTIVE — the SFU then enforces the grant.
 */
@Service
public class CallMediaService {

    private final MediaProperties props;
    private final CallRepository callRepository;
    private final UserRepository userRepository;

    public CallMediaService(MediaProperties props,
                            CallRepository callRepository,
                            UserRepository userRepository) {
        this.props = props;
        this.callRepository = callRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public CallTokenDto tokenFor(Long userId, String callUid) {
        Call call = callRepository.findByCallUid(callUid)
                .orElseThrow(() -> ApiException.notFound("Call not found"));
        if (!userId.equals(call.getCallerId()) && !userId.equals(call.getCalleeId())) {
            throw ApiException.forbidden("Not a participant in this call");
        }
        if (call.getStatus() != Call.Status.ACTIVE) {
            throw ApiException.badRequest("Call is not active");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> ApiException.notFound("User not found"));

        String room = "call_" + call.getCallUid();
        String identity = "user_" + userId;
        String token = livekitToken(identity, user.getDisplayName(), room);
        return new CallTokenDto(props.livekit().url(), token, room, identity, iceServers(userId));
    }

    /** LiveKit access token: an HS256 JWT carrying a room-scoped video grant. */
    private String livekitToken(String identity, String name, String room) {
        MediaProperties.LiveKit lk = props.livekit();
        Instant now = Instant.now();
        SecretKey key = Keys.hmacShaKeyFor(lk.apiSecret().getBytes(StandardCharsets.UTF_8));

        Map<String, Object> grant = new LinkedHashMap<>();
        grant.put("room", room);
        grant.put("roomJoin", true);
        grant.put("canPublish", true);
        grant.put("canSubscribe", true);
        grant.put("canPublishData", true);

        return Jwts.builder()
                .issuer(lk.apiKey())
                .subject(identity)
                .claim("name", name)
                .claim("video", grant)
                .issuedAt(Date.from(now))
                .notBefore(Date.from(now.minusSeconds(10)))
                .expiration(Date.from(now.plusSeconds(lk.tokenTtlSeconds())))
                // LiveKit only accepts HS256 — force it (a >256-bit secret would
                // otherwise make jjwt auto-select HS512, which LiveKit rejects).
                .signWith(key, Jwts.SIG.HS256)
                .compact();
    }

    /** STUN (always) plus a TURN relay with a short-lived HMAC credential (Coturn REST auth). */
    private List<IceServer> iceServers(Long userId) {
        MediaProperties.Turn turn = props.turn();
        List<IceServer> servers = new ArrayList<>();
        servers.add(new IceServer(List.of("stun:" + turn.host() + ":3478"), null, null));

        if (turn.enabled() && turn.secret() != null && !turn.secret().isBlank()) {
            long expiry = Instant.now().getEpochSecond() + turn.ttlSeconds();
            String username = expiry + ":" + userId;
            String credential = turnCredential(username, turn.secret());
            servers.add(new IceServer(
                    List.of("turn:" + turn.host() + ":3478?transport=udp",
                            "turn:" + turn.host() + ":3478?transport=tcp"),
                    username, credential));
        }
        return servers;
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
