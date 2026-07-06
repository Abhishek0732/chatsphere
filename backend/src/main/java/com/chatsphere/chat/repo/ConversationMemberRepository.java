package com.chatsphere.chat.repo;

import com.chatsphere.chat.domain.ConversationMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ConversationMemberRepository extends JpaRepository<ConversationMember, Long> {

    List<ConversationMember> findByConversationId(Long conversationId);

    Optional<ConversationMember> findByConversationIdAndUserId(Long conversationId, Long userId);

    boolean existsByConversationIdAndUserId(Long conversationId, Long userId);

    long countByConversationId(Long conversationId);

    void deleteByConversationIdAndUserId(Long conversationId, Long userId);

    /** Distinct ids of everyone who shares at least one conversation with the user. */
    @Query("""
            SELECT DISTINCT other.userId FROM ConversationMember me
            JOIN ConversationMember other ON other.conversationId = me.conversationId
            WHERE me.userId = :userId AND other.userId <> :userId
            """)
    List<Long> findConnectedUserIds(@Param("userId") Long userId);
}
