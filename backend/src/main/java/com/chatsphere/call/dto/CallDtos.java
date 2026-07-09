package com.chatsphere.call.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;

/** Request/response and WebSocket payload records for the call module. */
public final class CallDtos {

    private CallDtos() {}

    // ---- inbound STOMP commands (client -> /app/call.*) ---------------------

    /**
     * Start a call. The client generates {@code callId} up front so it can cancel
     * the instant it rings (no wait for a server-assigned id). type defaults to
     * VOICE; conversationId is optional context.
     */
    public record InviteCommand(String callId, @NotNull Long calleeId, String type, Long conversationId) {}

    /** Accept / decline / cancel / end — all carry just the opaque call id. */
    public record CallActionCommand(@NotBlank String callId) {}

    /**
     * A native-WebRTC signaling frame the client relays to its peer through the
     * server (client -> /app/call.signal). {@code kind} ∈ offer | answer | ice.
     * For offer/answer the SDP rides in {@code sdp}; for a trickled ICE candidate
     * the JSON-encoded candidate rides in {@code candidate}. The server only
     * forwards it to the other participant — it never inspects the media.
     */
    public record RtcSignalCommand(@NotBlank String callId, @NotBlank String kind,
                                   String sdp, String candidate) {}

    // ---- outbound signal (server -> /user/queue/call) ----------------------

    /**
     * A single flat event, discriminated by {@code type}. One shape keeps Redis
     * pub/sub serialization trivial (no polymorphism) and mirrors the frontend's
     * flat-interface style.
     *
     * type ∈ INCOMING_CALL, CALL_RINGING, CALL_ACCEPTED, CALL_DECLINED,
     *        CALL_CANCELLED, CALL_ENDED, CALL_MISSED, CALL_BUSY,
     *        CALL_UNAVAILABLE, CALL_TAKEN, CALL_FAILED,
     *        WEBRTC_OFFER, WEBRTC_ANSWER, WEBRTC_ICE
     *
     * The WEBRTC_* variants carry the peer's media negotiation: {@code sdp} for
     * offer/answer, {@code candidate} (JSON) for a trickled ICE candidate.
     */
    public record CallSignal(
            String type,
            String callId,
            String callType,
            Long callerId,
            String callerName,
            String callerAvatarUrl,
            Long calleeId,
            String calleeName,
            String calleeAvatarUrl,
            Long conversationId,
            Integer durationSeconds,
            String reason,
            Instant at,
            String sdp,
            String candidate) {}

    // ---- REST --------------------------------------------------------------

    public record RegisterDeviceRequest(String deviceUid, String platform, String pushToken) {}

    /** The ICE servers (STUN + TURN) the browser uses to negotiate the P2P leg. */
    public record IceConfigDto(java.util.List<IceServer> iceServers) {}

    /** A WebRTC ICE server (STUN, or TURN with short-lived HMAC credential). */
    public record IceServer(java.util.List<String> urls, String username, String credential) {}

    /** A row in the call log, framed from the requesting user's perspective. */
    public record CallHistoryDto(
            String callId,
            String type,
            String status,
            String endReason,
            Long counterpartId,
            String counterpartName,
            String counterpartAvatarUrl,
            boolean outgoing,
            Long conversationId,
            Instant createdAt,
            Instant answeredAt,
            Instant endedAt,
            Integer durationSeconds) {}

    /** The user's current live call, for resume-on-reconnect. */
    public record ActiveCallDto(
            String callId,
            String type,
            String status,
            Long callerId,
            String callerName,
            String callerAvatarUrl,
            Long calleeId,
            String calleeName,
            String calleeAvatarUrl,
            boolean outgoing,
            Long conversationId,
            Instant createdAt,
            Instant answeredAt) {}
}
