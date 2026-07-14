package com.chatsphere.status;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

@Entity
@Table(name = "statuses")
@Getter
@Setter
public class Status {

    public enum Type { IMAGE, VIDEO, TEXT }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Type type = Type.IMAGE;

    @Column(name = "media_url", length = 512)
    private String mediaUrl;

    @Column(length = 700)
    private String caption;

    @Column(name = "bg_color", length = 40)
    private String bgColor;

    @Column(name = "music_url", length = 512)
    private String musicUrl;

    @Column(name = "music_title", length = 200)
    private String musicTitle;

    @Column(name = "music_artist", length = 200)
    private String musicArtist;

    @Column(name = "music_duration_ms")
    private Integer musicDurationMs;

    /** Ids of the users @mentioned in the caption/text, as a CSV (e.g. "3,7"). */
    @Column(length = 512)
    private String mentions;

    /**
     * Set when this status was added from someone else's (they @mentioned me and
     * I tapped "Add to my status"). Points at the ORIGINAL — re-sharing a re-share
     * still credits the person who made it — and stays valid after the original
     * expires or is deleted.
     */
    @Column(name = "original_status_id")
    private Long originalStatusId;

    @Column(name = "original_user_id")
    private Long originalUserId;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;
}
