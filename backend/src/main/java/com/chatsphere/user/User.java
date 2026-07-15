package com.chatsphere.user;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "users")
@Getter
@Setter
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 50)
    private String username;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Column(name = "display_name", nullable = false, length = 100)
    private String displayName;

    @Column(length = 255)
    private String about;

    @Column(name = "avatar_url", length = 512)
    private String avatarUrl;

    /**
     * When true, other clients apply download/screenshot deterrents to this
     * user's profile picture (no save, no drag, hidden download button, blur on
     * tab-blur / PrintScreen). A privacy preference the user controls.
     */
    @Column(name = "protect_avatar", nullable = false)
    private boolean protectAvatar = false;

    /**
     * WhatsApp-style reciprocal read receipts. When false, this user does not send
     * read receipts and does not see anyone else's (enforced for DIRECT chats;
     * group read receipts are always on). Defaults true.
     */
    @Column(name = "read_receipts_enabled", nullable = false)
    private boolean readReceiptsEnabled = true;

    /**
     * When false, this user's last-seen / online is hidden from others, and — the
     * reciprocal half — theirs is hidden from this user. Defaults true.
     */
    @Column(name = "last_seen_enabled", nullable = false)
    private boolean lastSeenEnabled = true;

    @Column(nullable = false, length = 20)
    private String role = "USER";

    /** Rotatable token behind the user's "add me" QR code. */
    @Column(name = "qr_token", nullable = false, unique = true, length = 64)
    private String qrToken;

    /**
     * Set when the account is deleted. The row survives (their old messages point
     * at it, and their username/email stay reserved so nobody can re-register
     * them), but the account is closed and anonymised.
     */
    @Column(name = "deleted_at")
    private java.time.Instant deletedAt;


    /** Short code behind the shareable "add me" link (/i/<code>). Rotatable. */
    @Column(name = "invite_code", unique = true, length = 16)
    private String inviteCode;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Instant updatedAt;
}
