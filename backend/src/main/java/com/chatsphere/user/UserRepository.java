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
     * Directory search, using the FULLTEXT index on (username, display_name,
     * email). The old JPQL used LIKE '%q%', whose leading wildcard no index can
     * serve: every search scanned all 100k+ users.
     *
     * Deliberately NOT sorted by name: ordering forces MySQL to materialise and
     * sort every match before applying the LIMIT, so a common term (e.g. a shared
     * surname) would sort tens of thousands of rows. Relevance order lets it stop
     * as soon as it has enough.
     */
    @Query(value = """
            SELECT /*+ MAX_EXECUTION_TIME(2000) */ u.* FROM users u
            WHERE u.id <> :excludeId
              AND MATCH(u.username, u.display_name, u.email) AGAINST (:q IN BOOLEAN MODE)
            LIMIT :limit
            """, nativeQuery = true)
    List<User> searchFulltext(@Param("q") String q, @Param("excludeId") Long excludeId,
                             @Param("limit") int limit);

    /**
     * Fallback for very short queries: InnoDB's FULLTEXT ignores tokens shorter
     * than innodb_ft_min_token_size (3 by default), so "jo" would find nothing.
     * Bounded by the LIMIT, which is what made the old version dangerous.
     */
    @Query(value = """
            SELECT u.* FROM users u
            WHERE u.id <> :excludeId
              AND (u.username LIKE CONCAT(:q, '%')
                   OR u.display_name LIKE CONCAT(:q, '%'))
            LIMIT :limit
            """, nativeQuery = true)
    List<User> searchPrefix(@Param("q") String q, @Param("excludeId") Long excludeId,
                            @Param("limit") int limit);
}
