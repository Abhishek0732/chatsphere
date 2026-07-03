-- ChatSphere initial schema

CREATE TABLE users (
    id             BIGINT AUTO_INCREMENT PRIMARY KEY,
    username       VARCHAR(50)  NOT NULL,
    email          VARCHAR(255) NOT NULL,
    password_hash  VARCHAR(255) NOT NULL,
    display_name   VARCHAR(100) NOT NULL,
    about          VARCHAR(255) NULL,
    avatar_url     VARCHAR(512) NULL,
    role           VARCHAR(20)  NOT NULL DEFAULT 'USER',
    created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_users_username UNIQUE (username),
    CONSTRAINT uq_users_email    UNIQUE (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE refresh_tokens (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id     BIGINT       NOT NULL,
    token       VARCHAR(512) NOT NULL,
    expires_at  DATETIME     NOT NULL,
    revoked     BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_refresh_token UNIQUE (token),
    CONSTRAINT fk_refresh_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    INDEX idx_refresh_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE contacts (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    owner_id        BIGINT   NOT NULL,
    contact_user_id BIGINT   NOT NULL,
    alias           VARCHAR(100) NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_contact UNIQUE (owner_id, contact_user_id),
    CONSTRAINT fk_contact_owner FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_contact_user  FOREIGN KEY (contact_user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE conversations (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    type        VARCHAR(10)  NOT NULL,          -- DIRECT | GROUP
    name        VARCHAR(150) NULL,              -- group name
    avatar_url  VARCHAR(512) NULL,
    -- deterministic key for a DIRECT pair ("min-max"); NULL for groups
    direct_key  VARCHAR(64)  NULL,
    created_by  BIGINT       NULL,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_direct_key UNIQUE (direct_key),
    CONSTRAINT fk_conv_creator FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE conversation_members (
    id               BIGINT AUTO_INCREMENT PRIMARY KEY,
    conversation_id  BIGINT   NOT NULL,
    user_id          BIGINT   NOT NULL,
    role             VARCHAR(20) NOT NULL DEFAULT 'MEMBER', -- OWNER | ADMIN | MEMBER
    last_read_message_id BIGINT NULL,
    joined_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_conv_member UNIQUE (conversation_id, user_id),
    CONSTRAINT fk_member_conv FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE,
    CONSTRAINT fk_member_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    INDEX idx_member_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE messages (
    id               BIGINT AUTO_INCREMENT PRIMARY KEY,
    conversation_id  BIGINT       NOT NULL,
    sender_id        BIGINT       NOT NULL,
    content          TEXT         NULL,
    type             VARCHAR(10)  NOT NULL DEFAULT 'TEXT', -- TEXT | IMAGE | FILE
    attachment_url   VARCHAR(512) NULL,
    created_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    deleted          BOOLEAN      NOT NULL DEFAULT FALSE,
    CONSTRAINT fk_msg_conv   FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE,
    CONSTRAINT fk_msg_sender FOREIGN KEY (sender_id) REFERENCES users (id) ON DELETE CASCADE,
    INDEX idx_msg_conv_created (conversation_id, created_at),
    FULLTEXT INDEX ft_msg_content (content)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE message_status (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    message_id  BIGINT      NOT NULL,
    user_id     BIGINT      NOT NULL,
    status      VARCHAR(10) NOT NULL DEFAULT 'SENT', -- SENT | DELIVERED | READ
    updated_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_msg_status UNIQUE (message_id, user_id),
    CONSTRAINT fk_status_msg  FOREIGN KEY (message_id) REFERENCES messages (id) ON DELETE CASCADE,
    CONSTRAINT fk_status_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE attachments (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    message_id    BIGINT       NULL,
    uploader_id   BIGINT       NOT NULL,
    object_key    VARCHAR(512) NOT NULL,
    url           VARCHAR(512) NOT NULL,
    file_name     VARCHAR(255) NOT NULL,
    content_type  VARCHAR(100) NOT NULL,
    size_bytes    BIGINT       NOT NULL,
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_att_msg      FOREIGN KEY (message_id) REFERENCES messages (id) ON DELETE CASCADE,
    CONSTRAINT fk_att_uploader FOREIGN KEY (uploader_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE notifications (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id     BIGINT       NOT NULL,
    type        VARCHAR(40)  NOT NULL,   -- MESSAGE | GROUP_INVITE | CONTACT_ADDED | SYSTEM
    title       VARCHAR(150) NOT NULL,
    body        VARCHAR(500) NULL,
    ref_id      BIGINT       NULL,       -- e.g. conversation id
    is_read     BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    INDEX idx_notif_user (user_id, is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE user_presence (
    user_id     BIGINT      PRIMARY KEY,
    online      BOOLEAN     NOT NULL DEFAULT FALSE,
    last_seen   DATETIME    NULL,
    updated_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_presence_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
