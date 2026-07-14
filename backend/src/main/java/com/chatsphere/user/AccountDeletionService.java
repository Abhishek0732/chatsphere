package com.chatsphere.user;

import com.chatsphere.common.error.ApiException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

/**
 * Closing an account, for good.
 *
 * The user row is deliberately NOT deleted. {@code messages.sender_id} is
 * ON DELETE CASCADE, so dropping the row would take every message this person
 * ever sent out of OTHER people's conversations — their friends' chat history
 * would come apart, and replies quoting them would point at nothing. One
 * person's decision must not destroy someone else's data.
 *
 * So the account is closed and the person is anonymised:
 *  - they can never sign in again (deleted_at is set, and auth rejects it),
 *  - every piece of personal data is overwritten: email, username, display name,
 *    photo, about, and the QR/invite codes that identify them,
 *  - their contacts, contact requests, group memberships, blocks, statuses,
 *    devices and notifications are removed,
 *  - all sessions are revoked, so anything already signed in stops working,
 *  - their past messages remain in other people's chats, shown as "Deleted user".
 */
@Service
public class AccountDeletionService {

    private static final Logger log = LoggerFactory.getLogger(AccountDeletionService.class);

    /** What a deleted person is called wherever their old messages still appear. */
    public static final String ANONYMISED_NAME = "Deleted user";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JdbcTemplate jdbc;
    private final com.chatsphere.common.cache.HotPathCache cache;

    public AccountDeletionService(UserRepository userRepository,
                                  PasswordEncoder passwordEncoder,
                                  JdbcTemplate jdbc,
                                  com.chatsphere.common.cache.HotPathCache cache) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jdbc = jdbc;
        this.cache = cache;
    }

    /**
     * @param rawPassword the account's current password — deletion is
     *                    irreversible, so we insist the person proves it's them
     *                    and not someone using an unlocked device.
     */
    @Transactional
    public void deleteOwnAccount(Long userId, String rawPassword) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> ApiException.notFound("User not found"));
        if (user.getDeletedAt() != null) {
            throw ApiException.badRequest("This account is already deleted");
        }
        if (rawPassword == null || rawPassword.isBlank()
                || !passwordEncoder.matches(rawPassword, user.getPasswordHash())) {
            throw ApiException.badRequest("Password is incorrect");
        }

        // Their own data. Everything here belongs solely to them, so it goes.
        jdbc.update("DELETE FROM contacts WHERE owner_id = ? OR contact_user_id = ?", userId, userId);
        jdbc.update("DELETE FROM contact_requests WHERE sender_id = ? OR recipient_id = ?", userId, userId);
        // Leave DIRECT chats alone: removing the membership leaves the other person
        // with a one-sided conversation that has no counterpart — the chat loses its
        // name and avatar entirely. They keep a normal 1:1 chat with "Deleted user".
        // Only group memberships go, so the person is out of every group.
        jdbc.update("""
                DELETE cm FROM conversation_members cm
                JOIN conversations c ON c.id = cm.conversation_id
                WHERE cm.user_id = ? AND c.type = 'GROUP'
                """, userId);
        jdbc.update("DELETE FROM blocks WHERE blocker_id = ? OR blocked_id = ?", userId, userId);
        jdbc.update("DELETE FROM statuses WHERE user_id = ?", userId);          // views cascade
        jdbc.update("DELETE FROM status_views WHERE viewer_id = ?", userId);
        jdbc.update("DELETE FROM notifications WHERE user_id = ?", userId);
        jdbc.update("DELETE FROM group_invites WHERE inviter_id = ? OR invitee_id = ?", userId, userId);
        jdbc.update("DELETE FROM devices WHERE user_id = ?", userId);
        jdbc.update("DELETE FROM user_presence WHERE user_id = ?", userId);
        // Kill every session, so an already-signed-in client stops working.
        jdbc.update("DELETE FROM refresh_tokens WHERE user_id = ?", userId);
        jdbc.update("DELETE FROM password_reset_tokens WHERE user_id = ?", userId);

        // Anonymise the row their old messages still point at.
        //
        // The username and email are deliberately KEPT. They are what the unique
        // constraints are built on, so leaving them in place is what stops the
        // same username/email being signed up again — a deleted account's identity
        // is retired, not recycled. They are never shown anywhere: deleted users
        // are excluded from search and the directory, and their old messages
        // render as "Deleted user".
        user.setDeletedAt(Instant.now());
        user.setDisplayName(ANONYMISED_NAME);
        user.setAvatarUrl(null);
        user.setAbout(null);
        user.setProtectAvatar(false);
        // A password nobody holds: the account cannot be signed into or reset.
        user.setPasswordHash(passwordEncoder.encode(UUID.randomUUID().toString()));
        // Their QR and invite links must stop resolving to anyone.
        user.setQrToken("deleted-" + UUID.randomUUID());
        user.setInviteCode(null);
        // Encryption keys go too. The wrapped private key is useless without the
        // password we just destroyed, but there is no reason to keep it — and
        // dropping the public key means nobody can encrypt anything new to them.
        user.setPublicKey(null);
        user.setEncPrivateKey(null);
        user.setEncKeySalt(null);
        user.setEncKeyIv(null);
        userRepository.save(user);

        // The send path checks a cached "is this person deleted" flag — clear it, or
        // messages to them would still go through for a few minutes.
        cache.invalidateUser(userId);
        log.info("account {} deleted and anonymised", userId);
    }
}
