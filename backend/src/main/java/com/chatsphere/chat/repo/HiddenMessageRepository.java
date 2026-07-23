package com.chatsphere.chat.repo;

import com.chatsphere.chat.domain.HiddenMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface HiddenMessageRepository extends JpaRepository<HiddenMessage, HiddenMessage.Key> {

    /** Of these message ids, which has the user deleted for themselves. */
    @Query("SELECT h.messageId FROM HiddenMessage h WHERE h.userId = :userId AND h.messageId IN :ids")
    List<Long> hiddenIdsAmong(@Param("userId") Long userId, @Param("ids") Collection<Long> ids);

    boolean existsByUserIdAndMessageId(Long userId, Long messageId);
}
