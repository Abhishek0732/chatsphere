package com.chatsphere.user;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

/**
 * One user's end-to-end encryption keys.
 *
 * Deliberately NOT columns on {@code users}: that table is batch-loaded on the chat
 * list, the send path and the notification fan-out, and none of those care about key
 * material. Keys are read at login (your own) and when you first message somebody
 * (their public key) — a completely different access pattern, so a separate table.
 *
 * The private key is stored ONLY as a blob wrapped with a key derived from the
 * user's password. The server holds it and cannot open it.
 */
@Entity
@Table(name = "user_keys")
@Getter
@Setter
public class UserKey {

    @Id
    @Column(name = "user_id")
    private Long userId;

    /** Raw ECDH P-256 public point, base64. Safe to hand to anyone. */
    @Column(name = "public_key", nullable = false, length = 255)
    private String publicKey;

    @Column(name = "enc_private_key", nullable = false, columnDefinition = "TEXT")
    private String encPrivateKey;

    /** PBKDF2 salt + AES-GCM IV for the blob above. Not secrets; needed to unwrap. */
    @Column(name = "enc_key_salt", nullable = false, length = 64)
    private String encKeySalt;

    @Column(name = "enc_key_iv", nullable = false, length = 64)
    private String encKeyIv;

    /**
     * Bumped only when the key PAIR is replaced (e.g. after a password reset, where
     * the old private key is unrecoverable) — not when it is merely re-wrapped under
     * a new password, which changes nothing anyone else can read.
     */
    @Column(name = "key_version", nullable = false)
    private int keyVersion = 1;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Instant updatedAt;
}
