-- Voice/video call signaling: call sessions + registered devices.
--
-- Media (audio) never touches this schema. These tables are the signaling
-- source of truth: call state, call history, and missed-call counts. Presence
-- and busy-locks stay ephemeral in Redis; only the durable facts live here.

CREATE TABLE calls (
    id               BIGINT AUTO_INCREMENT PRIMARY KEY,
    call_uid         VARCHAR(36)  NOT NULL,                     -- opaque id exposed to clients
    caller_id        BIGINT       NOT NULL,
    callee_id        BIGINT       NOT NULL,
    type             VARCHAR(10)  NOT NULL DEFAULT 'VOICE',     -- VOICE, VIDEO
    status           VARCHAR(20)  NOT NULL,                     -- RINGING, ACTIVE, ENDED, DECLINED, MISSED, CANCELLED, FAILED
    end_reason       VARCHAR(20)  NULL,                         -- HANGUP, DECLINED, MISSED, CANCELLED, BUSY, FAILED
    conversation_id  BIGINT       NULL,
    created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    answered_at      DATETIME     NULL,
    ended_at         DATETIME     NULL,
    duration_seconds INT          NULL,
    CONSTRAINT uq_calls_uid UNIQUE (call_uid),
    CONSTRAINT fk_calls_caller FOREIGN KEY (caller_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_calls_callee FOREIGN KEY (callee_id) REFERENCES users (id) ON DELETE CASCADE,
    -- Call log + missed badge both read by counterpart, newest first.
    INDEX idx_calls_callee_created (callee_id, created_at),
    INDEX idx_calls_caller_created (caller_id, created_at),
    -- Busy check + ring-timeout sweeper filter by status.
    INDEX idx_calls_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE devices (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id     BIGINT       NOT NULL,
    device_uid  VARCHAR(64)  NOT NULL,                          -- client-generated stable id
    platform    VARCHAR(20)  NOT NULL DEFAULT 'WEB',            -- WEB, ANDROID, IOS
    push_token  VARCHAR(512) NULL,                              -- FCM/APNs token (Phase 4)
    last_seen   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_devices_uid UNIQUE (device_uid),
    CONSTRAINT fk_devices_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    INDEX idx_devices_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
