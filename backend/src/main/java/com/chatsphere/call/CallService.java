package com.chatsphere.call;

import com.chatsphere.block.BlockService;
import com.chatsphere.call.domain.Call;
import com.chatsphere.call.domain.Device;
import com.chatsphere.call.dto.CallDtos.ActiveCallDto;
import com.chatsphere.call.dto.CallDtos.CallHistoryDto;
import com.chatsphere.call.dto.CallDtos.CallSignal;
import com.chatsphere.call.dto.CallDtos.InviteCommand;
import com.chatsphere.call.dto.CallDtos.RegisterDeviceRequest;
import com.chatsphere.call.repo.CallRepository;
import com.chatsphere.call.repo.DeviceRepository;
import com.chatsphere.presence.PresenceService;
import com.chatsphere.user.User;
import com.chatsphere.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ScheduledFuture;

/**
 * The call state machine and the single source of truth for call state.
 *
 * Every transition is persisted, then a signal is fanned out via
 * {@link CallBroadcaster}. Methods never throw on the WebSocket path — invalid
 * requests resolve to a terminal signal (BUSY / UNAVAILABLE / FAILED) or a quiet
 * no-op, so a client can't crash the socket with a stale call id.
 */
@Service
public class CallService {

    private static final Logger log = LoggerFactory.getLogger(CallService.class);

    /** How long a call rings before it auto-transitions to MISSED. */
    private static final Duration RING_TIMEOUT = Duration.ofSeconds(45);
    /** Safety TTL on a busy-lock so a crashed node can't wedge a user "in a call" forever. */
    private static final Duration LOCK_TTL = Duration.ofHours(2);
    private static final String LOCK_PREFIX = "call:lock:";

    /** Live calls (ringing or active), for resume-on-reconnect + busy checks. */
    private static final List<Call.Status> LIVE = List.of(Call.Status.RINGING, Call.Status.ACTIVE);

    private final CallRepository callRepository;
    private final DeviceRepository deviceRepository;
    private final UserRepository userRepository;
    private final CallBroadcaster broadcaster;
    private final PresenceService presenceService;
    private final BlockService blockService;
    private final StringRedisTemplate redis;
    private final TaskScheduler taskScheduler;

    /** In-memory ring timers for snappy 45s expiry; the sweeper is the cluster-safe backstop. */
    private final Map<String, ScheduledFuture<?>> ringTimers = new ConcurrentHashMap<>();

    public CallService(CallRepository callRepository,
                       DeviceRepository deviceRepository,
                       UserRepository userRepository,
                       CallBroadcaster broadcaster,
                       PresenceService presenceService,
                       BlockService blockService,
                       StringRedisTemplate redis,
                       TaskScheduler taskScheduler) {
        this.callRepository = callRepository;
        this.deviceRepository = deviceRepository;
        this.userRepository = userRepository;
        this.broadcaster = broadcaster;
        this.presenceService = presenceService;
        this.blockService = blockService;
        this.redis = redis;
        this.taskScheduler = taskScheduler;
    }

    // ========================================================================
    // Transitions (invoked from the STOMP controller)
    // ========================================================================

