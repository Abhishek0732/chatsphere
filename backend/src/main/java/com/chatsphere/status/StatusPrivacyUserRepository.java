package com.chatsphere.status;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface StatusPrivacyUserRepository extends JpaRepository<StatusPrivacyUser, Long> {

    List<StatusPrivacyUser> findByOwnerId(Long ownerId);

    List<StatusPrivacyUser> findByOwnerIdIn(Collection<Long> ownerIds);

    void deleteByOwnerId(Long ownerId);
}
