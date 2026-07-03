package com.chatsphere.notification.dto;

import com.chatsphere.notification.Notification;

import java.time.Instant;

public record NotificationDto(Long id, String type, String title, String body,
                              Long refId, boolean read, Instant createdAt) {

    public static NotificationDto from(Notification n) {
        return new NotificationDto(n.getId(), n.getType(), n.getTitle(), n.getBody(),
                n.getRefId(), n.isRead(), n.getCreatedAt());
    }
}
