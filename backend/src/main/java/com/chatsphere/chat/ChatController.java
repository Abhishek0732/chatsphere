package com.chatsphere.chat;

import com.chatsphere.chat.domain.Conversation;
import com.chatsphere.chat.dto.ChatDtos.*;
import com.chatsphere.chat.repo.ConversationRepository;
import com.chatsphere.chat.repo.MessageRepository;
import com.chatsphere.common.error.ApiException;
import com.chatsphere.common.security.SecurityUtils;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/conversations")
public class ChatController {

    private final ChatService chatService;
    private final ConversationRepository conversationRepository;
    private final MessageRepository messageRepository;

    public ChatController(ChatService chatService,
                          ConversationRepository conversationRepository,
                          MessageRepository messageRepository) {
        this.chatService = chatService;
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
    }

    @GetMapping
    public List<ConversationSummaryDto> list() {
        return chatService.listConversations(SecurityUtils.currentUserId());
    }

    @PostMapping("/direct")
    public ConversationSummaryDto createDirect(@Valid @RequestBody CreateDirectRequest req) {
        Long me = SecurityUtils.currentUserId();
        Conversation c = chatService.getOrCreateDirect(me, req.targetUserId());
        return chatService.toSummary(c, me);
    }

    @GetMapping("/{id}/messages")
    public List<MessageDto> messages(@PathVariable Long id,
                                     @RequestParam(required = false) Long before,
                                     @RequestParam(defaultValue = "30") int limit) {
        return chatService.getMessages(SecurityUtils.currentUserId(), id, before, limit);
    }

    @DeleteMapping("/{id}/messages")
    public ResponseEntity<Void> clear(@PathVariable Long id) {
        chatService.clearConversationForUser(SecurityUtils.currentUserId(), id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/read")
    public ResponseEntity<Void> read(@PathVariable Long id) {
        Long me = SecurityUtils.currentUserId();
        chatService.assertMember(id, me);
        var last = messageRepository.findTopByConversationIdAndDeletedFalseOrderByIdDesc(id);
        if (last != null) {
            chatService.markRead(me, id, last.getId());
        }
        return ResponseEntity.noContent().build();
    }
}
