package com.chatsphere.chat.repo;

import com.chatsphere.chat.domain.Conversation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ConversationRepository extends JpaRepository<Conversation, Long> {

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
