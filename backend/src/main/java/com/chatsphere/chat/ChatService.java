package com.chatsphere.chat;

import com.chatsphere.block.BlockService;
import com.chatsphere.chat.domain.Conversation;
import com.chatsphere.chat.domain.ConversationMember;
import com.chatsphere.chat.domain.Message;
import com.chatsphere.chat.domain.MessageStatus;
import com.chatsphere.chat.dto.ChatDtos.*;
import com.chatsphere.chat.repo.ConversationMemberRepository;
import com.chatsphere.chat.repo.ConversationRepository;
import com.chatsphere.chat.repo.MessageReactionRepository;
import com.chatsphere.chat.repo.MessageRepository;
import com.chatsphere.chat.repo.MessageStatusRepository;
import com.chatsphere.common.error.ApiException;
import com.chatsphere.presence.PresenceService;
import com.chatsphere.user.User;
import com.chatsphere.user.UserRepository;
import com.chatsphere.user.dto.UserDto;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class ChatService {

    private final ConversationRepository conversationRepository;
    private final ConversationMemberRepository memberRepository;
    private final MessageRepository messageRepository;
    private final MessageStatusRepository statusRepository;
    private final UserRepository userRepository;
    private final PresenceService presenceService;
    private final BlockService blockService;
    private final MessageReactionRepository reactionRepository;

    public ChatService(ConversationRepository conversationRepository,
                       ConversationMemberRepository memberRepository,
                       MessageRepository messageRepository,
                       MessageStatusRepository statusRepository,
                       UserRepository userRepository,
                       PresenceService presenceService,
                       BlockService blockService,
                       MessageReactionRepository reactionRepository) {
        this.conversationRepository = conversationRepository;
        this.memberRepository = memberRepository;
        this.messageRepository = messageRepository;
        this.statusRepository = statusRepository;
        this.userRepository = userRepository;
        this.presenceService = presenceService;
        this.blockService = blockService;
        this.reactionRepository = reactionRepository;
    }

    /** Deterministic key for a 1:1 conversation regardless of who initiates. */
    private static String directKey(Long a, Long b) {
        long lo = Math.min(a, b);
        long hi = Math.max(a, b);
        return lo + "-" + hi;
    }

    @Transactional
    public Conversation getOrCreateDirect(Long meId, Long targetUserId) {
        if (Objects.equals(meId, targetUserId)) {
            throw ApiException.badRequest("Cannot start a conversation with yourself");
        }
        userRepository.findById(targetUserId)
                .orElseThrow(() -> ApiException.notFound("User not found: " + targetUserId));

        String key = directKey(meId, targetUserId);
        return conversationRepository.findByDirectKey(key).orElseGet(() -> {
            Conversation c = new Conversation();
            c.setType(Conversation.Type.DIRECT);
            c.setDirectKey(key);
            c.setCreatedBy(meId);
            Conversation saved = conversationRepository.save(c);
            addMember(saved.getId(), meId, ConversationMember.Role.MEMBER);
            addMember(saved.getId(), targetUserId, ConversationMember.Role.MEMBER);
            return saved;
        });
    }

    public ConversationMember addMember(Long conversationId, Long userId, ConversationMember.Role role) {
        if (memberRepository.existsByConversationIdAndUserId(conversationId, userId)) {
            return memberRepository.findByConversationIdAndUserId(conversationId, userId).orElseThrow();
        }
        ConversationMember m = new ConversationMember();
        m.setConversationId(conversationId);
        m.setUserId(userId);
        m.setRole(role);
        return memberRepository.save(m);
    }

    @Transactional(readOnly = true)
    public void assertMember(Long conversationId, Long userId) {
        if (!memberRepository.existsByConversationIdAndUserId(conversationId, userId)) {
            throw ApiException.forbidden("You are not a member of this conversation");
        }
    }

    @Transactional(readOnly = true)
    public List<Long> memberUserIds(Long conversationId) {
        return memberRepository.findByConversationId(conversationId).stream()
                .map(ConversationMember::getUserId).toList();
    }

    @Transactional(readOnly = true)
    public List<ConversationSummaryDto> listConversations(Long userId) {
        List<Conversation> conversations = conversationRepository.findAllForUser(userId);
        List<ConversationSummaryDto> result = new ArrayList<>();
        for (Conversation c : conversations) {
            // "Clear chat": the conversation stays in the list; only its messages
            // are hidden for this user (toSummary nulls the cleared preview/unread).
            result.add(toSummary(c, userId));
        }
        return result;
    }

    /**
     * "Clear chat" for a single user: hides all current messages for that user
     * while keeping the conversation in their list. The other participant is
     * unaffected; new messages still arrive normally afterwards.
     */
    @Transactional
    public void clearConversationForUser(Long userId, Long conversationId) {
        ConversationMember member = memberRepository
                .findByConversationIdAndUserId(conversationId, userId)
                .orElseThrow(() -> ApiException.forbidden("You are not a member of this conversation"));
        Message last = messageRepository.findTopByConversationIdAndDeletedFalseOrderByIdDesc(conversationId);
        long upTo = last == null ? 0L : last.getId();
        member.setClearedUpToMessageId(upTo);
        // Advance the read pointer too, so it isn't flagged unread if it reappears.
        if (member.getLastReadMessageId() == null || upTo > member.getLastReadMessageId()) {
            member.setLastReadMessageId(upTo);
        }
        memberRepository.save(member);
    }

    @Transactional(readOnly = true)
    public ConversationSummaryDto toSummary(Conversation c, Long viewerId) {
        List<ConversationMember> members = memberRepository.findByConversationId(c.getId());
        Map<Long, User> users = userRepository.findAllById(
                        members.stream().map(ConversationMember::getUserId).toList())
                .stream().collect(Collectors.toMap(User::getId, u -> u));

        List<UserDto> memberDtos = members.stream()
                .map(m -> users.get(m.getUserId()))
                .filter(Objects::nonNull)
                .map(u -> UserDto.from(u, presenceService.isOnline(u.getId()),
                        presenceService.lastSeen(u.getId())))
                .toList();

        // Resolve display name / avatar for DIRECT conversations from the counterpart.
        String name = c.getName();
        String avatar = c.getAvatarUrl();
        if (c.getType() == Conversation.Type.DIRECT) {
            User other = members.stream()
                    .map(ConversationMember::getUserId)
                    .filter(id -> !Objects.equals(id, viewerId))
                    .findFirst().map(users::get).orElse(null);
            if (other != null) {
                name = other.getDisplayName();
                // Hide the other user's picture if the viewer has blocked them.
                avatar = blockService.isBlocked(viewerId, other.getId())
                        ? null : other.getAvatarUrl();
            }
        }

        ConversationMember viewerMember = members.stream()
                .filter(m -> Objects.equals(m.getUserId(), viewerId))
                .findFirst().orElse(null);
        Long cleared = viewerMember == null ? null : viewerMember.getClearedUpToMessageId();

        long clearedFloor = cleared == null ? 0L : cleared;
        Message last;
        if (!blockService.hasAnyBlocks(viewerId)) {
            last = messageRepository.findTopByConversationIdAndDeletedFalseOrderByIdDesc(c.getId());
            // Don't preview a message the viewer has cleared.
            if (last != null && last.getId() <= clearedFloor) {
                last = null;
            }
        } else {
            // Pick the latest message NOT hidden by a block window (findPage is
            // newest-first and already excludes cleared messages).
            List<BlockService.BlockWindow> windows = blockService.blockWindows(viewerId);
            last = messageRepository
                    .findPage(c.getId(), null, clearedFloor, PageRequest.of(0, 30)).stream()
                    .filter(m -> !BlockService.isHidden(windows, m.getSenderId(), m.getCreatedAt()))
                    .findFirst()
                    .orElse(null);
        }
        MessageDto lastDto = last == null ? null
                : toMessageDto(last, users.get(last.getSenderId()), "SENT", null);

        Long lastRead = viewerMember == null ? null : viewerMember.getLastReadMessageId();
        // Unread only counts messages after both the read pointer and the clear point.
        Long floor = lastRead;
        if (cleared != null && (floor == null || cleared > floor)) {
            floor = cleared;
        }
        long unread = messageRepository.countUnread(c.getId(), viewerId, floor);

        return new ConversationSummaryDto(c.getId(), c.getPublicId(), c.getType().name(), name, avatar,
                lastDto, unread, memberDtos, c.getUpdatedAt());
    }

    @Transactional(readOnly = true)
    public List<MessageDto> getMessages(Long userId, Long conversationId, Long beforeId, int limit) {
        assertMember(conversationId, userId);
        long cleared = memberRepository.findByConversationIdAndUserId(conversationId, userId)
                .map(m -> m.getClearedUpToMessageId() == null ? 0L : m.getClearedUpToMessageId())
                .orElse(0L);
        List<Message> page = messageRepository.findPage(
                conversationId, beforeId, cleared, PageRequest.of(0, Math.min(limit, 100)));
        // Hide messages sent while the viewer had the sender blocked. Using the
        // block *windows* (not just current state) means messages received during
        // a block stay hidden even after the sender is unblocked.
        List<BlockService.BlockWindow> windows = blockService.blockWindows(userId);
        if (!windows.isEmpty()) {
            page = page.stream()
                    .filter(m -> !BlockService.isHidden(windows, m.getSenderId(), m.getCreatedAt()))
                    .toList();
        }
        Map<Long, User> senders = loadSenders(page);

        // Highest message id that some OTHER member has read. My messages up to
        // this id are "READ" (blue tick) — so read state survives a page reload.
        long maxOtherRead = memberRepository.findByConversationId(conversationId).stream()
                .filter(mem -> !Objects.equals(mem.getUserId(), userId))
                .map(mem -> mem.getLastReadMessageId() == null ? 0L : mem.getLastReadMessageId())
                .max(Long::compareTo)
                .orElse(0L);

        // return oldest-first for rendering
        List<MessageDto> dtos = page.stream()
                .map(m -> {
                    String status = Objects.equals(m.getSenderId(), userId) && m.getId() <= maxOtherRead
                            ? "READ" : "SENT";
                    return toMessageDto(m, senders.get(m.getSenderId()), status, null);
                })
                .collect(Collectors.toList());
        Collections.reverse(dtos);
        return dtos;
    }

    @Transactional
    public Message persistMessage(Long senderId, SendMessageCommand cmd) {
        assertMember(cmd.conversationId(), senderId);
        Message m = new Message();
        m.setConversationId(cmd.conversationId());
        m.setSenderId(senderId);
        m.setContent(cmd.content());
        m.setType(parseType(cmd.type()));
        m.setAttachmentUrl(cmd.attachmentUrl());
        if (cmd.replyToId() != null) {
            // Only accept a reply target that belongs to the same conversation.
            messageRepository.findById(cmd.replyToId())
                    .filter(r -> Objects.equals(r.getConversationId(), cmd.conversationId()))
                    .ifPresent(r -> m.setReplyToMessageId(r.getId()));
        }
        Message saved = messageRepository.save(m);

        // touch conversation so it sorts to the top
        conversationRepository.findById(cmd.conversationId()).ifPresent(conversationRepository::save);
        return saved;
    }

    /** Soft-deletes a message. Only the original sender may delete it. */
    @Transactional
    public Message deleteMessage(Long userId, Long messageId) {
        Message m = messageRepository.findById(messageId)
                .orElseThrow(() -> ApiException.notFound("Message not found"));
        assertMember(m.getConversationId(), userId);
        if (!Objects.equals(m.getSenderId(), userId)) {
            throw ApiException.forbidden("You can only delete your own messages");
        }
        m.setDeleted(true);
        m.setContent(null);
        m.setAttachmentUrl(null);
        return messageRepository.save(m);
    }

    @Transactional
    public void markRead(Long userId, Long conversationId, Long messageId) {
        assertMember(conversationId, userId);
        memberRepository.findByConversationIdAndUserId(conversationId, userId).ifPresent(m -> {
            if (m.getLastReadMessageId() == null || messageId > m.getLastReadMessageId()) {
                m.setLastReadMessageId(messageId);
                memberRepository.save(m);
            }
        });
        MessageStatus status = statusRepository.findByMessageIdAndUserId(messageId, userId)
                .orElseGet(() -> {
                    MessageStatus s = new MessageStatus();
                    s.setMessageId(messageId);
                    s.setUserId(userId);
                    return s;
                });
        status.setStatus(MessageStatus.Status.READ);
        statusRepository.save(status);
    }

    @Transactional(readOnly = true)
    public MessageDto toMessageDto(Message m, User sender, String status, String tempId) {
        String senderName = sender != null ? sender.getDisplayName() : "Unknown";
        boolean deleted = m.isDeleted();
        String content = deleted ? null : m.getContent();
        String attachmentUrl = deleted ? null : m.getAttachmentUrl();
        return new MessageDto(m.getId(), m.getConversationId(), m.getSenderId(), senderName,
                content, m.getType().name(), attachmentUrl,
                m.getCreatedAt(), status, tempId, deleted, buildReplyPreview(m.getReplyToMessageId()),
                reactionsFor(m.getId()), m.isPinned(), m.getEditedAt());
    }

    /** Group a message's reactions into (emoji -> userIds). */
    private List<ReactionDto> reactionsFor(Long messageId) {
        Map<String, List<Long>> byEmoji = new LinkedHashMap<>();
        for (var r : reactionRepository.findByMessageId(messageId)) {
            byEmoji.computeIfAbsent(r.getEmoji(), k -> new ArrayList<>()).add(r.getUserId());
        }
        return byEmoji.entrySet().stream()
                .map(e -> new ReactionDto(e.getKey(), e.getValue()))
                .toList();
    }

    /** Read-tick status for a message, viewed by its sender. */
    private String statusFor(Message m) {
        long maxOtherRead = memberRepository.findByConversationId(m.getConversationId()).stream()
                .filter(mem -> !Objects.equals(mem.getUserId(), m.getSenderId()))
                .map(mem -> mem.getLastReadMessageId() == null ? 0L : mem.getLastReadMessageId())
                .max(Long::compareTo).orElse(0L);
        return m.getId() <= maxOtherRead ? "READ" : "SENT";
    }

    /** Toggle the current user's emoji reaction on a message; returns the message. */
    @Transactional
    public Message toggleReaction(Long userId, Long messageId, String emoji) {
        Message m = messageRepository.findById(messageId)
                .orElseThrow(() -> ApiException.notFound("Message not found"));
        assertMember(m.getConversationId(), userId);
        reactionRepository.findByMessageIdAndUserIdAndEmoji(messageId, userId, emoji)
                .ifPresentOrElse(reactionRepository::delete, () -> {
                    var r = new com.chatsphere.chat.domain.MessageReaction();
                    r.setMessageId(messageId);
                    r.setUserId(userId);
                    r.setEmoji(emoji);
                    reactionRepository.save(r);
                });
        return m;
    }

    /** Pin or unpin a message. */
    @Transactional
    public Message setPinned(Long userId, Long messageId, boolean pinned) {
        Message m = messageRepository.findById(messageId)
                .orElseThrow(() -> ApiException.notFound("Message not found"));
        assertMember(m.getConversationId(), userId);
        m.setPinned(pinned);
        return messageRepository.save(m);
    }

    /** Edit the text of a message the caller sent. */
    @Transactional
    public Message editMessage(Long userId, Long messageId, String content) {
        Message m = messageRepository.findById(messageId)
                .orElseThrow(() -> ApiException.notFound("Message not found"));
        if (!Objects.equals(m.getSenderId(), userId)) {
            throw ApiException.forbidden("You can only edit your own messages");
        }
        if (m.isDeleted() || m.getType() != Message.Type.TEXT) {
            throw ApiException.badRequest("This message cannot be edited");
        }
        // Once the other side has read it, editing is no longer allowed.
        if ("READ".equals(statusFor(m))) {
            throw ApiException.badRequest("This message has already been read and can't be edited");
        }
        String trimmed = content == null ? "" : content.trim();
        if (trimmed.isEmpty()) {
            throw ApiException.badRequest("Message cannot be empty");
        }
        m.setContent(trimmed);
        m.setEditedAt(Instant.now());
        return messageRepository.save(m);
    }

    /** Rebuild the DTO for a mutated message (edit/pin/react), with correct ticks. */
    @Transactional(readOnly = true)
    public MessageDto refreshedDto(Message m) {
        User sender = userRepository.findById(m.getSenderId()).orElse(null);
        return toMessageDto(m, sender, statusFor(m), null);
    }

    /** Group conversations that the viewer and the direct counterpart share. */
    @Transactional(readOnly = true)
    public List<ConversationSummaryDto> commonGroups(Long viewerId, Long conversationId) {
        assertMember(conversationId, viewerId);
        Long other = memberRepository.findByConversationId(conversationId).stream()
                .map(ConversationMember::getUserId)
                .filter(id -> !Objects.equals(id, viewerId))
                .findFirst().orElse(null);
        if (other == null) {
            return List.of();
        }
        return conversationRepository.findCommonGroups(viewerId, other).stream()
                .map(c -> toSummary(c, viewerId))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<MessageDto> pinnedMessages(Long userId, Long conversationId) {
        assertMember(conversationId, userId);
        return messageRepository.findByConversationIdAndPinnedTrueAndDeletedFalseOrderByIdDesc(conversationId)
                .stream().map(m -> toMessageDto(m, userRepository.findById(m.getSenderId()).orElse(null),
                        statusFor(m), null))
                .toList();
    }

    private com.chatsphere.chat.dto.ChatDtos.ReplyPreview buildReplyPreview(Long replyToId) {
        if (replyToId == null) {
            return null;
        }
        Message target = messageRepository.findById(replyToId).orElse(null);
        if (target == null) {
            return null;
        }
        String name = userRepository.findById(target.getSenderId())
                .map(User::getDisplayName).orElse("Unknown");
        String preview = target.isDeleted() ? null : previewText(target);
        return new com.chatsphere.chat.dto.ChatDtos.ReplyPreview(
                target.getId(), name, preview, target.getType().name());
    }

    private String previewText(Message m) {
        return switch (m.getType()) {
            case IMAGE -> "📷 Photo";
            case FILE -> "📎 " + (m.getContent() == null ? "Attachment" : m.getContent());
            default -> m.getContent();
        };
    }

    @Transactional(readOnly = true)
    public MessageDto toMessageDto(Message m, String tempId) {
        User sender = userRepository.findById(m.getSenderId()).orElse(null);
        return toMessageDto(m, sender, "SENT", tempId);
    }

    private Map<Long, User> loadSenders(List<Message> messages) {
        Set<Long> ids = messages.stream().map(Message::getSenderId).collect(Collectors.toSet());
        return userRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(User::getId, u -> u));
    }

    private Message.Type parseType(String type) {
        if (type == null || type.isBlank()) return Message.Type.TEXT;
        try {
            return Message.Type.valueOf(type.toUpperCase());
        } catch (IllegalArgumentException e) {
            return Message.Type.TEXT;
        }
    }
}
