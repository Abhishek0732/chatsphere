-- User reports (abuse / spam / harassment). A report never blocks on its own —
-- it is a moderation signal. Blocking stays a separate, immediate action.
CREATE TABLE reports (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    reporter_id BIGINT       NOT NULL,
    reported_id BIGINT       NOT NULL,
    reason      VARCHAR(80)  NOT NULL,
    details     VARCHAR(1000),
    -- The message that prompted the report, if any. No FK: a reported message may
    -- later be hard-deleted (disappearing sweep) and the report should survive.
    message_id  BIGINT,
    created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_report_reporter FOREIGN KEY (reporter_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_report_reported FOREIGN KEY (reported_id) REFERENCES users (id) ON DELETE CASCADE,
    INDEX idx_report_reported (reported_id),
    -- Supports the per-reporter/target de-dupe window without a full scan.
    INDEX idx_report_reporter_target (reporter_id, reported_id, created_at)
);
