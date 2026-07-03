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
}
