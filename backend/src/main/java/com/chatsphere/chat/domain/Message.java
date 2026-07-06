package com.chatsphere.chat.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

@Entity
@Table(name = "messages")
@Getter
@Setter
public class Message {

    public enum Type { TEXT, IMAGE, FILE }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "conversation_id", nullable = false)
    private Long conversationId;

    @Column(name = "sender_id", nullable = false)
    private Long senderId;

    @Column(columnDefinition = "TEXT")
    private String content;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Type type = Type.TEXT;

    @Column(name = "attachment_url", length = 512)
    private String attachmentUrl;

    @Column(name = "reply_to_message_id")
    private Long replyToMessageId;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private boolean deleted = false;

    @Column(nullable = false)
    private boolean pinned = false;

    /** Set when the message content is edited; null otherwise. */
    @Column(name = "edited_at")
    private Instant editedAt;
}
