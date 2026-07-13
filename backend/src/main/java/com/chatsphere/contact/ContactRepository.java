package com.chatsphere.contact;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ContactRepository extends JpaRepository<Contact, Long> {

    List<Contact> findByOwnerIdOrderByIdDesc(Long ownerId);

    boolean existsByOwnerIdAndContactUserId(Long ownerId, Long contactUserId);

    /** Everyone who has this user in their contacts — the audience for a presence change. */
    @org.springframework.data.jpa.repository.Query(
            "SELECT c.ownerId FROM Contact c WHERE c.contactUserId = :userId")
    List<Long> findOwnerIdsByContactUserId(
            @org.springframework.data.repository.query.Param("userId") Long userId);

    Optional<Contact> findByIdAndOwnerId(Long id, Long ownerId);
}
