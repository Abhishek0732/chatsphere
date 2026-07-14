package com.chatsphere.push;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface PushSubscriptionRepository extends JpaRepository<PushSubscription, Long> {

    Optional<PushSubscription> findByEndpoint(String endpoint);

    /** Every device to push to, for a batch of recipients — one query, no N+1. */
    List<PushSubscription> findByUserIdIn(Collection<Long> userIds);

    @Modifying
    @Query("delete from PushSubscription p where p.endpoint = :endpoint")
    void deleteByEndpoint(@Param("endpoint") String endpoint);

    /** Everyone who has push enabled — used to warm the subscriber set at boot. */
    @Query("select distinct p.userId from PushSubscription p")
    List<Long> findDistinctUserIds();

    boolean existsByUserId(Long userId);
}
