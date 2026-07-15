package com.chatsphere.chat.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "conversations")
@Getter
@Setter
public class Conversation {

    public enum Type { DIRECT, GROUP }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * Opaque, unguessable identifier exposed to clients/URLs instead of the
     * sequential numeric id, so conversations cannot be enumerated. Generated
     * from a random (v4/SecureRandom-backed) UUID on first persist.
     */
    @Column(name = "public_id", length = 24, nullable = false, unique = true, updatable = false)
    private String publicId;

    @PrePersist
    void assignPublicId() {
        if (publicId == null) {
            publicId = UUID.randomUUID().toString().replace("-", "").substring(0, 20);
        }
    }

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Type type;

    @Column(length = 150)
    private String name;

    @Column(name = "avatar_url", length = 512)
    private String avatarUrl;

    @Column(name = "direct_key", length = 64)
    private String directKey;

    @Column(name = "created_by")
    private Long createdBy;

    /**
     * Newest non-deleted message, denormalised. Deriving it per chat-list load
     * ("id IN (SELECT MAX(id) ... GROUP BY conversation_id)") took >40s on a
     * 2M-message database; reading it from here is a primary-key lookup.
     */
    @Column(name = "last_message_id")
    private Long lastMessageId;

    /**
     * Disappearing-messages timer in seconds (e.g. 86400 = 24h). Null = off. When
     * set, every new message in this conversation is stamped with an expires_at.
     */
    @Column(name = "disappearing_ttl_seconds")
    private Integer disappearingTtlSeconds;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;
}
