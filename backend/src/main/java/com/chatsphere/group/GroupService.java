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
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

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
        List<ConversationMember> mems = memberRepository.findByConversationId(groupId);
        Map<Long, User> userById = userRepository
                .findAllById(mems.stream().map(ConversationMember::getUserId).toList())
                .stream().collect(Collectors.toMap(User::getId, u -> u));
        List<GroupMemberDto> members = mems.stream()
                .filter(m -> userById.containsKey(m.getUserId()))
                .map(m -> new GroupMemberDto(UserDto.from(userById.get(m.getUserId())), m.getRole().name()))
                .toList();
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
            // Empty string clears the group picture; null leaves it unchanged.
            c.setAvatarUrl(req.avatarUrl().isBlank() ? null : req.avatarUrl());
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
    public GroupDetailDto setMemberRole(Long actorId, Long groupId, Long targetUserId, String roleStr) {
        getGroup(groupId);
        assertAdmin(groupId, actorId);

        ConversationMember target = memberRepository.findByConversationIdAndUserId(groupId, targetUserId)
                .orElseThrow(() -> ApiException.notFound("Member not found"));
        if (target.getRole() == ConversationMember.Role.OWNER) {
            throw ApiException.badRequest("The group owner's role cannot be changed");
        }

        ConversationMember.Role role;
        try {
            role = ConversationMember.Role.valueOf(roleStr);
        } catch (IllegalArgumentException e) {
            throw ApiException.badRequest("Invalid role: " + roleStr);
        }
        if (role == ConversationMember.Role.OWNER) {
            throw ApiException.badRequest("Cannot assign the OWNER role");
        }

        target.setRole(role);
        memberRepository.save(target);
        return detail(actorId, groupId);
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
