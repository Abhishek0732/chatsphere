-- Web Push subscriptions.
--
-- Until now a notification only ever reached a browser tab that was OPEN: the
-- `devices.push_token` column existed but NOTHING in the backend ever read it, so
-- a message (or a call) arriving while the app was closed was simply not
-- announced. This table is what the push actually goes to.
--
-- A Web Push subscription is not a token: it is an endpoint URL (at the browser
-- vendor's push service) plus the two keys the payload is encrypted with. The
-- endpoint is the identity — one row per browser/device per user.
CREATE TABLE push_subscriptions (
    id           BIGINT       NOT NULL AUTO_INCREMENT,
    user_id      BIGINT       NOT NULL,
    endpoint     VARCHAR(512) NOT NULL,
    p256dh       VARCHAR(255) NOT NULL,
    auth         VARCHAR(255) NOT NULL,
    created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP    NULL,
    PRIMARY KEY (id),
    -- The same endpoint must never be stored twice: re-subscribing (a new login on
    -- the same browser) updates the row rather than fanning out duplicates.
    UNIQUE KEY uq_push_endpoint (endpoint),
    KEY idx_push_user (user_id),
    CONSTRAINT fk_push_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4;
