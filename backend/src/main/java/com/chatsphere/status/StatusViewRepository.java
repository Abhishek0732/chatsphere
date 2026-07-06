package com.chatsphere.status;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface StatusViewRepository extends JpaRepository<StatusView, Long> {

    boolean existsByStatusIdAndViewerId(Long statusId, Long viewerId);

    long countByStatusId(Long statusId);

    List<StatusView> findByStatusIdOrderByViewedAtDesc(Long statusId);

    /** Views by one viewer across a set of statuses (to compute "seen" flags). */
    List<StatusView> findByViewerIdAndStatusIdIn(Long viewerId, Collection<Long> statusIds);
}
