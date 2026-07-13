package com.chatsphere.chat;

import com.chatsphere.chat.dto.ChatDtos.MessageDeletedEvent;
import com.chatsphere.chat.dto.ChatDtos.MessageDto;
import com.chatsphere.chat.dto.ChatDtos.ReadEvent;
import com.chatsphere.chat.dto.ChatDtos.TypingEvent;
import com.chatsphere.common.realtime.StompRelay;
import com.chatsphere.user.User;
import com.chatsphere.user.UserRepository;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Pushes chat events to connected clients over STOMP.
 *
 * Delivery goes through {@link StompRelay} (Redis pub/sub) rather than straight
 * to the local broker: with more than one backend instance a direct send only
 * reaches sessions in the same JVM, so recipients connected to another instance
 * would silently never receive the message. Publishing once to Redis lets
 * whichever instance holds each recipient's session do the delivery.
 */
@Component
public class ChatBroadcaster {

    private final StompRelay relay;
    private final UserRepository userRepository;

    public ChatBroadcaster(StompRelay relay, UserRepository userRepository) {
        this.relay = relay;
        this.userRepository = userRepository;
    }

    /** STOMP principal names for these user ids (one query, not one per member). */
    private List<String> usernames(List<Long> userIds) {
        return userRepository.findAllById(userIds).stream().map(User::getUsername).toList();
    }

    public void sendMessageToMembers(MessageDto message, List<Long> memberUserIds) {
        relay.toUsers(usernames(memberUserIds), "/queue/messages", message);
    }

    public void sendDeletionToMembers(MessageDeletedEvent event, List<Long> memberUserIds) {
        relay.toUsers(usernames(memberUserIds), "/queue/message-deleted", event);
    }

    /** Push an in-place message update (edit / pin / reaction) to members. */
    public void sendUpdateToMembers(MessageDto message, List<Long> memberUserIds) {
        relay.toUsers(usernames(memberUserIds), "/queue/message-updated", message);
    }

    public void broadcastTyping(TypingEvent event) {
        relay.toTopic("/topic/conversations/" + event.conversationId() + "/typing", event);
    }

    public void broadcastRead(ReadEvent event) {
        relay.toTopic("/topic/conversations/" + event.conversationId() + "/read", event);
    }
}
