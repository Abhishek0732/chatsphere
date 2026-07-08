package com.chatsphere.call.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

/**
 * A single call session. The signaling source of truth for call state; media
 * (audio) flows client -> LiveKit -> client and never touches this row.
 */
@Entity
@Table(name = "calls")
@Getter
@Setter
public class Call {

    public enum Type { VOICE, VIDEO }

    public enum Status { RINGING, ACTIVE, ENDED, DECLINED, MISSED, CANCELLED, FAILED }

    public enum EndReason { HANGUP, DECLINED, MISSED, CANCELLED, BUSY, FAILED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Opaque id exposed to clients (numeric PK stays server-side). */
    @Column(name = "call_uid", nullable = false, length = 36)
    private String callUid;

    @Column(name = "caller_id", nullable = false)
    private Long callerId;

    @Column(name = "callee_id", nullable = false)
    private Long calleeId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Type type = Type.VOICE;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status = Status.RINGING;

    @Enumerated(EnumType.STRING)
    @Column(name = "end_reason", length = 20)
    private EndReason endReason;

    @Column(name = "conversation_id")
    private Long conversationId;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @Column(name = "answered_at")
    private Instant answeredAt;

    @Column(name = "ended_at")
    private Instant endedAt;

    @Column(name = "duration_seconds")
    private Integer durationSeconds;
}
