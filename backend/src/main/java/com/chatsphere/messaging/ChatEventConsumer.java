package com.chatsphere.messaging;

import com.chatsphere.chat.dto.ChatDtos.MessageDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

/**
 * Consumes chat message events. Currently used for audit/analytics logging; this is the
 * seam where a future Notification/Analytics microservice would subscribe instead.
 */
@Component
public class ChatEventConsumer {

    private static final Logger log = LoggerFactory.getLogger(ChatEventConsumer.class);

    @KafkaListener(topics = "${chatsphere.kafka.topics.messages}", groupId = "chatsphere-audit")
    public void onMessage(MessageDto message) {
        log.info("[kafka] message id={} conversation={} sender={}",
                message.id(), message.conversationId(), message.senderId());
    }
}
