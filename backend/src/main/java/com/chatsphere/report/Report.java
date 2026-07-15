package com.chatsphere.report;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

/**
 * One abuse report: {@code reporterId} says {@code reportedId} did something wrong.
 *
 * A report is only a signal — it does not block, hide, or restrict anyone by
 * itself (blocking is a separate, immediate action the reporter can also take).
 * Rows accumulate for a human/automated moderation review.
 */
@Entity
@Table(name = "reports")
@Getter
@Setter
public class Report {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "reporter_id", nullable = false)
    private Long reporterId;

    @Column(name = "reported_id", nullable = false)
    private Long reportedId;

    /** A short category, e.g. "spam", "harassment", "nudity", "other". */
    @Column(nullable = false, length = 80)
    private String reason;

    /** Optional free-text context the reporter added. */
    @Column(length = 1000)
    private String details;

    /** The message that prompted the report, if the report was raised from one. */
    @Column(name = "message_id")
    private Long messageId;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;
}
