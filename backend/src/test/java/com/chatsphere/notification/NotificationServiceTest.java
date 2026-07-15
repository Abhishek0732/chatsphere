package com.chatsphere.notification;

import com.chatsphere.chat.dto.ChatDtos.MessageDto;
import com.chatsphere.common.realtime.StompRelay;
import com.chatsphere.notification.dto.NotificationDto;
import com.chatsphere.presence.PresenceService;
import com.chatsphere.push.PushService;
import com.chatsphere.user.User;
import com.chatsphere.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.stream.StreamSupport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * The notification-row POLICY, which is what took a 500-member group from 2426ms
 * to 61ms per message:
 *
 *   DIRECT message -> notify the recipient.
 *   GROUP message  -> write rows ONLY for the @mentioned users.
 *   Never notify the sender.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class NotificationServiceTest {

    private static final long SENDER = 1L;

    @Mock NotificationRepository repository;
    @Mock StompRelay relay;
    @Mock PresenceService presenceService;
    @Mock UserRepository userRepository;
    @Mock PushService pushService;

    private NotificationService service;

    private final List<User> universe = new ArrayList<>();

    @BeforeEach
    void setUp() {
        service = new NotificationService(repository, relay, presenceService, userRepository,
                pushService);

        // Nobody is connected unless a test says otherwise.
        when(presenceService.onlineAmong(any())).thenReturn(Set.of());

        universe.clear();
        for (long id = 1; id <= 6; id++) universe.add(user(id, "user" + id));

        when(userRepository.findAllById(any())).thenAnswer(inv -> {
            Collection<Long> ids = ids(inv.getArgument(0));
            return universe.stream().filter(u -> ids.contains(u.getId())).toList();
        });
        when(userRepository.findById(org.mockito.ArgumentMatchers.anyLong())).thenAnswer(inv -> {
            Long id = inv.getArgument(0);
            return universe.stream().filter(u -> u.getId().equals(id)).findFirst();
        });
        // save/saveAll echo the rows back, as a real repository would.
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(repository.saveAll(any())).thenAnswer(inv -> {
            Iterable<Notification> batch = inv.getArgument(0);
            return StreamSupport.stream(batch.spliterator(), false).toList();
        });
    }

    @SuppressWarnings("unchecked")
    private static Collection<Long> ids(Object arg) {
        if (arg instanceof Collection<?> c) return (Collection<Long>) c;
        return StreamSupport.stream(((Iterable<Long>) arg).spliterator(), false).toList();
    }

    private static User user(long id, String username) {
        User u = new User();
        u.setId(id);
        u.setUsername(username);
        u.setEmail(username + "@x.test");
        u.setDisplayName(username.toUpperCase());
        return u;
    }

    private static MessageDto message(String type, String content, List<Long> mentions) {
        return message(type, content, mentions, false);
    }

    private static MessageDto message(String type, String content, List<Long> mentions,
                                      boolean encrypted) {
        return new MessageDto(500L, 900L, SENDER, "USER1", content, type, null,
                Instant.now(), "SENT", null, false, null, List.of(), false, null, null, mentions,
                encrypted, null, false, false, null);
    }

    /** An end-to-end encrypted message: the server holds ciphertext and nothing else. */
    private static MessageDto encrypted(String ciphertext) {
        return message("TEXT", ciphertext, List.of(), true);
    }

    private static MessageDto text(String content, List<Long> mentions) {
        return message("TEXT", content, mentions);
    }

    /** The rows actually handed to saveAll. */
    private List<Notification> savedRows() {
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<Notification>> captor = ArgumentCaptor.forClass(List.class);
        verify(repository).saveAll(captor.capture());
        return captor.getValue();
    }

    // ─────────────────────────────────────────────────────────────────────
    @Nested
    @DisplayName("DIRECT (2 members)")
    class Direct {

        @Test
        void notifiesTheRecipient() {
            service.notifyNewMessage(text("hey", null), List.of(SENDER, 2L), SENDER);

            List<Notification> rows = savedRows();
            assertThat(rows).hasSize(1);
            Notification n = rows.get(0);
            assertThat(n.getUserId()).isEqualTo(2L);
            assertThat(n.getType()).isEqualTo("MESSAGE");
            assertThat(n.getTitle()).isEqualTo("USER1");
            assertThat(n.getBody()).isEqualTo("hey");
            assertThat(n.getRefId()).isEqualTo(900L);   // the conversation
        }

        @Test
        void pushesToTheRecipientOverTheRelay() {
            service.notifyNewMessage(text("hey", null), List.of(SENDER, 2L), SENDER);

            verify(relay).toUser(eq("user2"), eq("/queue/notifications"), any(NotificationDto.class));
            verify(relay, never()).toUser(eq("user1"), anyString(), any());
        }

        @Test
        void theSenderNeverNotifiesThemselves() {
            service.notifyNewMessage(text("hey", null), List.of(SENDER, 2L), SENDER);

            assertThat(savedRows()).extracting(Notification::getUserId).doesNotContain(SENDER);
        }

        /** A message to a conversation whose only member is the sender writes nothing. */
        @Test
        void aConversationWithOnlyTheSenderWritesNoRows() {
            service.notifyNewMessage(text("hey", null), List.of(SENDER), SENDER);

            verify(repository, never()).saveAll(any());
            verifyNoInteractions(relay);
        }

        @Test
        void mediaMessagesGetAReadablePreview() {
            service.notifyNewMessage(message("IMAGE", null, null), List.of(SENDER, 2L), SENDER);
            assertThat(savedRows().get(0).getBody()).isEqualTo("📷 Photo");
        }

        @Test
        void fileMessagesGetAReadablePreview() {
            service.notifyNewMessage(message("FILE", null, null), List.of(SENDER, 2L), SENDER);
            assertThat(savedRows().get(0).getBody()).isEqualTo("📎 Attachment");
        }

        @Test
        void nullContentBecomesAnEmptyBody() {
            service.notifyNewMessage(text(null, null), List.of(SENDER, 2L), SENDER);
            assertThat(savedRows().get(0).getBody()).isEmpty();
        }

        @Test
        void anEncryptedMessageIsNeverQuotedInTheNotification() {
            // The whole point of E2E encryption: the server holds ciphertext. Putting
            // it in the notification would show the recipient gibberish — and if we
            // could show them the real text, the encryption would be a lie.
            String ciphertext = "v1.7mK2xQ==.9fA1bZ3cD4eF5gH6iJ7kL8mN";
            service.notifyNewMessage(encrypted(ciphertext), List.of(SENDER, 2L), SENDER);

            String body = savedRows().get(0).getBody();
            assertThat(body).isEqualTo("🔒 sent you a message");
            assertThat(body).doesNotContain(ciphertext);
        }

        @Test
        void bodyIsTruncatedToTwoHundredCharacters() {
            service.notifyNewMessage(text("x".repeat(500), null), List.of(SENDER, 2L), SENDER);
            assertThat(savedRows().get(0).getBody()).hasSize(200);
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    @Nested
    @DisplayName("GROUP (3+ members)")
    class Group {

        private final List<Long> members = List.of(SENDER, 2L, 3L, 4L, 5L);

        /** The fix: a plain group message writes NO notification rows at all. */
        @Test
        void aPlainGroupMessageWritesNoRowsAndPushesNothing() {
            service.notifyNewMessage(text("morning all", null), members, SENDER);

            verify(repository, never()).saveAll(any());
            verify(repository, never()).save(any());
            verifyNoInteractions(relay);
            verifyNoInteractions(pushService);
            // Not even the batched user lookup is needed.
            verify(userRepository, never()).findAllById(any());
        }

        @Test
        void anEmptyMentionListIsStillAPlainGroupMessage() {
            service.notifyNewMessage(text("morning all", List.of()), members, SENDER);

            verify(repository, never()).saveAll(any());
            verifyNoInteractions(relay);
        }

        /** The smallest group: 3 members, no mention -> still nothing. */
        @Test
        void theThreeMemberBoundaryCountsAsAGroup() {
            service.notifyNewMessage(text("hi", null), List.of(SENDER, 2L, 3L), SENDER);

            verify(repository, never()).saveAll(any());
        }

        @Test
        void onlyMentionedMembersGetARow() {
            service.notifyNewMessage(text("ping @user3", List.of(3L)), members, SENDER);

            List<Notification> rows = savedRows();
            assertThat(rows).hasSize(1);
            assertThat(rows.get(0).getUserId()).isEqualTo(3L);
            verify(relay).toUser(eq("user3"), eq("/queue/notifications"), any());
            verify(relay, never()).toUser(eq("user2"), anyString(), any());
            verify(relay, never()).toUser(eq("user4"), anyString(), any());
        }

        @Test
        void severalMentionsGetSeveralRowsInOneBatch() {
            service.notifyNewMessage(text("ping", List.of(3L, 4L)), members, SENDER);

            assertThat(savedRows()).extracting(Notification::getUserId)
                    .containsExactlyInAnyOrder(3L, 4L);
            verify(repository, org.mockito.Mockito.times(1)).saveAll(any());  // ONE batched insert
        }

        @Test
        void aMentionReadsDifferentlyFromAnOrdinaryMessage() {
            service.notifyNewMessage(text("ping", List.of(3L)), members, SENDER);

            assertThat(savedRows().get(0).getBody()).isEqualTo("@ mentioned you: ping");
        }

        /** Mentioning yourself must not notify you. */
        @Test
        void theSenderIsExcludedEvenWhenTheyMentionThemselves() {
            service.notifyNewMessage(text("ping", List.of(SENDER, 3L)), members, SENDER);

            assertThat(savedRows()).extracting(Notification::getUserId).containsExactly(3L);
        }

        /** A mention of someone who isn't a member (or no longer exists) writes nothing. */
        @Test
        void mentionsOfNonMembersAreIgnored() {
            service.notifyNewMessage(text("ping", List.of(99L)), members, SENDER);

            verify(repository, never()).saveAll(any());
        }

        /** A mentioned id with no user row is skipped rather than crashing the send. */
        @Test
        void aMentionedUserThatNoLongerExistsIsSkipped() {
            universe.removeIf(u -> u.getId() == 3L);

            service.notifyNewMessage(text("ping", List.of(3L)), members, SENDER);

            assertThat(savedRows()).isEmpty();
            verifyNoInteractions(relay);
        }

        /** The regression this replaced: 499 rows for one message to a 500-member group. */
        @Test
        void aFiveHundredMemberGroupWritesZeroRowsForAPlainMessage() {
            List<Long> big = new ArrayList<>();
            big.add(SENDER);
            for (long id = 2; id <= 500; id++) big.add(id);

            service.notifyNewMessage(text("hello everyone", null), big, SENDER);

            verify(repository, never()).saveAll(any());
            verifyNoInteractions(relay);
            verifyNoInteractions(pushService);
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    @Nested
    @DisplayName("Web Push (only the people the socket cannot reach)")
    class WebPush {

        @Test
        void anOfflineRecipientIsPushed() {
            when(presenceService.onlineAmong(any())).thenReturn(Set.of());

            service.notifyNewMessage(text("hey", null), List.of(SENDER, 2L), SENDER);

            verify(pushService).pushToUsers(eq(List.of(2L)), eq("USER1"), eq("hey"), eq("/"));
        }

        /** Pushing to a connected client would announce the same message twice. */
        @Test
        void anOnlineRecipientIsNotPushed() {
            when(presenceService.onlineAmong(any())).thenReturn(Set.of(2L));

            service.notifyNewMessage(text("hey", null), List.of(SENDER, 2L), SENDER);

            verify(pushService, never()).pushToUsers(any(), any(), any(), any());
        }

        @Test
        void onlyTheOfflineMentionedMembersOfAGroupArePushed() {
            when(presenceService.onlineAmong(any())).thenReturn(Set.of(3L));

            service.notifyNewMessage(text("ping", List.of(3L, 4L)),
                    List.of(SENDER, 2L, 3L, 4L, 5L), SENDER);

            // 3 is connected, 4 is not; 2 and 5 were never mentioned.
            verify(pushService).pushToUsers(eq(List.of(4L)), eq("USER1"), eq("ping"), eq("/"));
        }

        @Test
        void aGenericNotificationPushesWhenTheUserIsOffline() {
            when(presenceService.onlineAmong(any())).thenReturn(Set.of());

            service.notifyUser(2L, "CONTACT_REQUEST", "USER1", "wants to connect", null);

            verify(pushService).pushToUsers(eq(List.of(2L)), eq("USER1"), eq("wants to connect"),
                    eq("/"));
        }

        @Test
        void aGenericNotificationDoesNotPushWhenTheUserIsOnline() {
            when(presenceService.onlineAmong(any())).thenReturn(Set.of(2L));

            service.notifyUser(2L, "CONTACT_REQUEST", "USER1", "wants to connect", null);

            verifyNoInteractions(pushService);
        }
    }
}
