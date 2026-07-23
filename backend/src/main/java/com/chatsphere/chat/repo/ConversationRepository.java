package com.chatsphere.chat.repo;

import com.chatsphere.chat.domain.Conversation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ConversationRepository extends JpaRepository<Conversation, Long> {

    /**
     * Point the conversation at its newest message and float it to the top of the
     * chat list. GREATEST keeps it monotonic: two messages committing at the same
     * moment cannot move the pointer backwards.
     */
    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query(value = """
            UPDATE conversations
               SET last_message_id = GREATEST(COALESCE(last_message_id, 0), :messageId),
                   updated_at = CURRENT_TIMESTAMP
             WHERE id = :conversationId
            """, nativeQuery = true)
    void advanceLastMessage(
            @org.springframework.data.repository.query.Param("conversationId") Long conversationId,
            @org.springframework.data.repository.query.Param("messageId") Long messageId);

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

    /**
     * The user's chat list. A conversation the user has "deleted for me" (its
     * member row carries a hidden_up_to_message_id) drops off the list until a
     * newer message arrives — i.e. while last_message_id has not climbed past the
     * hidden marker. COALESCE handles a conversation with no messages yet (id 0).
     */
    @Query("""
            SELECT c FROM Conversation c, ConversationMember m
            WHERE m.conversationId = c.id
              AND m.userId = :userId
              AND (m.hiddenUpToMessageId IS NULL
                   OR m.hiddenUpToMessageId < COALESCE(c.lastMessageId, 0))
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
