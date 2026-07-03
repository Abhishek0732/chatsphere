package com.chatsphere.contact;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ContactRepository extends JpaRepository<Contact, Long> {

    List<Contact> findByOwnerIdOrderByIdDesc(Long ownerId);

    boolean existsByOwnerIdAndContactUserId(Long ownerId, Long contactUserId);

    Optional<Contact> findByIdAndOwnerId(Long id, Long ownerId);
}
