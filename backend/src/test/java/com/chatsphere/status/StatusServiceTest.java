package com.chatsphere.status;

import com.chatsphere.block.BlockService;
import com.chatsphere.chat.ChatBroadcaster;
import com.chatsphere.chat.ChatService;
import com.chatsphere.chat.repo.ConversationMemberRepository;
import com.chatsphere.common.error.ApiException;
import com.chatsphere.contact.Contact;
import com.chatsphere.contact.ContactRepository;
import com.chatsphere.messaging.ChatEventPublisher;
import com.chatsphere.notification.NotificationService;
import com.chatsphere.status.dto.StatusDtos.CreateStatusRequest;
import com.chatsphere.status.dto.StatusDtos.StatusItemDto;
import com.chatsphere.status.dto.StatusDtos.StatusUserDto;
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
import org.springframework.http.HttpStatus;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Mention CSV encode/decode, the "add to my status" (repost) rules, and the
 * feed's canAdd flag. Pure unit tests — repositories are mocked, no Spring, no DB.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class StatusServiceTest {

    private static final long ME = 1L;

    @Mock StatusRepository statusRepository;
    @Mock StatusViewRepository viewRepository;
    @Mock ContactRepository contactRepository;
    @Mock ConversationMemberRepository memberRepository;
    @Mock UserRepository userRepository;
    @Mock BlockService blockService;
    @Mock ChatService chatService;
    @Mock ChatBroadcaster chatBroadcaster;
    @Mock NotificationService notificationService;
    @Mock ChatEventPublisher chatEventPublisher;
    @Mock StatusPrivacyRepository privacyRepository;
    @Mock StatusPrivacyUserRepository privacyUserRepository;

    private StatusService service;

    /** The universe of users these tests know about, resolved by findAllById/findById. */
    private final List<User> universe = new ArrayList<>();

    @BeforeEach
    void setUp() {
        service = new StatusService(statusRepository, viewRepository, contactRepository,
                memberRepository, userRepository, blockService, chatService, chatBroadcaster,
                notificationService, chatEventPublisher, privacyRepository, privacyUserRepository);

        universe.clear();
        for (long id = 1; id <= 5; id++) universe.add(user(id, "user" + id));

        when(userRepository.findAllById(any())).thenAnswer(inv -> {
            Collection<Long> ids = idsOf(inv.getArgument(0));
            return universe.stream().filter(u -> ids.contains(u.getId())).toList();
        });
        when(userRepository.findById(anyLong())).thenAnswer(inv -> {
            Long id = inv.getArgument(0);
            return universe.stream().filter(u -> u.getId().equals(id)).findFirst();
        });
        // Statuses come back from save() unchanged (no DB-generated fields needed here).
        when(statusRepository.save(any(Status.class))).thenAnswer(inv -> inv.getArgument(0));
        // No blocks and no privacy restrictions unless a test says otherwise.
        when(blockService.blockRelatedUserIds(anyLong())).thenReturn(Set.of());
        when(privacyRepository.findById(anyLong())).thenReturn(Optional.empty());
        when(privacyUserRepository.findByOwnerId(anyLong())).thenReturn(List.of());
        when(privacyRepository.findAllById(any())).thenReturn(List.of());
        when(privacyUserRepository.findByOwnerIdIn(any())).thenReturn(List.of());
    }

    @SuppressWarnings("unchecked")
    private static Collection<Long> idsOf(Object arg) {
        if (arg instanceof Collection<?> c) return (Collection<Long>) c;
        return StreamSupport.stream(((Iterable<Long>) arg).spliterator(), false).toList();
    }

    // ── helpers ──

    private static User user(long id, String name) {
        User u = new User();
        u.setId(id);
        u.setUsername(name);
        u.setEmail(name + "@x.test");
        u.setDisplayName(name.toUpperCase());
        return u;
    }

    private static Status status(long id, long userId, String mentions) {
        Status s = new Status();
        s.setId(id);
        s.setUserId(userId);
        s.setType(Status.Type.TEXT);
        s.setCaption("hello");
        s.setMentions(mentions);
        s.setCreatedAt(Instant.now());
        s.setExpiresAt(Instant.now().plus(24, ChronoUnit.HOURS));
        return s;
    }

    private void iHaveContacts(long... contactIds) {
        List<Contact> contacts = new ArrayList<>();
        for (long id : contactIds) {
            Contact c = new Contact();
            c.setOwnerId(ME);
            c.setContactUserId(id);
            contacts.add(c);
        }
        when(contactRepository.findByOwnerIdOrderByIdDesc(ME)).thenReturn(contacts);
    }

    private Status savedStatus() {
        ArgumentCaptor<Status> captor = ArgumentCaptor.forClass(Status.class);
        verify(statusRepository).save(captor.capture());
        return captor.getValue();
    }

    // ─────────────────────────────────────────────────────────────────────
    @Nested
    @DisplayName("mention CSV encode (via create)")
    class EncodeMentions {

        private CreateStatusRequest text(List<Long> mentions) {
            return new CreateStatusRequest("TEXT", null, "hi @you", null,
                    null, null, null, null, mentions);
        }

        @Test
        void encodesContactIdsAsCsv() {
            iHaveContacts(2L, 3L);
            service.create(ME, text(List.of(2L, 3L)));
            assertThat(savedStatus().getMentions()).isEqualTo("2,3");
        }

        @Test
        void dropsNonContacts_soAClientCannotTagAStranger() {
            iHaveContacts(2L);
            service.create(ME, text(List.of(2L, 99L)));
            assertThat(savedStatus().getMentions()).isEqualTo("2");
        }

        @Test
        void deduplicatesAndPreservesOrder() {
            iHaveContacts(2L, 3L);
            service.create(ME, text(List.of(3L, 2L, 3L)));
            assertThat(savedStatus().getMentions()).isEqualTo("3,2");
        }

        @Test
        void nullWhenNothingSurvivesFiltering() {
            iHaveContacts(2L);
            service.create(ME, text(List.of(99L)));
            assertThat(savedStatus().getMentions()).isNull();
        }

        @Test
        void nullWhenNoMentionsGiven() {
            iHaveContacts(2L);
            service.create(ME, text(null));
            assertThat(savedStatus().getMentions()).isNull();
        }

        @Test
        void capsAt32Mentions() {
            List<Long> many = new ArrayList<>();
            List<Contact> contacts = new ArrayList<>();
            for (long id = 100; id < 150; id++) {
                many.add(id);
                Contact c = new Contact();
                c.setOwnerId(ME);
                c.setContactUserId(id);
                contacts.add(c);
            }
            when(contactRepository.findByOwnerIdOrderByIdDesc(ME)).thenReturn(contacts);

            service.create(ME, text(many));

            String csv = savedStatus().getMentions();
            assertThat(csv.split(",")).hasSize(32);
            assertThat(csv).startsWith("100,101,").endsWith(",131");
        }

        @Test
        void mentionedPeopleAreNotified_butNeverTheAuthorThemselves() {
            iHaveContacts(2L, ME);
            service.create(ME, text(List.of(2L, ME)));

            verify(notificationService)
                    .notifyUser(eq(2L), eq("STATUS_MENTION"), eq("USER1"),
                            eq("mentioned you in their status: hi @you"), isNull());
            verify(notificationService, never())
                    .notifyUser(eq(ME), any(), any(), any(), any());
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    @Nested
    @DisplayName("mention CSV decode (via addToMyStatus)")
    class DecodeMentions {

        @Test
        void toleratesWhitespaceAndSkipsGarbageParts() {
            // A hand-written / legacy CSV: spaces and a non-numeric entry.
            Status src = status(10L, 2L, " 3 , oops ,1 ");
            when(statusRepository.findById(10L)).thenReturn(Optional.of(src));

            // "1" is still decoded despite the noise, so I am allowed to add it.
            StatusItemDto dto = service.addToMyStatus(ME, 10L);
            assertThat(dto).isNotNull();
        }

        @Test
        void emptyCsvMeansNobodyIsMentioned() {
            Status src = status(10L, 2L, "");
            when(statusRepository.findById(10L)).thenReturn(Optional.of(src));

            assertThatThrownBy(() -> service.addToMyStatus(ME, 10L))
                    .isInstanceOf(ApiException.class)
                    .hasMessageContaining("Only people mentioned");
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    @Nested
    @DisplayName("addToMyStatus (repost rules)")
    class AddToMyStatus {

        @Test
        void rejectsUnknownStatus() {
            when(statusRepository.findById(10L)).thenReturn(Optional.empty());
            assertThatThrownBy(() -> service.addToMyStatus(ME, 10L))
                    .isInstanceOf(ApiException.class)
                    .satisfies(e -> assertThat(((ApiException) e).getStatus()).isEqualTo(HttpStatus.NOT_FOUND));
        }

        @Test
        void cannotAddMyOwnStatus() {
            when(statusRepository.findById(10L)).thenReturn(Optional.of(status(10L, ME, "2")));
            assertThatThrownBy(() -> service.addToMyStatus(ME, 10L))
                    .isInstanceOf(ApiException.class)
                    .hasMessage("This is already your status");
            verify(statusRepository, never()).save(any());
        }

        @Test
        void onlyMentionedUsersMayAdd() {
            when(statusRepository.findById(10L)).thenReturn(Optional.of(status(10L, 2L, "3,4")));
            assertThatThrownBy(() -> service.addToMyStatus(ME, 10L))
                    .isInstanceOf(ApiException.class)
                    .hasMessage("Only people mentioned in this status can add it")
                    .satisfies(e -> assertThat(((ApiException) e).getStatus()).isEqualTo(HttpStatus.FORBIDDEN));
            verify(statusRepository, never()).save(any());
        }

        @Test
        void cannotAddAnExpiredStatus() {
            Status src = status(10L, 2L, "1");
            src.setExpiresAt(Instant.now().minusSeconds(5));
            when(statusRepository.findById(10L)).thenReturn(Optional.of(src));

            assertThatThrownBy(() -> service.addToMyStatus(ME, 10L))
                    .isInstanceOf(ApiException.class)
                    .hasMessage("This status has expired");
        }

        @Test
        void cannotAddFromSomeoneInABlockRelationship() {
            when(statusRepository.findById(10L)).thenReturn(Optional.of(status(10L, 2L, "1")));
            when(blockService.blockRelatedUserIds(ME)).thenReturn(Set.of(2L));

            assertThatThrownBy(() -> service.addToMyStatus(ME, 10L))
                    .isInstanceOf(ApiException.class)
                    .hasMessage("You can't add this status");
        }

        @Test
        void cannotAddTheSameStatusTwice() {
            when(statusRepository.findById(10L)).thenReturn(Optional.of(status(10L, 2L, "1")));
            when(statusRepository.existsByUserIdAndOriginalStatusId(ME, 10L)).thenReturn(true);

            assertThatThrownBy(() -> service.addToMyStatus(ME, 10L))
                    .isInstanceOf(ApiException.class)
                    .hasMessage("Already added to your status");
            verify(statusRepository, never()).save(any());
        }

        @Test
        void copyCreditsTheOriginalAuthorAndCarriesTheContent() {
            Status src = status(10L, 2L, "1");
            src.setMediaUrl("http://m/1.jpg");
            src.setBgColor("#fff");
            src.setMusicUrl("http://m/song.mp3");
            src.setMusicTitle("Song");
            src.setMusicArtist("Artist");
            src.setMusicDurationMs(1234);
            when(statusRepository.findById(10L)).thenReturn(Optional.of(src));

            service.addToMyStatus(ME, 10L);

            Status copy = savedStatus();
            assertThat(copy.getUserId()).isEqualTo(ME);
            assertThat(copy.getOriginalStatusId()).isEqualTo(10L);
            assertThat(copy.getOriginalUserId()).isEqualTo(2L);
            assertThat(copy.getMentions()).isEqualTo("1");     // tags travel with the caption
            assertThat(copy.getCaption()).isEqualTo("hello");
            assertThat(copy.getMediaUrl()).isEqualTo("http://m/1.jpg");
            assertThat(copy.getMusicTitle()).isEqualTo("Song");
            assertThat(copy.getExpiresAt()).isAfter(Instant.now().plus(23, ChronoUnit.HOURS));
        }

        /** The point of the root pointer: a re-share of a re-share still credits the original. */
        @Test
        void resharingAReshareStillPointsAtTheROOTStatusAndAuthor() {
            // user 3 already added user 2's status #10; #20 is that intermediate copy.
            Status intermediate = status(20L, 3L, "1");
            intermediate.setOriginalStatusId(10L);
            intermediate.setOriginalUserId(2L);
            when(statusRepository.findById(20L)).thenReturn(Optional.of(intermediate));

            service.addToMyStatus(ME, 20L);

            Status copy = savedStatus();
            assertThat(copy.getOriginalStatusId()).isEqualTo(10L);   // NOT 20
            assertThat(copy.getOriginalUserId()).isEqualTo(2L);      // NOT 3
            // The ORIGINAL author is told, not the intermediate re-sharer.
            verify(notificationService).notifyUser(eq(2L), eq("STATUS_REPOST"), eq("USER1"),
                    eq("added your status to theirs"), isNull());
            verify(notificationService, never()).notifyUser(eq(3L), any(), any(), any(), any());
        }

        /** The "already added?" check must be made against the ROOT id, not the row I clicked. */
        @Test
        void alreadyAddedIsCheckedAgainstTheRootId() {
            Status intermediate = status(20L, 3L, "1");
            intermediate.setOriginalStatusId(10L);
            intermediate.setOriginalUserId(2L);
            when(statusRepository.findById(20L)).thenReturn(Optional.of(intermediate));
            when(statusRepository.existsByUserIdAndOriginalStatusId(ME, 10L)).thenReturn(true);

            assertThatThrownBy(() -> service.addToMyStatus(ME, 20L))
                    .isInstanceOf(ApiException.class)
                    .hasMessage("Already added to your status");
        }

        /** Someone re-shared MY status and tagged me: adding it back would be adding my own. */
        @Test
        void cannotAddBackAReshareOfMyOwnStatus() {
            Status reshareOfMine = status(20L, 2L, "1");
            reshareOfMine.setOriginalStatusId(10L);
            reshareOfMine.setOriginalUserId(ME);
            when(statusRepository.findById(20L)).thenReturn(Optional.of(reshareOfMine));

            assertThatThrownBy(() -> service.addToMyStatus(ME, 20L))
                    .isInstanceOf(ApiException.class)
                    .hasMessage("This status is already yours");
            verify(statusRepository, never()).save(any());
        }

        /** Being tagged in the original already notified them — the copy must not re-notify. */
        @Test
        void copyDoesNotReNotifyTheMentionedPeople() {
            when(statusRepository.findById(10L)).thenReturn(Optional.of(status(10L, 2L, "1")));

            service.addToMyStatus(ME, 10L);

            verify(notificationService, never())
                    .notifyUser(any(), eq("STATUS_MENTION"), any(), any(), any());
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    @Nested
    @DisplayName("feed canAdd flag")
    class FeedCanAdd {

        private List<StatusUserDto> feedWith(Status... statuses) {
            iHaveContacts(2L, 3L);
            when(statusRepository.findByUserIdInAndExpiresAtAfterOrderByCreatedAtAsc(any(), any()))
                    .thenReturn(List.of(statuses));
            when(viewRepository.findByViewerIdAndStatusIdIn(anyLong(), any())).thenReturn(List.of());
            when(viewRepository.countByStatusIdIn(any())).thenReturn(List.of());
            return service.feed(ME);
        }

        private boolean canAdd(List<StatusUserDto> feed, long statusId) {
            return feed.stream().flatMap(u -> u.items().stream())
                    .filter(i -> i.id() == statusId)
                    .findFirst().orElseThrow().canAdd();
        }

        @Test
        void trueWhenSomeoneElseTaggedMeAndIHaventAddedIt() {
            List<StatusUserDto> feed = feedWith(status(10L, 2L, "1"));
            assertThat(canAdd(feed, 10L)).isTrue();
        }

        @Test
        void falseWhenIAmNotMentioned() {
            List<StatusUserDto> feed = feedWith(status(10L, 2L, "3"));
            assertThat(canAdd(feed, 10L)).isFalse();
        }

        @Test
        void falseWhenNobodyIsMentioned() {
            List<StatusUserDto> feed = feedWith(status(10L, 2L, null));
            assertThat(canAdd(feed, 10L)).isFalse();
        }

        @Test
        void falseForMyOwnStatus() {
            List<StatusUserDto> feed = feedWith(status(10L, ME, "1"));
            assertThat(canAdd(feed, 10L)).isFalse();
        }

        /** My own copy is in this very feed, so "already added" costs no query. */
        @Test
        void falseOnceIHaveAlreadyAddedIt() {
            Status original = status(10L, 2L, "1");
            Status myCopy = status(11L, ME, "1");
            myCopy.setOriginalStatusId(10L);
            myCopy.setOriginalUserId(2L);

            List<StatusUserDto> feed = feedWith(original, myCopy);
            assertThat(canAdd(feed, 10L)).isFalse();
        }

        /** A re-share of a re-share: already-added is matched on the root id. */
        @Test
        void falseForAnIntermediateReshareOfSomethingIAlreadyAdded() {
            Status intermediate = status(20L, 3L, "1");
            intermediate.setOriginalStatusId(10L);
            intermediate.setOriginalUserId(2L);
            Status myCopy = status(11L, ME, "1");
            myCopy.setOriginalStatusId(10L);
            myCopy.setOriginalUserId(2L);

            List<StatusUserDto> feed = feedWith(intermediate, myCopy);
            assertThat(canAdd(feed, 20L)).isFalse();
        }

        /** A re-share I have NOT added is addable, and it credits the root author. */
        @Test
        void trueForAnIntermediateReshareIHaventAdded() {
            Status intermediate = status(20L, 3L, "1");
            intermediate.setOriginalStatusId(10L);
            intermediate.setOriginalUserId(2L);

            List<StatusUserDto> feed = feedWith(intermediate);
            assertThat(canAdd(feed, 20L)).isTrue();

            StatusItemDto item = feed.stream().flatMap(u -> u.items().stream())
                    .filter(i -> i.id() == 20L).findFirst().orElseThrow();
            assertThat(item.originalUser()).isNotNull();
            assertThat(item.originalUser().id()).isEqualTo(2L);
            assertThat(item.mentions()).extracting("id").containsExactly(ME);
        }

        /** Someone re-shared MY status back at me — not addable. */
        @Test
        void falseForAReshareOfMyOwnStatusSharedBackToMe() {
            Status reshareOfMine = status(20L, 2L, "1");
            reshareOfMine.setOriginalStatusId(10L);
            reshareOfMine.setOriginalUserId(ME);

            List<StatusUserDto> feed = feedWith(reshareOfMine);
            assertThat(canAdd(feed, 20L)).isFalse();
        }

        @Test
        void blockedUsersAreNotInTheFeedAtAll() {
            when(blockService.blockRelatedUserIds(ME)).thenReturn(Set.of(2L));
            iHaveContacts(2L, 3L);
            when(statusRepository.findByUserIdInAndExpiresAtAfterOrderByCreatedAtAsc(any(), any()))
                    .thenReturn(List.of());

            service.feed(ME);

            @SuppressWarnings("unchecked")
            ArgumentCaptor<Collection<Long>> visible = ArgumentCaptor.forClass(Collection.class);
            verify(statusRepository)
                    .findByUserIdInAndExpiresAtAfterOrderByCreatedAtAsc(visible.capture(), any());
            assertThat(visible.getValue()).contains(ME, 3L).doesNotContain(2L);
        }
    }
}
