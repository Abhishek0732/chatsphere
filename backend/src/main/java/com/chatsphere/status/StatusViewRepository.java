package com.chatsphere.status;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface StatusViewRepository extends JpaRepository<StatusView, Long> {

    boolean existsByStatusIdAndViewerId(Long statusId, Long viewerId);

    long countByStatusId(Long statusId);

    /** View counts for MANY statuses in one query (the feed used to COUNT per status). */
    @org.springframework.data.jpa.repository.Query("""
            SELECT v.statusId, COUNT(v) FROM StatusView v
            WHERE v.statusId IN :ids
            GROUP BY v.statusId
            """)
    java.util.List<Object[]> countByStatusIdIn(
            @org.springframework.data.repository.query.Param("ids") java.util.Collection<Long> ids);

    List<StatusView> findByStatusIdOrderByViewedAtDesc(Long statusId);

    /** Views by one viewer across a set of statuses (to compute "seen" flags). */
    List<StatusView> findByViewerIdAndStatusIdIn(Long viewerId, Collection<Long> statusIds);
}