    /** RINGING: place a call. Guards self-call, blocks, offline, and busy. */
    @Transactional
    public void invite(Long callerId, InviteCommand cmd) {
        Long calleeId = cmd.calleeId();
        if (calleeId == null || calleeId.equals(callerId)) {
            broadcaster.sendTo(callerId, failure(callerId, calleeId, "invalid"));
            return;
        }
        if (userRepository.findById(calleeId).isEmpty()) {
            broadcaster.sendTo(callerId, failure(callerId, calleeId, "not_found"));
            return;
        }
        // Idempotency: a retried invite frame with the same client id is a no-op.
        String uid = (cmd.callId() != null && !cmd.callId().isBlank())
                ? cmd.callId() : UUID.randomUUID().toString();
        if (callRepository.findByCallUid(uid).isPresent()) return;
        // Either side having blocked the other forbids the call (looks "unavailable").
        if (blockService.isBlocked(callerId, calleeId) || blockService.isBlocked(calleeId, callerId)) {
            broadcaster.sendTo(callerId, unavailable(callerId, calleeId, "blocked"));
            return;
        }
        if (!presenceService.isOnline(calleeId)) {
            // No push yet (Phase 4) — offline is simply unavailable for now.
            broadcaster.sendTo(callerId, unavailable(callerId, calleeId, "offline"));
            return;
        }
        // Atomic busy-lock: caller first, then callee; release on any failure.
        if (!acquireLock(callerId)) {
            broadcaster.sendTo(callerId, busy(callerId, calleeId, "self_busy"));
            return;
        }
        if (!acquireLock(calleeId)) {
            releaseLock(callerId);
            broadcaster.sendTo(callerId, busy(callerId, calleeId, "callee_busy"));
            return;
        }

        Call call = new Call();
        call.setCallUid(uid);
        call.setCallerId(callerId);
        call.setCalleeId(calleeId);
        call.setType(parseType(cmd.type()));
        call.setStatus(Call.Status.RINGING);
        call.setConversationId(cmd.conversationId());
        callRepository.save(call);

        scheduleRingTimeout(call.getCallUid());

        broadcaster.sendTo(calleeId, signal(call, "INCOMING_CALL", null, null));
        broadcaster.sendTo(callerId, signal(call, "CALL_RINGING", null, null));
    }

    /** RINGING -> ACTIVE. First accept wins; a late/second-device accept gets CALL_TAKEN. */
    @Transactional
    public void accept(Long userId, String callId) {
        Call call = callRepository.findByCallUid(callId).orElse(null);
        if (call == null || !userId.equals(call.getCalleeId())) return;
        if (call.getStatus() != Call.Status.RINGING) {
            broadcaster.sendTo(userId, signal(call, "CALL_TAKEN", null, null));
            return;
        }
        call.setStatus(Call.Status.ACTIVE);
        call.setAnsweredAt(Instant.now());
        callRepository.save(call);
        cancelRingTimeout(callId);

        CallSignal accepted = signal(call, "CALL_ACCEPTED", null, null);
        broadcaster.sendTo(call.getCallerId(), accepted);
        broadcaster.sendTo(call.getCalleeId(), accepted);
    }

    /** RINGING -> DECLINED (by callee). */
    @Transactional
    public void decline(Long userId, String callId) {
        Call call = callRepository.findByCallUid(callId).orElse(null);
        if (call == null || !userId.equals(call.getCalleeId())) return;
        if (call.getStatus() != Call.Status.RINGING) return;
        terminate(call, Call.Status.DECLINED, Call.EndReason.DECLINED, "CALL_DECLINED");
    }

    /** RINGING -> CANCELLED (by caller, before answer). */
    @Transactional
    public void cancel(Long userId, String callId) {
        Call call = callRepository.findByCallUid(callId).orElse(null);
        if (call == null || !userId.equals(call.getCallerId())) return;
        if (call.getStatus() != Call.Status.RINGING) return;
        terminate(call, Call.Status.CANCELLED, Call.EndReason.CANCELLED, "CALL_CANCELLED");
    }

    /** Hang up. Robust to being called in any live state by either party. */
    @Transactional
    public void end(Long userId, String callId) {
        Call call = callRepository.findByCallUid(callId).orElse(null);
        if (call == null) return;
        boolean participant = userId.equals(call.getCallerId()) || userId.equals(call.getCalleeId());
        if (!participant) return;
        if (isTerminal(call.getStatus())) return;

        // Hanging up while still ringing means cancel (caller) or decline (callee).
        if (call.getStatus() == Call.Status.RINGING) {
            if (userId.equals(call.getCallerId())) {
                terminate(call, Call.Status.CANCELLED, Call.EndReason.CANCELLED, "CALL_CANCELLED");
            } else {
                terminate(call, Call.Status.DECLINED, Call.EndReason.DECLINED, "CALL_DECLINED");
            }
            return;
        }
        // ACTIVE -> ENDED, with a real duration.
        Instant now = Instant.now();
        call.setEndedAt(now);
        call.setDurationSeconds(computeDuration(call, now));
        terminate(call, Call.Status.ENDED, Call.EndReason.HANGUP, "CALL_ENDED");
    }

