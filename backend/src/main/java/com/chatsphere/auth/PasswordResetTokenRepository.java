package com.chatsphere.auth;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, Long> {

    Optional<PasswordResetToken> findByTokenHash(String tokenHash);

    /** Invalidate any outstanding reset tokens for a user (e.g. before issuing a new one). */
    @Modifying
    @Query("UPDATE PasswordResetToken t SET t.usedAt = CURRENT_TIMESTAMP "
            + "WHERE t.userId = :userId AND t.usedAt IS NULL")
    void invalidateAllForUser(@Param("userId") Long userId);
}
