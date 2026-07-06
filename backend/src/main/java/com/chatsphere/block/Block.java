package com.chatsphere.block;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

@Entity
@Table(name = "blocks")
@Getter
@Setter
public class Block {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** The user who created the block. */
    @Column(name = "blocker_id", nullable = false)
    private Long blockerId;

    /** The user who is blocked (their messages won't reach the blocker). */
    @Column(name = "blocked_id", nullable = false)
    private Long blockedId;

    /** When the block started. */
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    /** When the block ended; null while the block is still active. Messages from
     *  the blocked user created between createdAt and unblockedAt stay hidden. */
    @Column(name = "unblocked_at")
    private Instant unblockedAt;
}
