package com.chatsphere.chat.repo;

import com.chatsphere.chat.domain.Conversation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ConversationRepository extends JpaRepository<Conversation, Long> {

    /**
     * Take the conversation's row lock BEFORE writing a message into it.
     *
     * Inserting a message takes a shared lock on this row (the foreign key check);
     * updating last_message_id then needs to upgrade that to an exclusive lock. Two
     * concurrent sends each held the shared lock and each waited for the other to
     * release it — a deadlock, and MySQL rolled one of them back, so the message
     * was SILENTLY LOST. Acquiring the exclusive lock first makes every sender take
     * locks in the same order, which cannot deadlock.
     */
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.QueryHints({
            @jakarta.persistence.QueryHint(name = "jakarta.persistence.lock.timeout", value = "3000")
    })
    @org.springframework.data.jpa.repository.Query("SELECT c FROM Conversation c WHERE c.id = :id")
    java.util.Optional<Conversation> findByIdForUpdate(
            @org.springframework.data.repository.query.Param("id") Long id);

    Optional<Conversation> findByDirectKey(String directKey);

    @Query("""
            SELECT c FROM Conversation c
            WHERE c.id IN (
                SELECT m.conversationId FROM ConversationMember m WHERE m.userId = :userId
            )
            ORDER BY c.updatedAt DESC
            """)
    List<Conversation> findAllForUser(@Param("userId") Long userId);

    /** Group conversations that both users are members of. */
    @Query("""
            SELECT c FROM Conversation c
            WHERE c.type = com.chatsphere.chat.domain.Conversation.Type.GROUP
              AND EXISTS (SELECT 1 FROM ConversationMember a WHERE a.conversationId = c.id AND a.userId = :userA)
              AND EXISTS (SELECT 1 FROM ConversationMember b WHERE b.conversationId = c.id AND b.userId = :userB)
            ORDER BY c.updatedAt DESC
            """)
    List<Conversation> findCommonGroups(@Param("userA") Long userA, @Param("userB") Long userB);
}
