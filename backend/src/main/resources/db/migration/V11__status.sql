-- WhatsApp-style status / stories: 24h-expiring photo/video/text posts with
-- optional background music, plus per-viewer seen tracking.
CREATE TABLE statuses (
    id         BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id    BIGINT       NOT NULL,
    type       VARCHAR(10)  NOT NULL,          -- IMAGE, VIDEO, TEXT
    media_url  VARCHAR(512) NULL,
    caption    VARCHAR(700) NULL,
    bg_color   VARCHAR(40)  NULL,              -- for TEXT statuses
    music_url  VARCHAR(512) NULL,
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME     NOT NULL,
    CONSTRAINT fk_statuses_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    INDEX idx_status_user (user_id),
    INDEX idx_status_expires (expires_at)
);

CREATE TABLE status_views (
    id        BIGINT AUTO_INCREMENT PRIMARY KEY,
    status_id BIGINT   NOT NULL,
    viewer_id BIGINT   NOT NULL,
    viewed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_status_view UNIQUE (status_id, viewer_id),
    CONSTRAINT fk_sv_status FOREIGN KEY (status_id) REFERENCES statuses (id) ON DELETE CASCADE,
    CONSTRAINT fk_sv_viewer FOREIGN KEY (viewer_id) REFERENCES users (id)   ON DELETE CASCADE,
    INDEX idx_sv_status (status_id)
);
