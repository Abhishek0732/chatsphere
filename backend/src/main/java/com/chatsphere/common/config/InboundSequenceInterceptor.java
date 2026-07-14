package com.chatsphere.common.config;

import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Stamps every chat.send with the position it ARRIVED in, per connection.
 *
 * Why this exists: the inbound channel is a thread pool, so two messages sent
 * back-to-back on one connection are handed to two different threads and race each
 * other to the INSERT. The loser can get the lower id — and since a conversation is
 * ordered by id, the messages are then displayed, forever, in the wrong order. The
 * effect is easy to see: paste two lines quickly and they can swap.
 *
 * A channel interceptor's preSend runs on the thread that RECEIVED the frame — the
 * WebSocket transport thread for that session, which is strictly ordered — so it is
 * the last place where the true order is still known. We record it here as a simple
 * per-session counter, and {@link com.chatsphere.chat.SessionOrdering} makes the
 * handler honour it.
 *
 * Only chat.send is stamped. Typing and read receipts are not ordered against
 * anything, and stamping them would make a message wait behind a keystroke.
 */
@Component
public class InboundSequenceInterceptor implements ChannelInterceptor {

    /** The header the handler reads back. */
    public static final String SEQ_HEADER = "csSeq";

    private static final String SEND_DESTINATION = "/app/chat.send";

    /** sessionId -> next sequence. Removed when the session disconnects. */
    private final Map<String, AtomicLong> counters = new ConcurrentHashMap<>();

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(message);
        if (!StompCommand.SEND.equals(accessor.getCommand())) {
            return message;
        }
        if (!SEND_DESTINATION.equals(accessor.getDestination())) {
            return message;
        }
        String sessionId = accessor.getSessionId();
        if (sessionId == null) {
            return message;
        }

        long seq = counters.computeIfAbsent(sessionId, k -> new AtomicLong()).getAndIncrement();
        accessor.setHeader(SEQ_HEADER, seq);
        accessor.setLeaveMutable(true);
        return MessageBuilder.createMessage(message.getPayload(), accessor.getMessageHeaders());
    }

    /** Called when the session goes away, so the map cannot grow forever. */
    public void forget(String sessionId) {
        if (sessionId != null) counters.remove(sessionId);
    }
}
