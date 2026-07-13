-- Adding someone to a group who is NOT in your contacts no longer joins them
-- outright: it raises a pending invite that they must accept themselves.
CREATE TABLE group_invites (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    conversation_id BIGINT      NOT NULL,
    inviter_id      BIGINT      NOT NULL,
    invitee_id      BIGINT      NOT NULL,
    status          VARCHAR(10) NOT NULL DEFAULT 'PENDING',
    created_at      TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    responded_at    TIMESTAMP   NULL,
    -- One invite row per (group, invitee): re-inviting reuses/reopens it.
    CONSTRAINT uq_group_invite UNIQUE (conversation_id, invitee_id),
    CONSTRAINT fk_group_invite_conv FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE,
    CONSTRAINT fk_group_invite_inviter FOREIGN KEY (inviter_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_group_invite_invitee FOREIGN KEY (invitee_id) REFERENCES users (id) ON DELETE CASCADE,
    -- Hot path: "my pending group invites".
    KEY idx_group_invite_invitee (invitee_id, status)
) ENGINE = InnoDB;
