package com.chatsphere.group;

import com.chatsphere.chat.ChatService;
import com.chatsphere.chat.domain.Conversation;
import com.chatsphere.chat.domain.ConversationMember;
import com.chatsphere.chat.dto.ChatDtos.ConversationSummaryDto;
import com.chatsphere.chat.repo.ConversationMemberRepository;
import com.chatsphere.chat.repo.ConversationRepository;
import com.chatsphere.common.error.ApiException;
import com.chatsphere.contact.ContactRepository;
import com.chatsphere.group.dto.GroupDtos.*;
import com.chatsphere.notification.NotificationService;
import com.chatsphere.user.User;
import com.chatsphere.user.UserRepository;
import com.chatsphere.user.dto.UserDto;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class GroupService {

    private final ConversationRepository conversationRepository;
    private final ConversationMemberRepository memberRepository;
    private final ChatService chatService;
    private final UserRepository userRepository;
    private final ContactRepository contactRepository;
    private final GroupInviteRepository inviteRepository;
    private final NotificationService notificationService;

    public GroupService(ConversationRepository conversationRepository,
                        ConversationMemberRepository memberRepository,
                        ChatService chatService,
                        UserRepository userRepository,
                        ContactRepository contactRepository,
                        GroupInviteRepository inviteRepository,
                        NotificationService notificationService) {
        this.conversationRepository = conversationRepository;
        this.memberRepository = memberRepository;
        this.chatService = chatService;
        this.userRepository = userRepository;
        this.contactRepository = contactRepository;
        this.inviteRepository = inviteRepository;
        this.notificationService = notificationService;
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
        // Same rule as adding later: contacts join now, strangers are invited.
        admitOrInvite(saved, creatorId, ids);
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
    public AddMembersResult addMembers(Long userId, Long groupId, AddMembersRequest req) {
        Conversation group = getGroup(groupId);
        assertAdmin(groupId, userId);
        Set<Long> ids = new LinkedHashSet<>(req.userIds());
        ids.remove(userId);
        Admitted result = admitOrInvite(group, userId, ids);
        return new AddMembersResult(detail(userId, groupId), result.added(), result.invited());
    }

    /** Who joined immediately vs who was only invited. */
    private record Admitted(List<UserDto> added, List<UserDto> invited) {}

    /**
     * The core rule: someone already in the actor's contacts is added to the group
     * straight away, because they have an existing relationship. Anyone else is
     * only INVITED — they join when they accept, so a stranger can't drop you into
     * a group (and read/write there) without your consent.
     */
    private Admitted admitOrInvite(Conversation group, Long actorId, Set<Long> userIds) {
        List<UserDto> added = new ArrayList<>();
        List<UserDto> invited = new ArrayList<>();
        if (userIds.isEmpty()) return new Admitted(added, invited);

        String actorName = userRepository.findById(actorId)
                .map(User::getDisplayName).orElse("Someone");
        Map<Long, User> users = userRepository.findAllById(userIds).stream()
                .collect(Collectors.toMap(User::getId, u -> u));

        for (Long uid : userIds) {
            User u = users.get(uid);
            if (u == null || Objects.equals(uid, actorId)) continue;
            if (memberRepository.findByConversationIdAndUserId(group.getId(), uid).isPresent()) {
                continue; // already in the group
            }
            if (contactRepository.existsByOwnerIdAndContactUserId(actorId, uid)) {
                chatService.addMember(group.getId(), uid, ConversationMember.Role.MEMBER);
                notificationService.notifyUser(uid, "GROUP", group.getName(),
                        actorName + " added you to the group", group.getId());
                added.add(UserDto.from(u));
            } else {
                invite(group, actorId, actorName, u);
                invited.add(UserDto.from(u));
            }
        }
        return new Admitted(added, invited);
    }

    /** Raise (or re-open) a pending invite and tell the invitee about it. */
    private void invite(Conversation group, Long inviterId, String inviterName, User invitee) {
        GroupInvite inv = inviteRepository
                .findByConversationIdAndInviteeId(group.getId(), invitee.getId())
                .orElseGet(GroupInvite::new);
        if (inv.getId() != null && inv.getStatus() == GroupInvite.Status.PENDING) {
            return; // already waiting on them; don't spam another notification
        }
        inv.setConversationId(group.getId());
        inv.setInviterId(inviterId);
        inv.setInviteeId(invitee.getId());
        inv.setStatus(GroupInvite.Status.PENDING);
        inv.setRespondedAt(null);
        inviteRepository.save(inv);
        notificationService.notifyUser(invitee.getId(), "GROUP_INVITE", inviterName,
                "invited you to join \"" + group.getName() + "\"", group.getId());
    }

    /** The pending group invites waiting on me. */
    @Transactional(readOnly = true)
    public List<GroupInviteDto> myInvites(Long userId) {
        List<GroupInvite> invites = inviteRepository
                .findByInviteeIdAndStatusOrderByIdDesc(userId, GroupInvite.Status.PENDING);
        if (invites.isEmpty()) return List.of();

        // Batched: one query for the groups, one for the inviters.
        Map<Long, Conversation> groups = conversationRepository
                .findAllById(invites.stream().map(GroupInvite::getConversationId).toList())
                .stream().collect(Collectors.toMap(Conversation::getId, c -> c));
        Map<Long, User> inviters = userRepository
                .findAllById(invites.stream().map(GroupInvite::getInviterId).toList())
                .stream().collect(Collectors.toMap(User::getId, u -> u));

        List<GroupInviteDto> out = new ArrayList<>();
        for (GroupInvite inv : invites) {
            Conversation g = groups.get(inv.getConversationId());
            User inviter = inviters.get(inv.getInviterId());
            if (g == null || inviter == null) continue;
            out.add(new GroupInviteDto(inv.getId(), g.getId(), g.getName(), g.getAvatarUrl(),
                    UserDto.from(inviter), inv.getCreatedAt()));
        }
        return out;
    }

    /** Accept an invite: only now does the invitee actually join and gain access. */
    @Transactional
    public ConversationSummaryDto acceptInvite(Long userId, Long inviteId) {
        GroupInvite inv = pendingInviteFor(userId, inviteId);
        Conversation group = getGroup(inv.getConversationId());

        inv.setStatus(GroupInvite.Status.ACCEPTED);
        inv.setRespondedAt(Instant.now());
        inviteRepository.save(inv);

        if (memberRepository.findByConversationIdAndUserId(group.getId(), userId).isEmpty()) {
            chatService.addMember(group.getId(), userId, ConversationMember.Role.MEMBER);
        }
        String name = userRepository.findById(userId).map(User::getDisplayName).orElse("Someone");
        notificationService.notifyUser(inv.getInviterId(), "GROUP", group.getName(),
                name + " joined the group", group.getId());
        return chatService.toSummary(group, userId);
    }

    @Transactional
    public void declineInvite(Long userId, Long inviteId) {
        GroupInvite inv = pendingInviteFor(userId, inviteId);
        inv.setStatus(GroupInvite.Status.DECLINED);
        inv.setRespondedAt(Instant.now());
        inviteRepository.save(inv);
    }

    private GroupInvite pendingInviteFor(Long userId, Long inviteId) {
        GroupInvite inv = inviteRepository.findById(inviteId)
                .orElseThrow(() -> ApiException.notFound("Invite not found"));
        if (!Objects.equals(inv.getInviteeId(), userId)) {
            throw ApiException.forbidden("This invite isn't yours");
        }
        if (inv.getStatus() != GroupInvite.Status.PENDING) {
            throw ApiException.badRequest("This invite is no longer pending");
        }
        return inv;
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