    // ========================================================================
    // Ring timeout (per-instance timer + cluster-safe sweeper backstop)
    // ========================================================================

    private void scheduleRingTimeout(String callUid) {
        ScheduledFuture<?> future = taskScheduler.schedule(
                () -> expireIfRinging(callUid), Instant.now().plus(RING_TIMEOUT));
        ringTimers.put(callUid, future);
    }

    private void cancelRingTimeout(String callUid) {
        ScheduledFuture<?> future = ringTimers.remove(callUid);
        if (future != null) future.cancel(false);
    }

    /** Idempotent: only a still-RINGING call becomes MISSED (safe if it raced with accept). */
    void expireIfRinging(String callUid) {
        try {
            Call call = callRepository.findByCallUid(callUid).orElse(null);
            if (call == null || call.getStatus() != Call.Status.RINGING) return;
            call.setEndedAt(Instant.now());
            terminate(call, Call.Status.MISSED, Call.EndReason.MISSED, "CALL_MISSED");
        } catch (Exception e) {
            log.warn("Failed to expire ringing call {}", callUid, e);
        }
    }

    /** Backstop for calls whose scheduling instance died before the timer fired. */
    @Scheduled(fixedDelay = 30_000)
    public void sweepStaleRinging() {
        Instant cutoff = Instant.now().minus(RING_TIMEOUT).minusSeconds(5);
        for (Call call : callRepository.findByStatusAndCreatedAtBefore(Call.Status.RINGING, cutoff)) {
            expireIfRinging(call.getCallUid());
        }
    }

    // ========================================================================
    // Shared termination
    // ========================================================================

    private void terminate(Call call, Call.Status status, Call.EndReason reason, String signalType) {
        if (call.getEndedAt() == null) call.setEndedAt(Instant.now());
        call.setStatus(status);
        call.setEndReason(reason);
        callRepository.save(call);
        cancelRingTimeout(call.getCallUid());
        releaseLock(call.getCallerId());
        releaseLock(call.getCalleeId());
        CallSignal s = signal(call, signalType, reason.name(), call.getDurationSeconds());
        broadcaster.sendTo(call.getCallerId(), s);
        broadcaster.sendTo(call.getCalleeId(), s);
    }

    private static boolean isTerminal(Call.Status status) {
        return status != Call.Status.RINGING && status != Call.Status.ACTIVE;
    }

    private static int computeDuration(Call call, Instant end) {
        if (call.getAnsweredAt() == null) return 0;
        return (int) Math.max(0, Duration.between(call.getAnsweredAt(), end).getSeconds());
    }

    // ========================================================================
    // Busy-lock (atomic, Redis SET NX)
    // ========================================================================

    private boolean acquireLock(Long userId) {
        Boolean ok = redis.opsForValue().setIfAbsent(LOCK_PREFIX + userId, "1", LOCK_TTL);
        return Boolean.TRUE.equals(ok);
    }

    private void releaseLock(Long userId) {
        redis.delete(LOCK_PREFIX + userId);
    }

    // ========================================================================
    // REST-facing reads + device registration
    // ========================================================================

    @Transactional(readOnly = true)
    public ActiveCallDto activeCall(Long userId) {
        List<Call> live = callRepository.findByUserAndStatuses(userId, LIVE, PageRequest.of(0, 1));
        if (live.isEmpty()) return null;
        Call call = live.get(0);
        User caller = userRepository.findById(call.getCallerId()).orElse(null);
        User callee = userRepository.findById(call.getCalleeId()).orElse(null);
        return new ActiveCallDto(
                call.getCallUid(), call.getType().name(), call.getStatus().name(),
                call.getCallerId(), displayName(caller), avatarUrl(caller),
                call.getCalleeId(), displayName(callee), avatarUrl(callee),
                userId.equals(call.getCallerId()), call.getConversationId(),
                call.getCreatedAt(), call.getAnsweredAt());
    }

