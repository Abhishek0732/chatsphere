package com.chatsphere.status;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;

public interface StatusRepository extends JpaRepository<Status, Long> {

    /** Active (non-expired) statuses for a set of users, oldest first. */
    List<Status> findByUserIdInAndExpiresAtAfterOrderByCreatedAtAsc(
            Collection<Long> userIds, Instant now);

    /** Have I already added this status to mine? Hits idx_status_repost. */
    boolean existsByUserIdAndOriginalStatusId(Long userId, Long originalStatusId);
}
