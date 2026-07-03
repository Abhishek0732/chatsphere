package com.chatsphere.presence;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;

/**
 * Tracks online presence in Redis (heartbeat with TTL) and persists last-seen to MySQL.
 * A user is "online" while a heartbeat key exists; the client pings periodically.
 */
@Service
public class PresenceService {

    private static final String KEY_PREFIX = "presence:online:";
    private static final Duration HEARTBEAT_TTL = Duration.ofSeconds(45);

    private final StringRedisTemplate redis;
    private final UserPresenceRepository presenceRepository;
    private final SimpMessagingTemplate messaging;

    public PresenceService(StringRedisTemplate redis,
                           UserPresenceRepository presenceRepository,
                           SimpMessagingTemplate messaging) {
        this.redis = redis;
        this.presenceRepository = presenceRepository;
        this.messaging = messaging;
    }

    public boolean isOnline(Long userId) {
        return Boolean.TRUE.equals(redis.hasKey(KEY_PREFIX + userId));
    }

    @Transactional(readOnly = true)
    public Instant lastSeen(Long userId) {
        return presenceRepository.findById(userId)
                .map(UserPresence::getLastSeen)
                .orElse(null);
    }

    /** Called on connect / periodic ping. Broadcasts a transition to online. */
    public void heartbeat(Long userId) {
        boolean wasOnline = isOnline(userId);
        redis.opsForValue().set(KEY_PREFIX + userId, "1", HEARTBEAT_TTL);
        if (!wasOnline) {
            persist(userId, true, null);
            broadcast(new PresenceEvent(userId, true, null));
        }
    }

    /** Called on disconnect. */
    @Transactional
    public void markOffline(Long userId) {
        redis.delete(KEY_PREFIX + userId);
        Instant now = Instant.now();
        persist(userId, false, now);
        broadcast(new PresenceEvent(userId, false, now));
    }

    @Transactional
    protected void persist(Long userId, boolean online, Instant lastSeen) {
        UserPresence p = presenceRepository.findById(userId).orElseGet(() -> {
            UserPresence np = new UserPresence();
            np.setUserId(userId);
            return np;
        });
        p.setOnline(online);
        if (lastSeen != null) {
            p.setLastSeen(lastSeen);
        }
        presenceRepository.save(p);
    }

    private void broadcast(PresenceEvent event) {
        messaging.convertAndSend("/topic/presence", event);
    }
}
