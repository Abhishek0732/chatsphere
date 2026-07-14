package com.chatsphere.user;

import com.chatsphere.common.cache.HotPathCache;
import com.chatsphere.common.error.ApiException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Account deletion is destructive and once broke OTHER people's apps, so the
 * exact semantics are pinned here:
 *
 *  - the user ROW survives (messages.sender_id is ON DELETE CASCADE),
 *  - username + email stay reserved, so the identity cannot be re-registered,
 *  - DIRECT conversation memberships are KEPT (deleting them left the counterpart
 *    with a nameless, avatar-less conversation and crashed their client),
 *  - GROUP memberships are removed.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AccountDeletionServiceTest {

    private static final long USER_ID = 42L;
    private static final String PASSWORD = "correct-horse";

    @Mock UserRepository userRepository;
    @Mock PasswordEncoder passwordEncoder;
    @Mock JdbcTemplate jdbc;
    @Mock HotPathCache cache;

    private AccountDeletionService service;
    private User user;

    /** Every SQL statement the service issued, in order. */
    private final List<String> sql = new ArrayList<>();

    @BeforeEach
    void setUp() {
        service = new AccountDeletionService(userRepository, passwordEncoder, jdbc, cache);

        user = new User();
        user.setId(USER_ID);
        user.setUsername("alice");
        user.setEmail("alice@example.com");
        user.setDisplayName("Alice");
        user.setAbout("hi there");
        user.setAvatarUrl("http://cdn/alice.jpg");
        user.setProtectAvatar(true);
        user.setPasswordHash("$2a$hash-of-correct-horse");
        user.setQrToken("qr-alice");
        user.setInviteCode("ALICE1");

        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(PASSWORD, user.getPasswordHash())).thenReturn(true);
        when(passwordEncoder.encode(anyString())).thenReturn("$2a$brand-new-random");

        sql.clear();
        when(jdbc.update(anyString(), any(Object[].class))).thenAnswer(inv -> {
            sql.add(inv.getArgument(0));
            return 1;
        });
    }

    private String normalisedSql() {
        return String.join(" | ", sql).replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
    }

    // ── the row must survive ──

    @Test
    void theUserRowIsNeverDeleted_itIsAnonymisedInPlace() {
        service.deleteOwnAccount(USER_ID, PASSWORD);

        verify(userRepository, never()).delete(any());
        verify(userRepository, never()).deleteById(any());
        verify(userRepository).save(user);
        assertThat(normalisedSql()).doesNotContain("delete from users");
    }

    /** The identity is retired, not recycled: nobody can re-register alice/alice@example.com. */
    @Test
    void usernameAndEmailStayReserved() {
        service.deleteOwnAccount(USER_ID, PASSWORD);

        assertThat(user.getUsername()).isEqualTo("alice");
        assertThat(user.getEmail()).isEqualTo("alice@example.com");
    }

    @Test
    void personalDataIsWipedAndTheAccountIsClosed() {
        service.deleteOwnAccount(USER_ID, PASSWORD);

        assertThat(user.getDeletedAt()).isNotNull().isBeforeOrEqualTo(Instant.now());
        assertThat(user.getDisplayName()).isEqualTo(AccountDeletionService.ANONYMISED_NAME);
        assertThat(user.getAvatarUrl()).isNull();
        assertThat(user.getAbout()).isNull();
        assertThat(user.isProtectAvatar()).isFalse();
        // A password nobody holds.
        assertThat(user.getPasswordHash()).isEqualTo("$2a$brand-new-random");
        // The QR / invite links must stop resolving to anyone.
        assertThat(user.getQrToken()).startsWith("deleted-").isNotEqualTo("qr-alice");
        assertThat(user.getInviteCode()).isNull();
    }

    // ── conversation memberships: the bug that broke other people's app ──

    /**
     * Deleting the DIRECT membership left the counterpart with a conversation that
     * had no other member, so it had no name and no avatar — and their client
     * crashed on it. Only GROUP memberships may go.
     */
    @Test
    void directMembershipsAreKept_onlyGroupMembershipsAreRemoved() {
        service.deleteOwnAccount(USER_ID, PASSWORD);

        List<String> memberDeletes = sql.stream()
                .filter(s -> s.toLowerCase(Locale.ROOT).contains("conversation_members"))
                .toList();

        assertThat(memberDeletes)
                .as("exactly one statement should touch conversation_members")
                .hasSize(1);

        String stmt = memberDeletes.get(0).replaceAll("\\s+", " ").toLowerCase(Locale.ROOT).trim();
        // It must be narrowed to GROUP conversations via the join...
        assertThat(stmt).contains("join conversations");
        assertThat(stmt).contains("c.type = 'group'");
        // ...and it must NOT be an unqualified wipe of every membership.
        assertThat(stmt).doesNotMatch("^delete from conversation_members where user_id = \\?$");
    }

    @Test
    void theirOwnDataIsRemoved() {
        service.deleteOwnAccount(USER_ID, PASSWORD);

        String all = normalisedSql();
        assertThat(all).contains("delete from contacts");
        assertThat(all).contains("delete from contact_requests");
        assertThat(all).contains("delete from blocks");
        assertThat(all).contains("delete from statuses");
        assertThat(all).contains("delete from status_views");
        assertThat(all).contains("delete from notifications");
        assertThat(all).contains("delete from group_invites");
        assertThat(all).contains("delete from devices");
        assertThat(all).contains("delete from user_presence");
        // Every session is revoked, so an already-signed-in client stops working.
        assertThat(all).contains("delete from refresh_tokens");
        assertThat(all).contains("delete from password_reset_tokens");
    }

    /** Messages are other people's data — never touched. */
    @Test
    void messagesAndConversationsThemselvesAreNeverDeleted() {
        service.deleteOwnAccount(USER_ID, PASSWORD);

        String all = normalisedSql();
        assertThat(all).doesNotContain("delete from messages");
        assertThat(all).doesNotContain("delete from conversations");
    }

    /** The send path caches "is this person deleted" — a stale entry keeps them reachable. */
    @Test
    void theHotPathCacheIsInvalidated() {
        service.deleteOwnAccount(USER_ID, PASSWORD);
        verify(cache).invalidateUser(USER_ID);
    }

    // ── guards ──

    @Test
    void wrongPasswordDeletesNothing() {
        when(passwordEncoder.matches("nope", user.getPasswordHash())).thenReturn(false);

        assertThatThrownBy(() -> service.deleteOwnAccount(USER_ID, "nope"))
                .isInstanceOf(ApiException.class)
                .hasMessage("Password is incorrect");

        verifyNoInteractions(jdbc);
        verify(userRepository, never()).save(any());
        assertThat(user.getDeletedAt()).isNull();
    }

    @Test
    void blankPasswordDeletesNothing() {
        assertThatThrownBy(() -> service.deleteOwnAccount(USER_ID, "  "))
                .isInstanceOf(ApiException.class)
                .hasMessage("Password is incorrect");

        verifyNoInteractions(jdbc);
        assertThat(user.getDeletedAt()).isNull();
    }

    @Test
    void anAlreadyDeletedAccountCannotBeDeletedAgain() {
        user.setDeletedAt(Instant.now().minusSeconds(60));

        assertThatThrownBy(() -> service.deleteOwnAccount(USER_ID, PASSWORD))
                .isInstanceOf(ApiException.class)
                .hasMessage("This account is already deleted");

        verifyNoInteractions(jdbc);
        verify(userRepository, never()).save(any());
    }

    @Test
    void unknownUserIsNotFound() {
        when(userRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.deleteOwnAccount(99L, PASSWORD))
                .isInstanceOf(ApiException.class)
                .hasMessage("User not found");

        verifyNoInteractions(jdbc);
    }
}
