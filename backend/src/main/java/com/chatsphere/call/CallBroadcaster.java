package com.chatsphere.call;

import com.chatsphere.call.dto.CallDtos.CallSignal;
import com.chatsphere.user.User;
import com.chatsphere.user.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

/**
 * Fans call signals out to a specific user across the cluster.
 *
 * Rather than call {@code convertAndSendToUser} directly (which only reaches a
 * session on the local instance), it publishes to a Redis channel. Every
 * instance is subscribed via {@link CallSignalListener}; whichever one holds the
 * target user's session delivers it. Works identically on one node or many.
 */
@Component
public class CallBroadcaster {

    /** Redis pub/sub channel carrying {@link CallSignalEnvelope}s. */
    public static final String CHANNEL = "chatsphere:call:signal";

    /** Per-user STOMP destination for call signals (unused by other features). */
    static final String DESTINATION = "/queue/call";

    private static final Logger log = LoggerFactory.getLogger(CallBroadcaster.class);

    private final StringRedisTemplate redis;
    private final ObjectMapper objectMapper;
    private final UserRepository userRepository;

    public CallBroadcaster(StringRedisTemplate redis,
                           ObjectMapper objectMapper,
                           UserRepository userRepository) {
        this.redis = redis;
        this.objectMapper = objectMapper;
        this.userRepository = userRepository;
    }

    /** Deliver a signal to one user (resolves id -> username, the STOMP principal name). */
    public void sendTo(Long userId, CallSignal signal) {
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) return;
        try {
            String json = objectMapper.writeValueAsString(
                    new CallSignalEnvelope(user.getUsername(), DESTINATION, signal));
            redis.convertAndSend(CHANNEL, json);
        } catch (Exception e) {
            log.warn("Failed to publish call signal {} to user {}", signal.type(), userId, e);
        }
    }
}
