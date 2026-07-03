package com.chatsphere.presence;

import org.springframework.data.jpa.repository.JpaRepository;

public interface UserPresenceRepository extends JpaRepository<UserPresence, Long> {
}
