package com.chatsphere.chat;

import com.chatsphere.chat.dto.ChatDtos.MessageDeletedEvent;
import com.chatsphere.chat.dto.ChatDtos.MessageDto;
import com.chatsphere.chat.dto.ChatDtos.ReadEvent;
import com.chatsphere.chat.dto.ChatDtos.TypingEvent;
import com.chatsphere.user.User;
import com.chatsphere.user.UserRepository;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Pushes chat events to connected clients over STOMP.
 * Per-user delivery uses the user destination (/user/queue/messages), keyed by username
 * (which is the STOMP principal name set during CONNECT authentication).
 */
@Component
public class ChatBroadcaster {

    private final SimpMessagingTemplate messaging;
    private final UserRepository userRepository;

    public ChatBroadcaster(SimpMessagingTemplate messaging, UserRepository userRepository) {
        this.messaging = messaging;
        this.userRepository = userRepository;
    }

    public void sendMessageToMembers(MessageDto message, List<Long> memberUserIds) {
        for (User u : userRepository.findAllById(memberUserIds)) {
            messaging.convertAndSendToUser(u.getUsername(), "/queue/messages", message);
        }
    }

    public void sendDeletionToMembers(MessageDeletedEvent event, List<Long> memberUserIds) {
        for (User u : userRepository.findAllById(memberUserIds)) {
            messaging.convertAndSendToUser(u.getUsername(), "/queue/message-deleted", event);
        }
    }

    public void broadcastTyping(TypingEvent event) {
        messaging.convertAndSend("/topic/conversations/" + event.conversationId() + "/typing", event);
    }

    public void broadcastRead(ReadEvent event) {
        messaging.convertAndSend("/topic/conversations/" + event.conversationId() + "/read", event);
    }
}
