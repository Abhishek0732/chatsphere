package com.chatsphere.block;

import com.chatsphere.block.BlockService.BlockWindow;
import com.chatsphere.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The block WINDOW semantics. Unblocking does NOT delete the row, it sets
 * unblocked_at — so a message that arrived DURING a block stays hidden forever,
 * even after the block is lifted.
 */
@ExtendWith(MockitoExtension.class)
class BlockServiceTest {

    private static final long SENDER = 7L;
    private static final long OTHER = 8L;

    /** A fixed timeline so the boundary assertions are exact. */
    private static final Instant T0 = Instant.parse("2026-01-01T10:00:00Z");
    private static final Instant BLOCKED_AT = Instant.parse("2026-01-01T11:00:00Z");
    private static final Instant DURING = Instant.parse("2026-01-01T11:30:00Z");
    private static final Instant UNBLOCKED_AT = Instant.parse("2026-01-01T12:00:00Z");
    private static final Instant AFTER = Instant.parse("2026-01-01T13:00:00Z");

    @Mock BlockRepository blockRepository;
    @Mock UserRepository userRepository;

    private BlockService service;

    @BeforeEach
    void setUp() {
        service = new BlockService(blockRepository, userRepository);
    }

    // ─────────────────────────────────────────────────────────────────────
    @Nested
    @DisplayName("isHidden — window boundaries")
    class IsHiddenWindows {

        /** A closed window: blocked at 11:00, unblocked at 12:00. */
        private final List<BlockWindow> closed =
                List.of(new BlockWindow(SENDER, BLOCKED_AT, UNBLOCKED_AT));

        /** An open window: blocked at 11:00, still blocked. */
        private final List<BlockWindow> open =
                List.of(new BlockWindow(SENDER, BLOCKED_AT, null));

        @Test
        void messageBeforeTheBlockStartedIsVisible() {
            assertThat(BlockService.isHidden(closed, SENDER, T0)).isFalse();
        }

        @Test
        void messageExactlyAtTheBlockStartIsHidden() {
            assertThat(BlockService.isHidden(closed, SENDER, BLOCKED_AT)).isTrue();
        }

        /** THE point of keeping the row: still hidden long after the unblock. */
        @Test
        void messageDuringTheBlockStaysHiddenForeverAfterUnblocking() {
            assertThat(BlockService.isHidden(closed, SENDER, DURING)).isTrue();
        }

        @Test
        void messageExactlyAtTheUnblockInstantIsHidden() {
            assertThat(BlockService.isHidden(closed, SENDER, UNBLOCKED_AT)).isTrue();
        }

        @Test
        void messageAfterTheUnblockIsVisibleAgain() {
            assertThat(BlockService.isHidden(closed, SENDER, AFTER)).isFalse();
            assertThat(BlockService.isHidden(closed, SENDER, UNBLOCKED_AT.plusMillis(1))).isFalse();
        }

        @Test
        void openWindowHidesEverythingFromTheBlockOnward() {
            assertThat(BlockService.isHidden(open, SENDER, T0)).isFalse();
            assertThat(BlockService.isHidden(open, SENDER, BLOCKED_AT)).isTrue();
            assertThat(BlockService.isHidden(open, SENDER, DURING)).isTrue();
            assertThat(BlockService.isHidden(open, SENDER, AFTER)).isTrue();
        }

        @Test
        void windowsOnlyApplyToTheirOwnSender() {
            assertThat(BlockService.isHidden(open, OTHER, DURING)).isFalse();
        }

        @Test
        void nullTimestampIsNeverHidden() {
            assertThat(BlockService.isHidden(open, SENDER, null)).isFalse();
        }

        @Test
        void noWindowsMeansNothingIsHidden() {
            assertThat(BlockService.isHidden(List.of(), SENDER, DURING)).isFalse();
        }

