package com.chatsphere.contact;

import com.chatsphere.contact.ContactRequest.Status;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ContactRequestRepository extends JpaRepository<ContactRequest, Long> {

    List<ContactRequest> findByRecipientIdAndStatusOrderByIdDesc(Long recipientId, Status status);

    List<ContactRequest> findBySenderIdAndStatusOrderByIdDesc(Long senderId, Status status);

    Optional<ContactRequest> findBySenderIdAndRecipientIdAndStatus(Long senderId, Long recipientId, Status status);

    Optional<ContactRequest> findByIdAndRecipientId(Long id, Long recipientId);
}
