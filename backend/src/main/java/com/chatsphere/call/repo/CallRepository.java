package com.chatsphere.call.repo;

import com.chatsphere.call.domain.Call;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface CallRepository extends JpaRepository<Call, Long> {

    Optional<Call> findByCallUid(String callUid);

    /** Any live call (ringing or active) a user is part of — used for resume-on-reconnect. */
    @Query("""
            SELECT c FROM Call c
            WHERE (c.callerId = :userId OR c.calleeId = :userId)
              AND c.status IN :statuses
            ORDER BY c.id DESC
            """)
    List<Call> findByUserAndStatuses(@Param("userId") Long userId,
                                     @Param("statuses") Collection<Call.Status> statuses,
                                     Pageable pageable);

    /** Full call log for a user, newest first (served by the counterpart+created indexes). */
    @Query("""
            SELECT c FROM Call c
            WHERE c.callerId = :userId OR c.calleeId = :userId
            ORDER BY c.id DESC
            """)
    List<Call> findHistory(@Param("userId") Long userId, Pageable pageable);

    long countByCalleeIdAndStatus(Long calleeId, Call.Status status);

    /** Backstop for the ring-timeout sweeper (covers the instance that scheduled it dying). */
    List<Call> findByStatusAndCreatedAtBefore(Call.Status status, Instant cutoff);
}
