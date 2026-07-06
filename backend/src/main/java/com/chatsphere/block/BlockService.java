package com.chatsphere.block;

import com.chatsphere.common.error.ApiException;
import com.chatsphere.user.UserRepository;
import com.chatsphere.user.dto.UserDto;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.Set;

@Service
public class BlockService {

    private final BlockRepository blockRepository;
    private final UserRepository userRepository;

    public BlockService(BlockRepository blockRepository, UserRepository userRepository) {
        this.blockRepository = blockRepository;
        this.userRepository = userRepository;
    }

    /**
     * A time span during which a user was blocked. `until` is null while the
     * block is still active (i.e. hide everything from `from` onward).
     */
    public record BlockWindow(Long blockedId, Instant from, Instant until) {
        boolean covers(Long senderId, Instant when) {
            if (!Objects.equals(blockedId, senderId) || when == null) return false;
            if (when.isBefore(from)) return false;
            return until == null || !when.isAfter(until);
        }
    }

    @Transactional
    public void block(Long actorId, Long targetId) {
        if (Objects.equals(actorId, targetId)) {
            throw ApiException.badRequest("You cannot block yourself");
        }
        userRepository.findById(targetId)
                .orElseThrow(() -> ApiException.notFound("User not found"));
        if (!blockRepository.existsByBlockerIdAndBlockedIdAndUnblockedAtIsNull(actorId, targetId)) {
            Block b = new Block();
            b.setBlockerId(actorId);
            b.setBlockedId(targetId);
            blockRepository.save(b);
        }
    }

    @Transactional
    public void unblock(Long actorId, Long targetId) {
        // Close the active block window (keep the row so messages sent during
        // the block stay hidden forever).
        blockRepository.findFirstByBlockerIdAndBlockedIdAndUnblockedAtIsNull(actorId, targetId)
                .ifPresent(b -> {
                    b.setUnblockedAt(Instant.now());
                    blockRepository.save(b);
                });
    }

    @Transactional(readOnly = true)
    public boolean isBlocked(Long blockerId, Long blockedId) {
        return blockRepository.existsByBlockerIdAndBlockedIdAndUnblockedAtIsNull(blockerId, blockedId);
    }

    /** Ids the given user is CURRENTLY blocking. */
    @Transactional(readOnly = true)
    public Set<Long> blockedUserIds(Long blockerId) {
        return Set.copyOf(blockRepository.findActivelyBlockedIds(blockerId));
    }

    /** Everyone in an active block relationship with the user, either direction
     *  (users they block + users who block them). */
    @Transactional(readOnly = true)
    public Set<Long> blockRelatedUserIds(Long userId) {
        Set<Long> ids = new java.util.HashSet<>(blockRepository.findActivelyBlockedIds(userId));
        ids.addAll(blockRepository.findActiveBlockerIds(userId));
        return ids;
    }

    /** The users the given user is currently blocking, for display. */
    @Transactional(readOnly = true)
    public List<UserDto> listBlocked(Long actorId) {
        List<Long> ids = blockRepository.findActivelyBlockedIds(actorId);
        return userRepository.findAllById(ids).stream().map(UserDto::from).toList();
    }

    /** Whether this user has any block history at all (perf shortcut). */
    @Transactional(readOnly = true)
    public boolean hasAnyBlocks(Long blockerId) {
        return blockRepository.existsByBlockerId(blockerId);
    }

    /** All block windows this user has ever created (active + historical). */
    @Transactional(readOnly = true)
    public List<BlockWindow> blockWindows(Long blockerId) {
        return blockRepository.findByBlockerId(blockerId).stream()
                .map(b -> new BlockWindow(b.getBlockedId(), b.getCreatedAt(), b.getUnblockedAt()))
                .toList();
    }

    /** True if a message from `senderId` at `when` falls inside any block window. */
    public static boolean isHidden(List<BlockWindow> windows, Long senderId, Instant when) {
        for (BlockWindow w : windows) {
            if (w.covers(senderId, when)) return true;
        }
        return false;
    }

    /**
     * Filter a conversation's member ids down to those a message from `senderId`
     * may be delivered to: everyone except members who currently block the
     * sender. The sender is always kept (so their own echo still arrives).
     */
    @Transactional(readOnly = true)
    public List<Long> filterDeliverable(Long senderId, List<Long> memberIds) {
        Set<Long> blockedSender = Set.copyOf(blockRepository.findActiveBlockerIds(senderId));
        if (blockedSender.isEmpty()) {
            return memberIds;
        }
        return memberIds.stream()
                .filter(id -> Objects.equals(id, senderId) || !blockedSender.contains(id))
                .toList();
    }
}
