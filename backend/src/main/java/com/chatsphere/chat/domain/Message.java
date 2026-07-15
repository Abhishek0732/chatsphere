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

    /** Ids of the users @mentioned in this message, as a CSV (e.g. "3,7"). */
    @Column(length = 512)
    private String mentions;

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

    /**
     * When the conversation has a disappearing-messages timer, this is stamped at
     * send time (created_at + ttl). A background sweep hard-deletes rows past it,
     * and clients hide them the moment it passes. Null = the message never expires.
     */
    @Column(name = "expires_at")
    private Instant expiresAt;

    /**
     * True when {@code content} is ciphertext produced in the sender's browser.
     * The server stores and forwards it and cannot read it: search skips these rows,
     * and notification previews never quote them.
     */
    @Column(nullable = false)
    private boolean encrypted = false;

    // ── Status reply/reaction snapshot ──
    // Present when this message is a reply or reaction to someone's status. The
    // snapshot lets the quoted preview render even after the status has expired.
    @Column(name = "status_ref_id")
    private Long statusRefId;

    @Column(name = "status_ref_type", length = 10)
    private String statusRefType;

    @Column(name = "status_ref_media_url", length = 512)
    private String statusRefMediaUrl;

    @Column(name = "status_ref_caption", length = 700)
    private String statusRefCaption;

    @Column(name = "status_ref_bg_color", length = 40)
    private String statusRefBgColor;
}
