package com.chatsphere.presence;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

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

    /**
     * Batched online check for many users in ONE Redis round-trip (MGET) instead
     * of one hasKey() per user. Use this anywhere presence is needed for a list.
     */
    public Set<Long> onlineAmong(Collection<Long> userIds) {
        if (userIds == null || userIds.isEmpty()) return Set.of();
        List<Long> ids = userIds.stream().distinct().toList();
        List<String> keys = ids.stream().map(id -> KEY_PREFIX + id).toList();
        List<String> vals = redis.opsForValue().multiGet(keys);
        Set<Long> online = new java.util.HashSet<>();
        if (vals != null) {
            for (int i = 0; i < ids.size(); i++) {
                if (i < vals.size() && vals.get(i) != null) online.add(ids.get(i));
            }
        }
        return online;
    }

    /** Batched last-seen for many users in ONE SQL query instead of one findById each. */
    @Transactional(readOnly = true)
    public Map<Long, Instant> lastSeenAmong(Collection<Long> userIds) {
        if (userIds == null || userIds.isEmpty()) return Map.of();
        Map<Long, Instant> out = new HashMap<>();
        for (UserPresence p : presenceRepository.findAllById(userIds.stream().distinct().toList())) {
            out.put(p.getUserId(), p.getLastSeen());
        }
        return out;
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
