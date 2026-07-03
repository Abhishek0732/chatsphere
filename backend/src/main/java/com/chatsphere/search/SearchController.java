package com.chatsphere.search;

import com.chatsphere.chat.ChatService;
import com.chatsphere.chat.domain.Message;
import com.chatsphere.chat.dto.ChatDtos.MessageDto;
import com.chatsphere.chat.repo.MessageRepository;
import com.chatsphere.common.security.SecurityUtils;
import com.chatsphere.presence.PresenceService;
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

    public SearchController(MessageRepository messageRepository,
                            ChatService chatService,
                            UserService userService,
                            PresenceService presenceService) {
        this.messageRepository = messageRepository;
        this.chatService = chatService;
        this.userService = userService;
        this.presenceService = presenceService;
    }

    @GetMapping("/messages")
    public List<MessageDto> messages(@RequestParam String q) {
        Long me = SecurityUtils.currentUserId();
        if (q == null || q.isBlank()) {
            return List.of();
        }
        List<Message> found = messageRepository.searchInUserConversations(
                q.trim(), me, PageRequest.of(0, 50));
        return found.stream().map(m -> chatService.toMessageDto(m, null)).toList();
    }

    @GetMapping("/users")
    public List<UserDto> users(@RequestParam String q) {
        Long me = SecurityUtils.currentUserId();
        return userService.search(q, me).stream()
                .map(u -> UserDto.from(u, presenceService.isOnline(u.getId()),
                        presenceService.lastSeen(u.getId())))
                .toList();
    }
}
