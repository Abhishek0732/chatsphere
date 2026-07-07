-- WhatsApp-style status privacy. Each user has one setting deciding who may see
-- their statuses: ALL contacts (default), ALL EXCEPT a chosen list, or ONLY a
-- chosen list. The chosen users live in status_privacy_users.
CREATE TABLE status_privacy (
    user_id BIGINT      NOT NULL PRIMARY KEY,
    mode    VARCHAR(10) NOT NULL DEFAULT 'ALL',   -- ALL, EXCEPT, ONLY
    CONSTRAINT fk_status_privacy_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE status_privacy_users (
    id             BIGINT AUTO_INCREMENT PRIMARY KEY,
    owner_id       BIGINT NOT NULL,
    target_user_id BIGINT NOT NULL,
    CONSTRAINT uq_status_privacy_user UNIQUE (owner_id, target_user_id),
    CONSTRAINT fk_spu_owner  FOREIGN KEY (owner_id)       REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_spu_target FOREIGN KEY (target_user_id) REFERENCES users (id) ON DELETE CASCADE,
    INDEX idx_spu_owner (owner_id)
);
