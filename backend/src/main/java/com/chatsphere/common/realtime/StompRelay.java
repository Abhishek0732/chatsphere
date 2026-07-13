package com.chatsphere.common.realtime;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Delivers STOMP frames to users ACROSS THE CLUSTER.
 *
 * The app uses Spring's in-memory simple broker, whose session registry lives in
 * one JVM's heap. Calling {@code convertAndSendToUser} directly therefore only
 * reaches sessions on the LOCAL instance: with two backends behind a load
 * balancer, a message sent by a user on instance A would be persisted, and then
 * silently dropped for every recipient connected to instance B. No error, no
 * log — just missing messages. That single fact made the app impossible to scale
 * past one process.
 *
 * So every push goes through Redis pub/sub instead: publish once here, and every
 * instance receives it ({@link StompRelayListener}) and delivers to whichever
 * sessions it happens to hold. If it holds none, delivering is a no-op — which
 * is exactly right. This is the same pattern the call signalling already used;
 * it is now how ALL realtime delivery works.
 */
@Component
public class StompRelay {

    /** Redis channel carrying {@link RelayEnvelope}s. */
    public static final String CHANNEL = "chatsphere:stomp";

    private static final Logger log = LoggerFactory.getLogger(StompRelay.class);

    private final StringRedisTemplate redis;
    private final ObjectMapper mapper;

    public StompRelay(StringRedisTemplate redis, ObjectMapper mapper) {
        this.redis = redis;
        this.mapper = mapper;
    }

    /** Send to one user's personal queue (e.g. "/queue/messages"), on any instance. */
    public void toUser(String username, String destination, Object payload) {
        toUsers(List.of(username), destination, payload);
    }

    /** Send the same payload to many users — one Redis publish, not one per user. */
    public void toUsers(List<String> usernames, String destination, Object payload) {
        if (usernames.isEmpty()) return;
        publish(new RelayEnvelope(usernames, destination, node(payload)));
    }

    /** Broadcast to a shared topic (e.g. a conversation's typing feed). */
    public void toTopic(String destination, Object payload) {
        publish(new RelayEnvelope(null, destination, node(payload)));
    }

    private JsonNode node(Object payload) {
        return mapper.valueToTree(payload);
    }

    private void publish(RelayEnvelope env) {
        try {
            redis.convertAndSend(CHANNEL, mapper.writeValueAsString(env));
        } catch (Exception e) {
            log.warn("Failed to publish STOMP frame to {}", env.destination(), e);
        }
    }
}
