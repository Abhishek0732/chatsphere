package com.chatsphere.group;

import com.chatsphere.chat.dto.ChatDtos.ConversationSummaryDto;
import com.chatsphere.common.security.SecurityUtils;
import com.chatsphere.group.dto.GroupDtos.*;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/groups")
public class GroupController {

    private final GroupService groupService;

    public GroupController(GroupService groupService) {
        this.groupService = groupService;
    }

    @PostMapping
    public ConversationSummaryDto create(@Valid @RequestBody CreateGroupRequest req) {
        return groupService.create(SecurityUtils.currentUserId(), req);
    }

    @GetMapping("/{id}")
    public GroupDetailDto detail(@PathVariable Long id) {
        return groupService.detail(SecurityUtils.currentUserId(), id);
    }

    @PutMapping("/{id}")
    public GroupDetailDto update(@PathVariable Long id, @Valid @RequestBody UpdateGroupRequest req) {
        return groupService.update(SecurityUtils.currentUserId(), id, req);
    }

    @PostMapping("/{id}/members")
    public GroupDetailDto addMembers(@PathVariable Long id, @Valid @RequestBody AddMembersRequest req) {
        return groupService.addMembers(SecurityUtils.currentUserId(), id, req);
    }

    @DeleteMapping("/{id}/members/{userId}")
    public ResponseEntity<Void> removeMember(@PathVariable Long id, @PathVariable Long userId) {
        groupService.removeMember(SecurityUtils.currentUserId(), id, userId);
        return ResponseEntity.noContent().build();
    }
}
