package com.chatsphere.call;

import com.chatsphere.call.dto.CallDtos.CallActionCommand;
import com.chatsphere.call.dto.CallDtos.InviteCommand;
import com.chatsphere.common.security.UserPrincipal;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;

import java.security.Principal;

/**
 * Inbound STOMP frames for call signaling (client publishes to /app/call.*).
 * All business logic and fan-out live in {@link CallService}; this is a thin
 * authenticated adapter.
 */
@Controller
public class CallWebSocketController {

    private final CallService callService;

    public CallWebSocketController(CallService callService) {
        this.callService = callService;
    }

    @MessageMapping("call.invite")
    public void invite(@Payload InviteCommand cmd, Principal principal) {
        callService.invite(userId(principal), cmd);
    }

    @MessageMapping("call.accept")
    public void accept(@Payload CallActionCommand cmd, Principal principal) {
        callService.accept(userId(principal), cmd.callId());
    }

    @MessageMapping("call.decline")
    public void decline(@Payload CallActionCommand cmd, Principal principal) {
        callService.decline(userId(principal), cmd.callId());
    }

    @MessageMapping("call.cancel")
    public void cancel(@Payload CallActionCommand cmd, Principal principal) {
        callService.cancel(userId(principal), cmd.callId());
    }

    @MessageMapping("call.end")
    public void end(@Payload CallActionCommand cmd, Principal principal) {
        callService.end(userId(principal), cmd.callId());
    }

    private Long userId(Principal principal) {
        if (principal instanceof Authentication auth
                && auth.getPrincipal() instanceof UserPrincipal up) {
            return up.id();
        }
        throw new IllegalStateException("Unauthenticated WebSocket session");
    }
}
