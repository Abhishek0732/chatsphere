package com.chatsphere.chat;

import com.chatsphere.chat.domain.Message;
import com.chatsphere.chat.dto.ChatDtos.*;
import com.chatsphere.common.security.UserPrincipal;
import com.chatsphere.messaging.ChatEventPublisher;
import com.chatsphere.notification.NotificationService;
import com.chatsphere.presence.PresenceService;
import com.chatsphere.user.User;
import com.chatsphere.user.UserRepository;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.util.List;

/** Handles inbound STOMP frames destined for /app/**. */
@Controller
public class ChatWebSocketController {

    private final ChatService chatService;
    private final ChatBroadcaster broadcaster;
    private final PresenceService presenceService;
    private final NotificationService notificationService;
    private final ChatEventPublisher eventPublisher;
    private final UserRepository userRepository;

    public ChatWebSocketController(ChatService chatService,
                                   ChatBroadcaster broadcaster,
                                   PresenceService presenceService,
                                   NotificationService notificationService,
                                   ChatEventPublisher eventPublisher,
                                   UserRepository userRepository) {
        this.chatService = chatService;
        this.broadcaster = broadcaster;
        this.presenceService = presenceService;
        this.notificationService = notificationService;
        this.eventPublisher = eventPublisher;
        this.userRepository = userRepository;
    }

    @MessageMapping("chat.send")
    public void send(@Payload SendMessageCommand cmd, Principal principal) {
        Long senderId = userId(principal);
        Message saved = chatService.persistMessage(senderId, cmd);
        MessageDto dto = chatService.toMessageDto(saved, cmd.tempId());

        List<Long> members = chatService.memberUserIds(cmd.conversationId());
        broadcaster.sendMessageToMembers(dto, members);
        eventPublisher.publishMessage(dto);
        notificationService.notifyNewMessage(dto, members, senderId);
    }

    @MessageMapping("chat.typing")
    public void typing(@Payload TypingCommand cmd, Principal principal) {
        Long uid = userId(principal);
        String name = userRepository.findById(uid).map(User::getDisplayName).orElse("Someone");
        broadcaster.broadcastTyping(new TypingEvent(cmd.conversationId(), uid, name, cmd.typing()));
    }

    @MessageMapping("chat.read")
    public void read(@Payload ReadCommand cmd, Principal principal) {
        Long uid = userId(principal);
        chatService.markRead(uid, cmd.conversationId(), cmd.messageId());
        broadcaster.broadcastRead(new ReadEvent(cmd.conversationId(), uid, cmd.messageId()));
    }

    @MessageMapping("chat.delete")
    public void delete(@Payload DeleteCommand cmd, Principal principal) {
        Long uid = userId(principal);
        chatService.deleteMessage(uid, cmd.messageId());
        List<Long> members = chatService.memberUserIds(cmd.conversationId());
        broadcaster.sendDeletionToMembers(
                new MessageDeletedEvent(cmd.conversationId(), cmd.messageId()), members);
    }

    @MessageMapping("presence.ping")
    public void ping(Principal principal) {
        presenceService.heartbeat(userId(principal));
    }

    private Long userId(Principal principal) {
        if (principal instanceof Authentication auth
                && auth.getPrincipal() instanceof UserPrincipal up) {
            return up.id();
        }
        throw new IllegalStateException("Unauthenticated WebSocket session");
    }
}
