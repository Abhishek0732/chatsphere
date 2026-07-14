package com.chatsphere.push;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

/**
 * One browser/device a user has allowed notifications on.
 *
 * The {@code endpoint} is the subscription's identity (a URL at the browser
 * vendor's push service); {@code p256dh} and {@code auth} are the keys the
 * payload is encrypted with, so the push service itself cannot read the message.
 */
@Entity
@Table(name = "push_subscriptions")
@Getter
@Setter
public class PushSubscription {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false, length = 512)
    private String endpoint;

    @Column(nullable = false, length = 255)
    private String p256dh;

    @Column(nullable = false, length = 255)
    private String auth;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @Column(name = "last_used_at")
    private Instant lastUsedAt;
}
