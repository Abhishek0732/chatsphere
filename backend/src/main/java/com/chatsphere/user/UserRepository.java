package com.chatsphere.user;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByUsername(String username);

    Optional<User> findByEmail(String email);

    boolean existsByUsername(String username);

    boolean existsByEmail(String email);

    Optional<User> findByUsernameOrEmail(String username, String email);

    Optional<User> findByQrToken(String qrToken);

    Optional<User> findByInviteCode(String inviteCode);

    boolean existsByInviteCode(String inviteCode);

    /**
     * Directory search. MUST be called with a Pageable — without a limit this
     * returned every matching row (a one-letter query on a 100k-user table
     * returned essentially the whole table, sorted with a filesort).
     */
    @Query("""
            SELECT u FROM User u
            WHERE u.id <> :excludeId
              AND (LOWER(u.username) LIKE LOWER(CONCAT('%', :q, '%'))
                   OR LOWER(u.displayName) LIKE LOWER(CONCAT('%', :q, '%'))
                   OR LOWER(u.email) LIKE LOWER(CONCAT('%', :q, '%')))
            ORDER BY u.displayName ASC
            """)
    List<User> search(@Param("q") String q, @Param("excludeId") Long excludeId, Pageable pageable);
}
