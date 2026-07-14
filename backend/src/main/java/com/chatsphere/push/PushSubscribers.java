package com.chatsphere.push;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

/**
 * Who actually has push turned on.
 *
 * Every message to an offline recipient wants to know "should I push to them?", and
 * the honest answer is almost always no — a handful of people enable notifications,
 * everyone else never does. Asking the DATABASE that question once per message is a
 * query per message for a row that is nearly never there.
 *
 * So the answer lives in a Redis set instead: one membership check per recipient, in
 * microseconds, and the database is only touched for the few users who really do have
 * a subscription. Redis (not a local map) because the set must be the same on every
 * instance — someone can enable push on instance A and be messaged through instance B.
 *
 * If Redis is unavailable this falls back to "ask the database", which is exactly the
 * old behaviour: slower, never wrong.
 */
@Component
public class PushSubscribers {

    private static final Logger log = LoggerFactory.getLogger(PushSubscribers.class);
    private static final String KEY = "push:subscribers";

    private final StringRedisTemplate redis;
    private final PushSubscriptionRepository repository;

    public PushSubscribers(StringRedisTemplate redis, PushSubscriptionRepository repository) {
        this.redis = redis;
        this.repository = repository;
    }

    /** Rebuild the set at boot: Redis is a cache, the database is the truth. */
    @PostConstruct
    void warm() {
        try {
            List<Long> userIds = repository.findDistinctUserIds();
            if (!userIds.isEmpty()) {
                redis.opsForSet().add(KEY, userIds.stream().map(String::valueOf).toArray(String[]::new));
            }
            log.info("Push: {} user(s) have notifications enabled", userIds.size());
        } catch (Exception e) {
            log.warn("Could not warm the push subscriber set: {}", e.toString());
        }
    }

    public void remember(Long userId) {
        try {
            redis.opsForSet().add(KEY, String.valueOf(userId));
        } catch (Exception e) {
            log.debug("Could not add {} to the push subscriber set: {}", userId, e.toString());
        }
    }

    /** Drop the user from the set once their LAST subscription is gone. */
    public void forgetIfLast(Long userId) {
        try {
            if (!repository.existsByUserId(userId)) {
                redis.opsForSet().remove(KEY, String.valueOf(userId));
            }
        } catch (Exception e) {
            log.debug("Could not prune {} from the push subscriber set: {}", userId, e.toString());
        }
    }

    /** Of these recipients, which ones have push enabled at all? */
    public List<Long> subscribersAmong(Collection<Long> userIds) {
        if (userIds == null || userIds.isEmpty()) return List.of();
        try {
            List<Long> hits = new ArrayList<>();
            for (Long id : userIds) {
                if (Boolean.TRUE.equals(redis.opsForSet().isMember(KEY, String.valueOf(id)))) {
                    hits.add(id);
                }
            }
            return hits;
        } catch (Exception e) {
            // Redis down: fall back to the database rather than silently dropping
            // everybody's notifications.
            log.debug("Push subscriber set unavailable, falling back to the DB: {}", e.toString());
            return new ArrayList<>(userIds);
        }
    }
}
