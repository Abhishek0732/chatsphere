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
 * A registered device for a user. Drives where to ring (and, in Phase 4, where
 * to push). One user may have many devices.
 */
@Entity
@Table(name = "devices")
@Getter
@Setter
public class Device {

    public enum Platform { WEB, ANDROID, IOS }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "device_uid", nullable = false, length = 64)
    private String deviceUid;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Platform platform = Platform.WEB;

    @Column(name = "push_token", length = 512)
    private String pushToken;

    @Column(name = "last_seen", nullable = false)
    private Instant lastSeen;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;
}
