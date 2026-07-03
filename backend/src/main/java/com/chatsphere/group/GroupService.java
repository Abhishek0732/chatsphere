package com.chatsphere.group;

import com.chatsphere.chat.ChatService;
import com.chatsphere.chat.domain.Conversation;
import com.chatsphere.chat.domain.ConversationMember;
import com.chatsphere.chat.dto.ChatDtos.ConversationSummaryDto;
import com.chatsphere.chat.repo.ConversationMemberRepository;
import com.chatsphere.chat.repo.ConversationRepository;
import com.chatsphere.common.error.ApiException;
import com.chatsphere.group.dto.GroupDtos.*;
import com.chatsphere.user.User;
import com.chatsphere.user.UserRepository;
import com.chatsphere.user.dto.UserDto;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Service
public class GroupService {

    private final ConversationRepository conversationRepository;
    private final ConversationMemberRepository memberRepository;
    private final ChatService chatService;
    private final UserRepository userRepository;

    public GroupService(ConversationRepository conversationRepository,
                        ConversationMemberRepository memberRepository,
                        ChatService chatService,
                        UserRepository userRepository) {
        this.conversationRepository = conversationRepository;
        this.memberRepository = memberRepository;
        this.chatService = chatService;
        this.userRepository = userRepository;
    }

    @Transactional
    public ConversationSummaryDto create(Long creatorId, CreateGroupRequest req) {
        Conversation c = new Conversation();
        c.setType(Conversation.Type.GROUP);
        c.setName(req.name());
        c.setAvatarUrl(req.avatarUrl());
        c.setCreatedBy(creatorId);
        Conversation saved = conversationRepository.save(c);

        chatService.addMember(saved.getId(), creatorId, ConversationMember.Role.OWNER);
        Set<Long> ids = new LinkedHashSet<>(req.memberIds());
        ids.remove(creatorId);
        for (Long uid : ids) {
            if (userRepository.existsById(uid)) {
                chatService.addMember(saved.getId(), uid, ConversationMember.Role.MEMBER);
            }
        }
        return chatService.toSummary(saved, creatorId);
    }

    @Transactional(readOnly = true)
    public GroupDetailDto detail(Long viewerId, Long groupId) {
        Conversation c = getGroup(groupId);
        chatService.assertMember(groupId, viewerId);
        List<Long> memberIds = chatService.memberUserIds(groupId);
        List<UserDto> members = userRepository.findAllById(memberIds).stream()
                .map(UserDto::from).toList();
        return new GroupDetailDto(c.getId(), c.getName(), c.getAvatarUrl(), members, c.getCreatedBy());
    }

    @Transactional
    public GroupDetailDto update(Long userId, Long groupId, UpdateGroupRequest req) {
        Conversation c = getGroup(groupId);
        assertAdmin(groupId, userId);
        if (req.name() != null && !req.name().isBlank()) {
            c.setName(req.name());
        }
        if (req.avatarUrl() != null) {
            c.setAvatarUrl(req.avatarUrl());
        }
        conversationRepository.save(c);
        return detail(userId, groupId);
    }

    @Transactional
    public GroupDetailDto addMembers(Long userId, Long groupId, AddMembersRequest req) {
        getGroup(groupId);
        assertAdmin(groupId, userId);
        for (Long uid : req.userIds()) {
            if (userRepository.existsById(uid)) {
                chatService.addMember(groupId, uid, ConversationMember.Role.MEMBER);
            }
        }
        return detail(userId, groupId);
    }

    @Transactional
    public void removeMember(Long actorId, Long groupId, Long targetUserId) {
        getGroup(groupId);
        // members may remove themselves; admins/owners may remove anyone
        if (!actorId.equals(targetUserId)) {
            assertAdmin(groupId, actorId);
        }
        memberRepository.deleteByConversationIdAndUserId(groupId, targetUserId);
    }

    private Conversation getGroup(Long groupId) {
        Conversation c = conversationRepository.findById(groupId)
                .orElseThrow(() -> ApiException.notFound("Group not found"));
        if (c.getType() != Conversation.Type.GROUP) {
            throw ApiException.badRequest("Not a group conversation");
        }
        return c;
    }

    private void assertAdmin(Long groupId, Long userId) {
        ConversationMember m = memberRepository.findByConversationIdAndUserId(groupId, userId)
                .orElseThrow(() -> ApiException.forbidden("Not a member"));
        if (m.getRole() == ConversationMember.Role.MEMBER) {
            throw ApiException.forbidden("Requires group admin privileges");
        }
    }
}
