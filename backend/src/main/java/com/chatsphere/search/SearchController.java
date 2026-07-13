package com.chatsphere.search;

import com.chatsphere.chat.ChatService;
import com.chatsphere.chat.domain.Message;
import com.chatsphere.chat.dto.ChatDtos.MessageDto;
import com.chatsphere.chat.repo.MessageRepository;
import com.chatsphere.common.security.SecurityUtils;
import com.chatsphere.presence.PresenceService;
import com.chatsphere.user.UserRepository;
import com.chatsphere.user.UserService;
import com.chatsphere.user.dto.UserDto;
import org.springframework.data.domain.PageRequest;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/search")
public class SearchController {

    private final MessageRepository messageRepository;
    private final ChatService chatService;
    private final UserService userService;
    private final PresenceService presenceService;
    private final UserRepository userRepository;

    public SearchController(MessageRepository messageRepository,
                            ChatService chatService,
                            UserService userService,
                            PresenceService presenceService,
                            UserRepository userRepository) {
        this.messageRepository = messageRepository;
        this.chatService = chatService;
        this.userService = userService;
        this.presenceService = presenceService;
        this.userRepository = userRepository;
    }

    @GetMapping("/messages")
    public List<MessageDto> messages(@RequestParam String q) {
        Long me = SecurityUtils.currentUserId();
        if (q == null || q.isBlank()) {
            return List.of();
        }
        // Prefix-match each term so "lore" still finds "lorem" (BOOLEAN MODE).
        String terms = java.util.Arrays.stream(q.trim().split("\\s+"))
                .filter(t -> !t.isBlank())
                .map(t -> t.replaceAll("[+\\-><()~*\"@]", "") + "*")
                .filter(t -> t.length() > 1)
                .collect(java.util.stream.Collectors.joining(" "));
        if (terms.isBlank()) {
            return List.of();
        }
        List<Message> found;
        try {
            found = messageRepository.searchInUserConversations(terms, me, 50);
        } catch (org.springframework.dao.DataAccessException e) {
            // The query carries a 3s server-side cap. A term so common that it
            // matches most of the corpus trips it — return nothing rather than
            // hold a database connection hostage for every other user.
            return List.of();
        }
        if (found.isEmpty()) {
            return List.of();
        }
        // assembleBatch loads senders, reactions and reply previews for the whole
        // page in a fixed number of queries. Mapping row-by-row with toMessageDto
        // cost ~4 queries PER RESULT (~200 for a page of 50).
        java.util.Set<Long> senderIds = found.stream()
                .map(Message::getSenderId).collect(java.util.stream.Collectors.toSet());
        java.util.Map<Long, com.chatsphere.user.User> senders =
                userRepository.findAllById(senderIds).stream()
                        .collect(java.util.stream.Collectors.toMap(
                                com.chatsphere.user.User::getId, u -> u));
        return chatService.assembleBatch(found, senders, m -> "SENT");
    }

    @GetMapping("/users")
    public List<UserDto> users(@RequestParam String q) {
        Long me = SecurityUtils.currentUserId();
        List<com.chatsphere.user.User> found = userService.search(q, me);
        if (found.isEmpty()) {
            return List.of();
        }
        // Batched presence: one Redis MGET + one query for the whole page, instead
        // of isOnline() + lastSeen() per result row.
        List<Long> ids = found.stream().map(com.chatsphere.user.User::getId).toList();
        java.util.Set<Long> online = presenceService.onlineAmong(ids);
        java.util.Map<Long, java.time.Instant> lastSeen = presenceService.lastSeenAmong(ids);
        return found.stream()
                .map(u -> UserDto.from(u, online.contains(u.getId()), lastSeen.get(u.getId())))
                .toList();
    }
}
