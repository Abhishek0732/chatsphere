package com.chatsphere.block;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface BlockRepository extends JpaRepository<Block, Long> {

    /** An active block exists (blocker currently blocks blocked). */
    boolean existsByBlockerIdAndBlockedIdAndUnblockedAtIsNull(Long blockerId, Long blockedId);

    /** The active block row, if any, so it can be closed on unblock. */
    Optional<Block> findFirstByBlockerIdAndBlockedIdAndUnblockedAtIsNull(Long blockerId, Long blockedId);

    /** Does this user have any block rows at all (active or historical)? */
    boolean existsByBlockerId(Long blockerId);

    /** All block rows the user created, for building block windows. */
    List<Block> findByBlockerId(Long blockerId);

    /** Ids of users the given user is CURRENTLY blocking. */
    @Query("select b.blockedId from Block b where b.blockerId = :blockerId and b.unblockedAt is null")
    List<Long> findActivelyBlockedIds(@Param("blockerId") Long blockerId);

    /** Ids of users who are CURRENTLY blocking the given user. */
    @Query("select b.blockerId from Block b where b.blockedId = :blockedId and b.unblockedAt is null")
    List<Long> findActiveBlockerIds(@Param("blockedId") Long blockedId);
}
