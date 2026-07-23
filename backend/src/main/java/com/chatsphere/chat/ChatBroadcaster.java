package com.chatsphere.chat;

import com.chatsphere.chat.dto.ChatDtos.ConversationDeletedEvent;
import com.chatsphere.chat.dto.ChatDtos.DisappearingEvent;
import com.chatsphere.chat.dto.ChatDtos.MessageDeletedEvent;
import com.chatsphere.chat.dto.ChatDtos.MessageDto;
import com.chatsphere.chat.dto.ChatDtos.ReadEvent;
import com.chatsphere.chat.dto.ChatDtos.TypingEvent;
import com.chatsphere.common.cache.HotPathCache;
import com.chatsphere.common.realtime.StompRelay;
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
    private final HotPathCache cache;

    public ChatBroadcaster(StompRelay relay, HotPathCache cache) {
        this.relay = relay;
        this.cache = cache;
    }

    /** STOMP principal names, from cache — this was a query on every message. */
    private List<String> usernames(List<Long> userIds) {
        return cache.briefs(userIds).values().stream()
                .map(HotPathCache.UserBrief::username)
                .toList();
    }

    public void sendMessageToMembers(MessageDto message, List<Long> memberUserIds) {
        relay.toUsers(usernames(memberUserIds), "/queue/messages", message);
    }

    public void sendDeletionToMembers(MessageDeletedEvent event, List<Long> memberUserIds) {
        relay.toUsers(usernames(memberUserIds), "/queue/message-deleted", event);
    }

    /** Tell members a whole conversation was deleted for everyone — drop it from their list. */
    public void sendConversationDeleted(ConversationDeletedEvent event, List<Long> memberUserIds) {
        relay.toUsers(usernames(memberUserIds), "/queue/conversation-deleted", event);
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

    /** Tell a conversation's members their disappearing-messages timer changed. */
    public void broadcastDisappearing(DisappearingEvent event) {
        relay.toTopic("/topic/conversations/" + event.conversationId() + "/disappearing", event);
    }
}
