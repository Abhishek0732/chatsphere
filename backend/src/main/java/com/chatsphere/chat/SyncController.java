package com.chatsphere.chat;

import com.chatsphere.chat.dto.ChatDtos.MessageDto;
import com.chatsphere.common.security.SecurityUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Reconnect catch-up. Live delivery only reaches CONNECTED members, so anything
 * that arrived while a client was offline is in the database but never pushed.
 * On (re)connect the client calls this with the highest message id it already
 * holds; it gets everything newer, in order, in one indexed ascending scan.
 */
@RestController
@RequestMapping("/api/sync")
public class SyncController {

    private final ChatService chatService;

    public SyncController(ChatService chatService) {
        this.chatService = chatService;
    }

    @GetMapping
    public List<MessageDto> since(@RequestParam(defaultValue = "0") long since,
                                  @RequestParam(defaultValue = "500") int limit) {
        return chatService.syncSince(SecurityUtils.currentUserId(), since, limit);
    }
}