        /** Blocked, unblocked, blocked again: each window hides its own span. */
        @Test
        void multipleWindowsForTheSameSenderAreAllHonoured() {
            List<BlockWindow> windows = List.of(
                    new BlockWindow(SENDER, BLOCKED_AT, UNBLOCKED_AT),
                    new BlockWindow(SENDER, AFTER, null));

            assertThat(BlockService.isHidden(windows, SENDER, DURING)).isTrue();      // 1st window
            assertThat(BlockService.isHidden(windows, SENDER,
                    Instant.parse("2026-01-01T12:30:00Z"))).isFalse();                // the gap
            assertThat(BlockService.isHidden(windows, SENDER, AFTER)).isTrue();       // 2nd window
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    @Nested
    @DisplayName("blockWindows / unblock")
    class Windows {

        @Test
        void unblockClosesTheRowInsteadOfDeletingIt() {
            Block b = new Block();
            b.setBlockerId(OTHER);
            b.setBlockedId(SENDER);
            b.setCreatedAt(BLOCKED_AT);
            when(blockRepository.findFirstByBlockerIdAndBlockedIdAndUnblockedAtIsNull(OTHER, SENDER))
                    .thenReturn(java.util.Optional.of(b));

            service.unblock(OTHER, SENDER);

            assertThat(b.getUnblockedAt()).isNotNull();
            verify(blockRepository).save(b);
            verify(blockRepository, times(0)).delete(b);
        }

        @Test
        void windowsAreBuiltFromCreatedAtAndUnblockedAt() {
            Block b = new Block();
            b.setBlockerId(OTHER);
            b.setBlockedId(SENDER);
            b.setCreatedAt(BLOCKED_AT);
            b.setUnblockedAt(UNBLOCKED_AT);
            when(blockRepository.findByBlockerId(OTHER)).thenReturn(List.of(b));

            List<BlockWindow> windows = service.blockWindows(OTHER);

            assertThat(windows).containsExactly(new BlockWindow(SENDER, BLOCKED_AT, UNBLOCKED_AT));
            // And a message sent inside it is still hidden.
            assertThat(BlockService.isHidden(windows, SENDER, DURING)).isTrue();
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    @Nested
    @DisplayName("filterDeliverable")
    class FilterDeliverable {

        @Test
        void keepsEveryoneWhenNobodyBlocksTheSender() {
            when(blockRepository.findActiveBlockerIds(SENDER)).thenReturn(List.of());
            List<Long> members = List.of(SENDER, OTHER, 9L);

            assertThat(service.filterDeliverable(SENDER, members)).isEqualTo(members);
        }

        @Test
        void dropsMembersWhoCurrentlyBlockTheSender() {
            when(blockRepository.findActiveBlockerIds(SENDER)).thenReturn(List.of(OTHER));

            assertThat(service.filterDeliverable(SENDER, List.of(SENDER, OTHER, 9L)))
                    .containsExactly(SENDER, 9L);
        }

        /** The sender always keeps their own echo, whatever the block rows say. */
        @Test
        void senderIsAlwaysKept() {
            when(blockRepository.findActiveBlockerIds(SENDER)).thenReturn(List.of(SENDER, OTHER));

            assertThat(service.filterDeliverable(SENDER, List.of(SENDER, OTHER)))
                    .containsExactly(SENDER);
        }

        /** This query used to run on EVERY message: it is cached for 60s. */
        @Test
        void blockerLookupIsCachedAcrossCalls() {
            when(blockRepository.findActiveBlockerIds(SENDER)).thenReturn(List.of(OTHER));

            service.filterDeliverable(SENDER, List.of(SENDER, OTHER));
            service.filterDeliverable(SENDER, List.of(SENDER, OTHER));
            service.filterDeliverable(SENDER, List.of(SENDER, OTHER));

            verify(blockRepository, times(1)).findActiveBlockerIds(SENDER);
        }

        /** Blocking must take effect at once, not up to a minute later. */
        @Test
        void invalidatingTheCacheForcesAFreshLookup() {
            when(blockRepository.findActiveBlockerIds(SENDER)).thenReturn(List.of(OTHER));
            service.filterDeliverable(SENDER, List.of(SENDER, OTHER));

            service.invalidateBlockCache(OTHER, SENDER);
            when(blockRepository.findActiveBlockerIds(SENDER)).thenReturn(List.of());

            assertThat(service.filterDeliverable(SENDER, List.of(SENDER, OTHER)))
                    .containsExactly(SENDER, OTHER);
            verify(blockRepository, times(2)).findActiveBlockerIds(SENDER);
        }
    }
}
