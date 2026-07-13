package com.chatsphere.notification;

import com.chatsphere.chat.dto.ChatDtos.MessageDto;
import com.chatsphere.notification.dto.NotificationDto;
import com.chatsphere.presence.PresenceService;
import com.chatsphere.user.User;
import com.chatsphere.user.UserRepository;
import com.chatsphere.common.realtime.StompRelay;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
public class NotificationService {

    private final NotificationRepository repository;
    private final StompRelay relay;
    private final PresenceService presenceService;
    private final UserRepository userRepository;

    public NotificationService(NotificationRepository repository,
                               StompRelay relay,
                               PresenceService presenceService,
                               UserRepository userRepository) {
        this.repository = repository;
        this.relay = relay;
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

    /**
     * Persist + push a notification to every recipient of a message.
     *
     * This used to run one INSERT, one SELECT (to look up the recipient's
     * username) and one WebSocket push PER RECIPIENT, inside the transaction and
     * on the WebSocket thread — so one message to a 500-member group cost ~1,000
     * round trips serially before the sender's own echo was released, while
     * holding a connection from a 20-connection pool.
     *
     * Now: one batched user lookup, one batched INSERT, and the pushes happen
     * after the rows are written. {@code @Async} takes the whole thing off the
     * WebSocket thread, so send latency no longer scales with group size.
     */
    @Async
    @Transactional
    public void notifyNewMessage(MessageDto message, List<Long> memberIds, Long senderId) {
        String preview = switch (message.type()) {
            case "IMAGE" -> "📷 Photo";
            case "FILE" -> "📎 Attachment";
            default -> message.content() == null ? "" : message.content();
        };
        List<Long> mentions = message.mentions() == null ? List.of() : message.mentions();

        List<Long> recipients = memberIds.stream()
                .filter(id -> !Objects.equals(id, senderId))
                .toList();
        if (recipients.isEmpty()) return;

        // One query for every recipient, instead of one findById each.
        Map<Long, User> users = userRepository.findAllById(recipients).stream()
                .collect(Collectors.toMap(User::getId, u -> u));

        List<Notification> batch = new ArrayList<>(recipients.size());
        for (Long memberId : recipients) {
            if (!users.containsKey(memberId)) continue;
            // Being @mentioned is called out in the notification itself, so it
            // reads differently from an ordinary group message.
            String body = mentions.contains(memberId) ? "@ mentioned you: " + preview : preview;
            Notification n = new Notification();
            n.setUserId(memberId);
            n.setType("MESSAGE");
            n.setTitle(message.senderName());
            n.setBody(body.length() > 200 ? body.substring(0, 200) : body);
            n.setRefId(message.conversationId());
            batch.add(n);
        }

        // One batched INSERT (hibernate.jdbc.batch_size is already configured).
        for (Notification saved : repository.saveAll(batch)) {
            User u = users.get(saved.getUserId());
            if (u != null) {
                relay.toUser(u.getUsername(), "/queue/notifications", NotificationDto.from(saved));
            }
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
            relay.toUser(u.getUsername(), "/queue/notifications", dto);
        }
    }
}
