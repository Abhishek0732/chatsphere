package com.chatsphere.common.realtime;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

/**
 * Runs on EVERY instance. Takes frames off the Redis channel and hands them to
 * the local STOMP broker, which delivers to the sessions this instance holds —
 * and does nothing for the ones it doesn't.
 */
@Component
public class StompRelayListener implements MessageListener {

    private static final Logger log = LoggerFactory.getLogger(StompRelayListener.class);

    private final SimpMessagingTemplate messaging;
    private final ObjectMapper mapper;

    public StompRelayListener(SimpMessagingTemplate messaging, ObjectMapper mapper) {
        this.messaging = messaging;
        this.mapper = mapper;
    }

    @Override
    public void onMessage(Message message, byte[] pattern) {
        try {
            RelayEnvelope env = mapper.readValue(message.getBody(), RelayEnvelope.class);
            if (env.usernames() == null) {
                messaging.convertAndSend(env.destination(), env.payload());
                return;
            }
            for (String username : env.usernames()) {
                messaging.convertAndSendToUser(username, env.destination(), env.payload());
            }
        } catch (Exception e) {
            log.warn("Failed to deliver relayed STOMP frame", e);
        }
    }
}
