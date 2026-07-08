package com.chatsphere.call;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

/**
 * Receives call signals published to the Redis channel on EVERY instance and
 * delivers them to the local STOMP session for the target user. If that user
 * isn't connected here, {@code convertAndSendToUser} simply finds no session and
 * does nothing — which is exactly right.
 */
@Component
public class CallSignalListener implements MessageListener {

    private static final Logger log = LoggerFactory.getLogger(CallSignalListener.class);

    private final SimpMessagingTemplate messaging;
    private final ObjectMapper objectMapper;

    public CallSignalListener(SimpMessagingTemplate messaging, ObjectMapper objectMapper) {
        this.messaging = messaging;
        this.objectMapper = objectMapper;
    }

    @Override
    public void onMessage(Message message, byte[] pattern) {
        try {
            CallSignalEnvelope env = objectMapper.readValue(message.getBody(), CallSignalEnvelope.class);
            messaging.convertAndSendToUser(env.username(), env.destination(), env.signal());
        } catch (Exception e) {
            log.warn("Failed to handle inbound call signal", e);
        }
    }
}