    @Transactional(readOnly = true)
    public List<CallHistoryDto> history(Long userId, int page, int size) {
        List<Call> calls = callRepository.findHistory(userId, PageRequest.of(page, size));
        return calls.stream().map(c -> toHistory(userId, c)).toList();
    }

    @Transactional(readOnly = true)
    public long missedCount(Long userId) {
        return callRepository.countByCalleeIdAndStatus(userId, Call.Status.MISSED);
    }

    @Transactional
    public void registerDevice(Long userId, RegisterDeviceRequest req) {
        if (req == null || req.deviceUid() == null || req.deviceUid().isBlank()) return;
        Device device = deviceRepository.findByDeviceUid(req.deviceUid()).orElseGet(Device::new);
        device.setUserId(userId);
        device.setDeviceUid(req.deviceUid());
        device.setPlatform(parsePlatform(req.platform()));
        if (req.pushToken() != null) device.setPushToken(req.pushToken());
        device.setLastSeen(Instant.now());
        deviceRepository.save(device);
    }

    private CallHistoryDto toHistory(Long userId, Call call) {
        boolean outgoing = userId.equals(call.getCallerId());
        Long counterpartId = outgoing ? call.getCalleeId() : call.getCallerId();
        User counterpart = userRepository.findById(counterpartId).orElse(null);
        return new CallHistoryDto(
                call.getCallUid(), call.getType().name(), call.getStatus().name(),
                call.getEndReason() == null ? null : call.getEndReason().name(),
                counterpartId, displayName(counterpart), avatarUrl(counterpart),
                outgoing, call.getConversationId(),
                call.getCreatedAt(), call.getAnsweredAt(), call.getEndedAt(), call.getDurationSeconds());
    }

    // ========================================================================
    // Signal building
    // ========================================================================

    private CallSignal signal(Call call, String type, String reason, Integer duration) {
        User caller = userRepository.findById(call.getCallerId()).orElse(null);
        User callee = userRepository.findById(call.getCalleeId()).orElse(null);
        return new CallSignal(
                type, call.getCallUid(), call.getType().name(),
                call.getCallerId(), displayName(caller), avatarUrl(caller),
                call.getCalleeId(), displayName(callee), avatarUrl(callee),
                call.getConversationId(), duration, reason, Instant.now());
    }

    /** Lightweight signals for pre-call rejections that never created a Call row. */
    private CallSignal failure(Long callerId, Long calleeId, String reason) {
        return lite("CALL_FAILED", callerId, calleeId, reason);
    }

    private CallSignal busy(Long callerId, Long calleeId, String reason) {
        return lite("CALL_BUSY", callerId, calleeId, reason);
    }

    private CallSignal unavailable(Long callerId, Long calleeId, String reason) {
        return lite("CALL_UNAVAILABLE", callerId, calleeId, reason);
    }

    private CallSignal lite(String type, Long callerId, Long calleeId, String reason) {
        User caller = userRepository.findById(callerId).orElse(null);
        User callee = calleeId == null ? null : userRepository.findById(calleeId).orElse(null);
        return new CallSignal(
                type, null, "VOICE",
                callerId, displayName(caller), avatarUrl(caller),
                calleeId, displayName(callee), avatarUrl(callee),
                null, null, reason, Instant.now());
    }

    // ========================================================================
    // Small helpers
    // ========================================================================

    private static Call.Type parseType(String raw) {
        if (raw == null) return Call.Type.VOICE;
        try {
            return Call.Type.valueOf(raw.toUpperCase());
        } catch (IllegalArgumentException e) {
            return Call.Type.VOICE;
        }
    }

    private static Device.Platform parsePlatform(String raw) {
        if (raw == null) return Device.Platform.WEB;
        try {
            return Device.Platform.valueOf(raw.toUpperCase());
        } catch (IllegalArgumentException e) {
            return Device.Platform.WEB;
        }
    }

    private static String displayName(User u) {
        return u == null ? null : u.getDisplayName();
    }

    private static String avatarUrl(User u) {
        return u == null ? null : u.getAvatarUrl();
    }
}
