package com.chatsphere.presence;

import org.springframework.data.redis.core.StringRedisTemplate;
import com.chatsphere.chat.repo.ConversationMemberRepository;
import com.chatsphere.common.realtime.StompRelay;
import com.chatsphere.contact.ContactRepository;
import com.chatsphere.user.User;
import com.chatsphere.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.HashSet;
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

    /** Upper bound on how many people one presence change is announced to. */
    private static final int AUDIENCE_CAP = 2_000;

    private final StringRedisTemplate redis;
    private final UserPresenceRepository presenceRepository;
    private final StompRelay relay;
    private final ContactRepository contactRepository;
    private final ConversationMemberRepository memberRepository;
    private final UserRepository userRepository;
    private final com.chatsphere.common.cache.HotPathCache cache;

    public PresenceService(StringRedisTemplate redis,
                           UserPresenceRepository presenceRepository,
                           StompRelay relay,
                           ContactRepository contactRepository,
                           ConversationMemberRepository memberRepository,
                           UserRepository userRepository,
                           com.chatsphere.common.cache.HotPathCache cache) {
        this.redis = redis;
        this.presenceRepository = presenceRepository;
        this.relay = relay;
        this.contactRepository = contactRepository;
        this.memberRepository = memberRepository;
        this.userRepository = userRepository;
        this.cache = cache;
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

    /**
     * Announce a presence change to the people who can actually see it: those who
     * have this user as a contact, plus anyone sharing a conversation with them.
     *
     * It used to go to a single global "/topic/presence" that EVERY client
     * subscribes to. At 100k online users a single connect published 100k frames,
     * and a reconnect storm (a deploy, a load-balancer blip, a mobile network
     * handover) meant 100k x 100k — the node simply dies. Nobody needs to know
     * that a stranger's phone woke up.
     */
    private void broadcast(PresenceEvent event) {
        // A user who hides their last-seen / online announces no presence at all.
        var brief = cache.brief(event.userId());
        if (brief != null && !brief.lastSeenShared()) {
            return;
        }
        List<String> audience = audienceOf(event.userId());
        if (!audience.isEmpty()) {
            relay.toUsers(audience, "/queue/presence", event);
        }
    }

    /** Usernames of this user's contacts + conversation partners (bounded). */
    private List<String> audienceOf(Long userId) {
        try {
            Set<Long> ids = new HashSet<>(contactRepository.findOwnerIdsByContactUserId(userId));
            ids.addAll(memberRepository.findConnectedUserIds(userId));
            ids.remove(userId);
            if (ids.isEmpty()) return List.of();
            List<Long> capped = ids.stream().limit(AUDIENCE_CAP).toList();
            return userRepository.findAllById(capped).stream().map(User::getUsername).toList();
        } catch (Exception e) {
            return List.of();
        }
    }
}
