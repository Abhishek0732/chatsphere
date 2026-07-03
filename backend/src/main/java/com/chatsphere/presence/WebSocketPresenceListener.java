package com.chatsphere.presence;

import com.chatsphere.common.security.UserPrincipal;
import org.springframework.context.event.EventListener;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.security.Principal;

/** Flips a user's presence when their WebSocket session opens or closes. */
@Component
public class WebSocketPresenceListener {

    private final PresenceService presenceService;

    public WebSocketPresenceListener(PresenceService presenceService) {
        this.presenceService = presenceService;
    }

    @EventListener
    public void onConnected(SessionConnectedEvent event) {
        Long userId = extractUserId(event.getUser());
        if (userId != null) {
            presenceService.heartbeat(userId);
        }
    }

    @EventListener
    public void onDisconnect(SessionDisconnectEvent event) {
        Long userId = extractUserId(event.getUser());
        if (userId != null) {
            presenceService.markOffline(userId);
        }
    }

    private Long extractUserId(Principal principal) {
        if (principal instanceof Authentication auth
                && auth.getPrincipal() instanceof UserPrincipal up) {
            return up.id();
        }
        return null;
    }
}
