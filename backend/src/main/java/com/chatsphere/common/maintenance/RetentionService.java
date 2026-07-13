package com.chatsphere.common.maintenance;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;

/**
 * Nothing in this app ever deleted anything. Expired statuses, read notifications,
 * used password-reset tokens and revoked refresh tokens all accumulated forever —
 * so every table that backs a hot query kept getting slower, and storage grew
 * without bound.
 *
 * This sweeps them nightly in BOUNDED batches (a single unbounded DELETE over
 * millions of rows would hold locks for minutes and stall the app).
 *
 * With several backend instances this must only run on ONE of them, or they race
 * and repeat each other's work: a Redis lease decides who does tonight's sweep.
 */
@Component
public class RetentionService {

    private static final Logger log = LoggerFactory.getLogger(RetentionService.class);

    /** Rows per DELETE. Small enough that locks are never held long. */
    private static final int BATCH = 2_000;
    /** Stop after this many batches per table, so one run can't hog the DB. */
    private static final int MAX_BATCHES = 250;

    private final JdbcTemplate jdbc;
    private final StringRedisTemplate redis;
    private final int notificationDays;

    public RetentionService(JdbcTemplate jdbc,
                            StringRedisTemplate redis,
                            @Value("${chatsphere.retention.notification-days:30}") int notificationDays) {
        this.jdbc = jdbc;
        this.redis = redis;
        this.notificationDays = notificationDays;
    }

    /** 03:20 every night, one instance only. */
    @Scheduled(cron = "${chatsphere.retention.cron:0 20 3 * * *}")
    public void sweep() {
        if (!acquireLease()) {
            return; // another instance is doing it
        }
        long t0 = System.currentTimeMillis();

        // Statuses expire after 24h and are already filtered out of every read.
        // Their rows (and their views, via ON DELETE CASCADE) were kept forever.
        int statuses = deleteBatched(
                "DELETE FROM statuses WHERE expires_at < ? LIMIT " + BATCH,
                java.sql.Timestamp.from(Instant.now().minus(Duration.ofDays(1))));

        // Only the newest 50 notifications per user are ever shown; the rest are
        // write-only. One message to a 500-member group writes 499 of these rows.
        int notifications = deleteBatched(
                "DELETE FROM notifications WHERE created_at < ? LIMIT " + BATCH,
                java.sql.Timestamp.from(Instant.now().minus(Duration.ofDays(notificationDays))));

        int resetTokens = deleteBatched(
                "DELETE FROM password_reset_tokens WHERE expires_at < ? LIMIT " + BATCH,
                java.sql.Timestamp.from(Instant.now()));

        int refreshTokens = deleteBatched(
                "DELETE FROM refresh_tokens WHERE expires_at < ? LIMIT " + BATCH,
                java.sql.Timestamp.from(Instant.now()));

        log.info("retention sweep: statuses={} notifications={} resetTokens={} refreshTokens={} in {}ms",
                statuses, notifications, resetTokens, refreshTokens, System.currentTimeMillis() - t0);
    }

    /** Delete in bounded batches until a batch comes back short (or we hit the cap). */
    private int deleteBatched(String sql, Object arg) {
        int total = 0;
        for (int i = 0; i < MAX_BATCHES; i++) {
            int n;
            try {
                n = jdbc.update(sql, arg);
            } catch (Exception e) {
                log.warn("retention batch failed ({}): {}", sql, e.toString());
                break;
            }
            total += n;
            if (n < BATCH) break;
        }
        return total;
    }

    /**
     * One winner per night. SET NX EX — whoever sets the key first sweeps; the
     * lease outlives the job, so a crashed sweeper doesn't leave a lock behind
     * for longer than the window.
     */
    private boolean acquireLease() {
        try {
            Boolean ok = redis.opsForValue()
                    .setIfAbsent("chatsphere:retention:lease", "1", Duration.ofHours(2));
            return Boolean.TRUE.equals(ok);
        } catch (Exception e) {
            // Redis down: skip rather than risk every instance sweeping at once.
            log.warn("retention lease unavailable: {}", e.toString());
            return false;
        }
    }
}
