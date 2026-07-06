package com.chatsphere.chat.repo;

import com.chatsphere.chat.domain.Message;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface MessageRepository extends JpaRepository<Message, Long> {

    @Query("""
            SELECT m FROM Message m
            WHERE m.conversationId = :conversationId
              AND m.deleted = false
              AND m.id > :clearedId
              AND (:beforeId IS NULL OR m.id < :beforeId)
            ORDER BY m.id DESC
            """)
    List<Message> findPage(@Param("conversationId") Long conversationId,
                           @Param("beforeId") Long beforeId,
                           @Param("clearedId") long clearedId,
                           Pageable pageable);

    Message findTopByConversationIdAndDeletedFalseOrderByIdDesc(Long conversationId);

    List<Message> findByConversationIdAndPinnedTrueAndDeletedFalseOrderByIdDesc(Long conversationId);

    @Query("""
            SELECT COUNT(m) FROM Message m
            WHERE m.conversationId = :conversationId
              AND m.deleted = false
              AND m.senderId <> :userId
              AND (:lastReadId IS NULL OR m.id > :lastReadId)
            """)
    long countUnread(@Param("conversationId") Long conversationId,
                     @Param("userId") Long userId,
                     @Param("lastReadId") Long lastReadId);

    @Query("""
            SELECT m FROM Message m
            WHERE m.deleted = false
              AND m.conversationId IN (
                  SELECT cm.conversationId FROM ConversationMember cm WHERE cm.userId = :userId
              )
              AND LOWER(m.content) LIKE LOWER(CONCAT('%', :q, '%'))
            ORDER BY m.id DESC
            """)
    List<Message> searchInUserConversations(@Param("q") String q,
                                            @Param("userId") Long userId,
                                            Pageable pageable);
}
