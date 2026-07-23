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
    private final ChatBroadcaster broadcaster;
    private final com.chatsphere.common.cache.HotPathCache cache;

    public ChatController(ChatService chatService,
                          ConversationRepository conversationRepository,
                          MessageRepository messageRepository,
                          ChatBroadcaster broadcaster,
                          com.chatsphere.common.cache.HotPathCache cache) {
        this.chatService = chatService;
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
        this.broadcaster = broadcaster;
        this.cache = cache;
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

    @GetMapping("/{id}/common-groups")
    public List<ConversationSummaryDto> commonGroups(@PathVariable Long id) {
        return chatService.commonGroups(SecurityUtils.currentUserId(), id);
    }

    /** Full transcript for a chat export (the client formats + downloads it). */
    @GetMapping("/{id}/export")
    public List<ExportMessageDto> export(@PathVariable Long id) {
        return chatService.exportChat(SecurityUtils.currentUserId(), id);
    }

    /** A page of shared media/docs/links for the info panel (kind + cursor `before`, newest first). */
    @GetMapping("/{id}/media")
    public List<MediaItemDto> media(@PathVariable Long id,
                                    @RequestParam(defaultValue = "media") String kind,
                                    @RequestParam(required = false) Long before,
                                    @RequestParam(defaultValue = "30") int limit) {
        return chatService.conversationMedia(SecurityUtils.currentUserId(), id, kind, before, limit);
    }

    /** Who has seen one of my messages ("Message info"). Sender-only. */
    @GetMapping("/{id}/messages/{messageId}/info")
    public MessageInfoDto messageInfo(@PathVariable Long id, @PathVariable Long messageId) {
        return chatService.messageInfo(SecurityUtils.currentUserId(), id, messageId);
    }

    /**
     * "Delete for me" a single message — hide it from the caller's view only. The
     * counterpart's copy is untouched, so there's nothing to broadcast (unlike the
     * sender-only "delete for everyone", which runs over STOMP as chat.delete).
     */
    @DeleteMapping("/{id}/messages/{messageId}")
    public ResponseEntity<Void> hideMessage(@PathVariable Long id, @PathVariable Long messageId) {
        chatService.hideMessageForUser(SecurityUtils.currentUserId(), messageId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}/messages")
    public ResponseEntity<Void> clear(@PathVariable Long id) {
        chatService.clearConversationForUser(SecurityUtils.currentUserId(), id);
        return ResponseEntity.noContent().build();
    }

    /**
     * Delete a whole conversation from the caller's chat list. forEveryone=true
     * also removes it from every other member's list (and pushes them a removal
     * event); the default (false) is "delete for me". No message rows are deleted
     * — see {@link ChatService#deleteConversationForUser}.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id,
                                       @RequestParam(name = "forEveryone", defaultValue = "false") boolean forEveryone) {
        Long me = SecurityUtils.currentUserId();
        // Snapshot members BEFORE the delete so we can still notify them.
        List<Long> members = forEveryone ? chatService.memberUserIds(id) : List.of();
        chatService.deleteConversationForUser(me, id, forEveryone);
        if (forEveryone) {
            broadcaster.sendConversationDeleted(new ConversationDeletedEvent(id), members);
        }
        return ResponseEntity.noContent().build();
    }

    /**
     * Set (or clear, with a null/0 ttl) the disappearing-messages timer for a
     * conversation. Any member may change it; everyone is told over STOMP.
     */
    @PostMapping("/{id}/disappearing")
    public ResponseEntity<Void> setDisappearing(@PathVariable Long id,
                                                @RequestBody DisappearingRequest req) {
        Long me = SecurityUtils.currentUserId();
        Integer ttl = chatService.setDisappearing(me, id, req.ttlSeconds());
        var brief = cache.brief(me);
        String name = brief != null ? brief.displayName() : "Someone";
        broadcaster.broadcastDisappearing(new DisappearingEvent(id, me, name, ttl));
        return ResponseEntity.noContent().build();
    }

    /**
     * The recipient opened a view-once message. Burns it: the stored media is deleted
     * and the URL nulled, and the (already-loaded) DTO is returned so the caller can
     * show the media one last time. Idempotent.
     */
    @PostMapping("/{id}/messages/{messageId}/view-once")
    public MessageDto viewOnce(@PathVariable Long id, @PathVariable Long messageId) {
        return chatService.markViewOnceSeen(SecurityUtils.currentUserId(), messageId);
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
