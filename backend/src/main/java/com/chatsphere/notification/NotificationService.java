package com.chatsphere.notification;

import com.chatsphere.chat.dto.ChatDtos.MessageDto;
import com.chatsphere.notification.dto.NotificationDto;
import com.chatsphere.presence.PresenceService;
import com.chatsphere.user.User;
import com.chatsphere.user.UserRepository;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Objects;

@Service
public class NotificationService {

    private final NotificationRepository repository;
    private final SimpMessagingTemplate messaging;
    private final PresenceService presenceService;
    private final UserRepository userRepository;

    public NotificationService(NotificationRepository repository,
                               SimpMessagingTemplate messaging,
                               PresenceService presenceService,
                               UserRepository userRepository) {
        this.repository = repository;
        this.messaging = messaging;
        this.presenceService = presenceService;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public List<NotificationDto> list(Long userId) {
        return repository.findTop50ByUserIdOrderByIdDesc(userId).stream()
                .map(NotificationDto::from).toList();
    }

    @Transactional
    public void markRead(Long userId, Long id) {
        repository.findById(id)
                .filter(n -> Objects.equals(n.getUserId(), userId))
                .ifPresent(n -> {
                    n.setRead(true);
                    repository.save(n);
                });
    }

    @Transactional
    public void markAllRead(Long userId) {
        repository.markAllReadForUser(userId);
    }

    /** Persist + push a notification to each recipient (all members except the sender). */
    @Transactional
    public void notifyNewMessage(MessageDto message, List<Long> memberIds, Long senderId) {
        String preview = switch (message.type()) {
            case "IMAGE" -> "📷 Photo";
            case "FILE" -> "📎 Attachment";
            default -> message.content() == null ? "" : message.content();
        };
        for (Long memberId : memberIds) {
            if (Objects.equals(memberId, senderId)) {
                continue;
            }
            Notification n = new Notification();
            n.setUserId(memberId);
            n.setType("MESSAGE");
            n.setTitle(message.senderName());
            n.setBody(preview.length() > 200 ? preview.substring(0, 200) : preview);
            n.setRefId(message.conversationId());
            Notification saved = repository.save(n);
            pushToUser(memberId, NotificationDto.from(saved));
        }
    }

    /** Persist + push a single generic notification (contact requests, etc.). */
    @Transactional
    public void notifyUser(Long userId, String type, String title, String body, Long refId) {
        Notification n = new Notification();
        n.setUserId(userId);
        n.setType(type);
        n.setTitle(title);
        n.setBody(body == null ? "" : (body.length() > 200 ? body.substring(0, 200) : body));
        n.setRefId(refId);
        Notification saved = repository.save(n);
        pushToUser(userId, NotificationDto.from(saved));
    }

    private void pushToUser(Long userId, NotificationDto dto) {
        User u = userRepository.findById(userId).orElse(null);
        if (u != null) {
            messaging.convertAndSendToUser(u.getUsername(), "/queue/notifications", dto);
        }
    }
}
