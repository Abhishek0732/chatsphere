package com.chatsphere.chat;

import com.chatsphere.common.config.InboundSequenceInterceptor;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

/**
 * Drops the per-connection ordering state when a connection goes away.
 *
 * Both the sequence counter and the ordering gate are keyed by session id. At lakh
 * scale there are a great many sessions over the life of a process — every reload,
 * every reconnect, every phone waking up is a new one — so without this they would
 * be a slow, permanent leak.
 */
@Component
public class SessionCleanupListener {

    private final SessionOrdering ordering;
    private final InboundSequenceInterceptor sequences;

    public SessionCleanupListener(SessionOrdering ordering, InboundSequenceInterceptor sequences) {
        this.ordering = ordering;
        this.sequences = sequences;
    }

    @EventListener
    public void onDisconnect(SessionDisconnectEvent event) {
        String sessionId = event.getSessionId();
        ordering.forget(sessionId);
        sequences.forget(sessionId);
    }
}
