package com.chatsphere.chat;

import com.chatsphere.block.BlockService;
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
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/** Handles inbound STOMP frames destined for /app/**. */
@Controller
public class ChatWebSocketController {

    /**
     * userId -> display name, for typing frames. Bounded by the number of users
     * who have typed on this instance since boot; a rename is picked up on the
     * next restart, which is an acceptable trade for removing a DB hit per
     * keystroke on the busiest frame in the system.
     */
    private final Map<Long, String> displayNames = new ConcurrentHashMap<>();

    private final ChatService chatService;
    private final ChatBroadcaster broadcaster;
    private final PresenceService presenceService;
    private final NotificationService notificationService;
    private final ChatEventPublisher eventPublisher;
    private final UserRepository userRepository;
    private final BlockService blockService;

    public ChatWebSocketController(ChatService chatService,
                                   ChatBroadcaster broadcaster,
                                   PresenceService presenceService,
                                   NotificationService notificationService,
                                   ChatEventPublisher eventPublisher,
                                   UserRepository userRepository,
                                   BlockService blockService) {
        this.chatService = chatService;
        this.broadcaster = broadcaster;
        this.presenceService = presenceService;
        this.notificationService = notificationService;
        this.eventPublisher = eventPublisher;
        this.userRepository = userRepository;
        this.blockService = blockService;
    }

    @MessageMapping("chat.send")
    public void send(@Payload SendMessageCommand cmd, Principal principal) {
        Long senderId = userId(principal);
        Message saved = persistWithRetry(senderId, cmd);
        // A message that was just created cannot have reactions, and its sender's
        // name is cached — so this costs no queries.
        MessageDto dto = chatService.freshDto(saved, cmd.tempId());

        List<Long> members = chatService.memberUserIds(cmd.conversationId());
        // Don't deliver to members who have blocked the sender (they simply
        // won't receive the message, live or via notification). The sender is
        // always kept so their own echo still arrives.
        List<Long> deliverable = blockService.filterDeliverable(senderId, members);

        // Only push a live frame to members who are actually CONNECTED. In a
        // 500-member group most people are offline at any moment, and we were
        // pushing to all of them: 200 people posting into one big group produced
        // ~198,000 socket deliveries, most of which had nobody to arrive at.
        // Offline members lose nothing — the message is in the database and they
        // get a notification row, so it is all there when they next open the app.
        Set<Long> online = presenceService.onlineAmong(deliverable);
        List<Long> live = deliverable.stream()
                .filter(id -> online.contains(id) || Objects.equals(id, senderId))
                .toList();
        broadcaster.sendMessageToMembers(dto, live);
        eventPublisher.publishMessage(dto);
        // Async: the notification fan-out (a row + a push per recipient) must not
        // sit between the sender pressing Enter and their message appearing.
        notificationService.notifyNewMessage(dto, deliverable, senderId);
    }

    /**
     * A message must never be silently dropped. The row lock taken in
     * persistMessage removes the deadlock that used to lose sends, but any
     * database can still fail a write under contention — so retry a couple of
     * times before giving up, rather than losing what the user typed.
     */
    private Message persistWithRetry(Long senderId, SendMessageCommand cmd) {
        for (int attempt = 1; ; attempt++) {
            try {
                return chatService.persistMessage(senderId, cmd);
            } catch (org.springframework.dao.PessimisticLockingFailureException e) {
                // Covers deadlock + lock-acquisition failures.
                if (attempt >= 3) throw e;
                try {
                    Thread.sleep(20L * attempt);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    throw e;
                }
            }
        }
    }

    @MessageMapping("chat.typing")
    public void typing(@Payload TypingCommand cmd, Principal principal) {
        Long uid = userId(principal);
        // Typing is the highest-frequency frame in the app (several per second per
        // active chatter). This used to hit the DB for the display name on EVERY
        // keystroke frame — at scale that was the top query against `users`.
        String name = displayNames.computeIfAbsent(uid, id ->
                userRepository.findById(id).map(User::getDisplayName).orElse("Someone"));
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

    @MessageMapping("chat.react")
    public void react(@Payload ReactCommand cmd, Principal principal) {
        Message m = chatService.toggleReaction(userId(principal), cmd.messageId(), cmd.emoji());
        broadcastUpdate(m);
    }

    @MessageMapping("chat.pin")
    public void pin(@Payload PinCommand cmd, Principal principal) {
        Message m = chatService.setPinned(userId(principal), cmd.messageId(), cmd.pinned());
        broadcastUpdate(m);
    }

    @MessageMapping("chat.edit")
    public void edit(@Payload EditCommand cmd, Principal principal) {
        Message m = chatService.editMessage(userId(principal), cmd.messageId(), cmd.content());
        broadcastUpdate(m);
    }

    private void broadcastUpdate(Message m) {
        MessageDto dto = chatService.refreshedDto(m);
        broadcaster.sendUpdateToMembers(dto, chatService.memberUserIds(m.getConversationId()));
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
