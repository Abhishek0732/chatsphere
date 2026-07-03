package com.chatsphere.chat.repo;

import com.chatsphere.chat.domain.MessageStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface MessageStatusRepository extends JpaRepository<MessageStatus, Long> {

    Optional<MessageStatus> findByMessageIdAndUserId(Long messageId, Long userId);
}
