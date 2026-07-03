package com.chatsphere.messaging;

import com.chatsphere.chat.dto.ChatDtos.MessageDto;
import com.chatsphere.common.config.AppProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

/**
 * Publishes chat domain events to Kafka. This decouples message persistence from
 * downstream consumers (notifications, analytics, future microservices).
 */
@Component
public class ChatEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(ChatEventPublisher.class);

    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final String messagesTopic;

    public ChatEventPublisher(KafkaTemplate<String, Object> kafkaTemplate, AppProperties props) {
        this.kafkaTemplate = kafkaTemplate;
        this.messagesTopic = props.kafka().topics().messages();
    }

    public void publishMessage(MessageDto message) {
        try {
            kafkaTemplate.send(messagesTopic, String.valueOf(message.conversationId()), message);
        } catch (Exception e) {
            // Kafka must not break the chat flow; log and continue.
            log.warn("Failed to publish message event to Kafka: {}", e.getMessage());
        }
    }
}
