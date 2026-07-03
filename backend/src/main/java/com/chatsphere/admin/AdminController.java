package com.chatsphere.admin;

import com.chatsphere.chat.repo.ConversationRepository;
import com.chatsphere.chat.repo.MessageRepository;
import com.chatsphere.user.UserRepository;
import com.chatsphere.user.dto.UserDto;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/** Admin-only endpoints (guarded by ROLE_ADMIN in SecurityConfig). */
@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final UserRepository userRepository;
    private final ConversationRepository conversationRepository;
    private final MessageRepository messageRepository;

    public AdminController(UserRepository userRepository,
                           ConversationRepository conversationRepository,
                           MessageRepository messageRepository) {
        this.userRepository = userRepository;
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
    }

    @GetMapping("/stats")
    public Map<String, Long> stats() {
        return Map.of(
                "users", userRepository.count(),
                "conversations", conversationRepository.count(),
                "messages", messageRepository.count());
    }

    @GetMapping("/users")
    public List<UserDto> users() {
        return userRepository.findAll().stream().map(UserDto::from).toList();
    }
}
