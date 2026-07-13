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

    /** Full transcript (oldest first) for export, respecting the per-user cleared floor. */
    @Query("""
            SELECT m FROM Message m
            WHERE m.conversationId = :conversationId
              AND m.id > :clearedId
            ORDER BY m.id ASC
            """)
    List<Message> findForExport(@Param("conversationId") Long conversationId,
                                @Param("clearedId") long clearedId,
                                Pageable pageable);

    /** Attachments of a given type (IMAGE = media, FILE = docs) — cursor-paginated, newest first. */
    @Query("""
            SELECT m FROM Message m
            WHERE m.conversationId = :conversationId
              AND m.id > :clearedId
              AND (:beforeId IS NULL OR m.id < :beforeId)
              AND m.deleted = false
              AND m.type = :type
              AND m.attachmentUrl IS NOT NULL
            ORDER BY m.id DESC
            """)
    List<Message> findAttachmentsByType(@Param("conversationId") Long conversationId,
                                        @Param("clearedId") long clearedId,
                                        @Param("beforeId") Long beforeId,
                                        @Param("type") Message.Type type,
                                        Pageable pageable);

    /** Messages containing a shared link — cursor-paginated, newest first. */
    @Query("""
            SELECT m FROM Message m
            WHERE m.conversationId = :conversationId
              AND m.id > :clearedId
              AND (:beforeId IS NULL OR m.id < :beforeId)
              AND m.deleted = false
              AND LOWER(m.content) LIKE '%http%'
            ORDER BY m.id DESC
            """)
    List<Message> findLinks(@Param("conversationId") Long conversationId,
                            @Param("clearedId") long clearedId,
                            @Param("beforeId") Long beforeId,
                            Pageable pageable);

    Message findTopByConversationIdAndDeletedFalseOrderByIdDesc(Long conversationId);

    /** Latest non-deleted message for EACH of many conversations, in one query. */
    @Query("""
            SELECT m FROM Message m
            WHERE m.deleted = false
              AND m.conversationId IN :conversationIds
              AND m.id IN (
                  SELECT MAX(m2.id) FROM Message m2
                  WHERE m2.deleted = false AND m2.conversationId IN :conversationIds
                  GROUP BY m2.conversationId
              )
            """)
    List<Message> findLatestPerConversation(@Param("conversationIds") java.util.Collection<Long> conversationIds);

    /**
     * Unread counts for EACH conversation for one viewer, in one query. Unread =
     * non-deleted messages from others past the viewer's floor (max of their
     * read pointer and cleared point). Returns rows of [conversationId, count].
     */
    @Query("""
            SELECT m.conversationId, COUNT(m) FROM Message m, ConversationMember cm
            WHERE cm.userId = :userId
              AND cm.conversationId = m.conversationId
              AND m.conversationId IN :conversationIds
              AND m.deleted = false
              AND m.senderId <> :userId
              AND m.id > (CASE WHEN COALESCE(cm.clearedUpToMessageId, 0) > COALESCE(cm.lastReadMessageId, 0)
                               THEN COALESCE(cm.clearedUpToMessageId, 0)
                               ELSE COALESCE(cm.lastReadMessageId, 0) END)
            GROUP BY m.conversationId
            """)
    List<Object[]> countUnreadPerConversation(@Param("userId") Long userId,
                                              @Param("conversationIds") java.util.Collection<Long> conversationIds);

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

    /**
     * Message search. Uses the FULLTEXT index on messages.content (ft_msg_content,
     * created in V1 and until now completely unused): the old JPQL
     * {@code LOWER(content) LIKE '%q%'} has a leading wildcard, so NO index could
     * ever serve it and every search scanned every message in the database.
     *
     * Native query, because JPQL cannot express MATCH ... AGAINST.
     */
    @Query(value = """
            SELECT /*+ MAX_EXECUTION_TIME(3000) */ m.* FROM messages m
            WHERE m.deleted = 0
              AND m.conversation_id IN (
                  SELECT cm.conversation_id FROM conversation_members cm WHERE cm.user_id = :userId
              )
              AND MATCH(m.content) AGAINST (:q IN BOOLEAN MODE)
            ORDER BY m.id DESC
            LIMIT :limit
            """, nativeQuery = true)
    List<Message> searchInUserConversations(@Param("q") String q,
                                            @Param("userId") Long userId,
                                            @Param("limit") int limit);
}
