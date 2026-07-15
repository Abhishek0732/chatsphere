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

import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class ChatService {

    /** WhatsApp-style edit window: messages are editable for 15 minutes after sending. */
    private static final Duration EDIT_WINDOW = Duration.ofMinutes(15);

    /** Upper bound on messages returned by a single chat export (keeps it bounded). */
    private static final int EXPORT_CAP = 20_000;

    private final ConversationRepository conversationRepository;
    private final ConversationMemberRepository memberRepository;
    private final MessageRepository messageRepository;
    private final MessageStatusRepository statusRepository;
    private final UserRepository userRepository;
    private final PresenceService presenceService;
    private final BlockService blockService;
    private final MessageReactionRepository reactionRepository;
    private final com.chatsphere.common.cache.HotPathCache cache;
    private final PostSendWork postSend;
    private final com.chatsphere.media.MediaService mediaService;
    private final UnfurlService unfurlService;
    private final ChatBroadcaster broadcaster;

    public ChatService(ConversationRepository conversationRepository,
                       ConversationMemberRepository memberRepository,
                       MessageRepository messageRepository,
                       MessageStatusRepository statusRepository,
                       UserRepository userRepository,
                       PresenceService presenceService,
                       BlockService blockService,
                       MessageReactionRepository reactionRepository,
                       com.chatsphere.common.cache.HotPathCache cache,
                       PostSendWork postSend,
                       com.chatsphere.media.MediaService mediaService,
                       // @Lazy breaks the ChatService <-> UnfurlService cycle: UnfurlService
                       // calls back into applyLinkPreview once a fetch completes.
                       @org.springframework.context.annotation.Lazy UnfurlService unfurlService,
                       ChatBroadcaster broadcaster) {
        this.cache = cache;
        this.postSend = postSend;
        this.mediaService = mediaService;
        this.unfurlService = unfurlService;
        this.broadcaster = broadcaster;
        this.conversationRepository = conversationRepository;
        this.memberRepository = memberRepository;
        this.messageRepository = messageRepository;
        this.statusRepository = statusRepository;
        this.userRepository = userRepository;
        this.presenceService = presenceService;
        this.blockService = blockService;
        this.reactionRepository = reactionRepository;
    }

    /**
     * You cannot message someone who has deleted their account. Their history
     * stays visible, but the conversation is read-only from now on.
     */
    private void assertCounterpartAlive(Conversation conv, Long senderId) {
        if (conv.getType() != Conversation.Type.DIRECT) return;
        List<Long> others = cache.memberIds(conv.getId()).stream()
                .filter(id -> !Objects.equals(id, senderId))
                .toList();
        if (others.isEmpty()) return;
        boolean deleted = cache.briefs(others).values().stream()
                .anyMatch(com.chatsphere.common.cache.HotPathCache.UserBrief::deleted);
        if (deleted) {
            throw ApiException.badRequest("This account has been deleted");
        }
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
        User target = userRepository.findById(targetUserId)
                .orElseThrow(() -> ApiException.notFound("User not found: " + targetUserId));
        if (target.getDeletedAt() != null) {
            throw ApiException.badRequest("This account has been deleted");
        }

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
        ConversationMember saved = memberRepository.save(m);
        cache.invalidateMembers(conversationId);
        return saved;
    }

    @Transactional(readOnly = true)
    public void assertMember(Long conversationId, Long userId) {
        if (!memberRepository.existsByConversationIdAndUserId(conversationId, userId)) {
            throw ApiException.forbidden("You are not a member of this conversation");
        }
    }

    /** Cached: this was queried three separate times for every single message. */
    public List<Long> memberUserIds(Long conversationId) {
        return cache.memberIds(conversationId);
    }

    @Transactional(readOnly = true)
    public List<ConversationSummaryDto> listConversations(Long userId) {
        List<Conversation> conversations = conversationRepository.findAllForUser(userId);
        if (conversations.isEmpty()) return List.of();
        return listConversationsBatched(userId, conversations);
    }

    /**
     * Build the whole conversation list in a FIXED number of queries instead of
     * ~8–11 per conversation: members, users, presence, latest message, unread,
     * reactions and reply previews are each loaded once for the entire list.
     */
    private List<ConversationSummaryDto> listConversationsBatched(Long userId, List<Conversation> conversations) {
        List<Long> convIds = conversations.stream().map(Conversation::getId).toList();

        Map<Long, List<ConversationMember>> membersByConv = memberRepository.findByConversationIdIn(convIds)
                .stream().collect(Collectors.groupingBy(ConversationMember::getConversationId));

        // Latest message per conversation: read the denormalised pointer and fetch
        // those rows by primary key. Deriving it with
        // "id IN (SELECT MAX(id) ... GROUP BY conversation_id)" took >40 SECONDS
        // on a 2M-message database — the chat list simply never loaded.
        List<Long> lastIds = conversations.stream()
                .map(Conversation::getLastMessageId)
                .filter(Objects::nonNull)
                .toList();
        Map<Long, Message> latestByConv = lastIds.isEmpty() ? Map.of()
                : messageRepository.findAllById(lastIds).stream()
                        .filter(m -> !m.isDeleted())
                        .collect(Collectors.toMap(Message::getConversationId, m -> m, (a, b) -> a));

        // Load only the users this list actually RENDERS: the other party in each
        // direct chat, plus whoever sent each preview message. Loading every member
        // of every group (and their presence) made the work scale with total
        // membership — one 500-member group cost 500 user rows and 500 presence
        // lookups to draw a single row in the list.
        Set<Long> directMemberIds = conversations.stream()
                .filter(c -> c.getType() == Conversation.Type.DIRECT)
                .flatMap(c -> membersByConv.getOrDefault(c.getId(), List.of()).stream())
                .map(ConversationMember::getUserId)
                .collect(Collectors.toSet());
        Set<Long> userIds = new HashSet<>(directMemberIds);
        latestByConv.values().forEach(m -> userIds.add(m.getSenderId()));

        Map<Long, User> users = userRepository.findAllById(userIds).stream()
                .collect(Collectors.toMap(User::getId, u -> u));
        // Presence is only shown for direct chats in this list.
        Set<Long> online = presenceService.onlineAmong(directMemberIds);
        Map<Long, java.time.Instant> lastSeen = presenceService.lastSeenAmong(directMemberIds);

        // Unread counts come straight off my membership row — already loaded above,
        // so this costs nothing. It used to run a COUNT per conversation over the
        // messages table (~260ms for a user with 350 chats).
        Map<Long, Long> unreadByConv = new HashMap<>();
        for (Conversation c : conversations) {
            ConversationMember vm = viewerMember(membersByConv.get(c.getId()), userId);
            if (vm != null && vm.getUnreadCount() > 0) {
                unreadByConv.put(c.getId(), (long) vm.getUnreadCount());
            }
        }

        // Blocks are per-viewer and hide messages sent during a block window. Load
        // the windows ONCE (not per conversation), and only fall back to a per-
        // conversation scan for the conversations actually affected — blocking
        // someone used to drop this whole list onto an 8-query-per-chat path.
        List<BlockService.BlockWindow> windows = blockService.blockWindows(userId);
        Set<Long> blockedIds = windows.isEmpty() ? Set.of() : blockService.blockedUserIds(userId);

        // Visible last message per conversation (respect this viewer's clear floor).
        List<Message> visibleLast = new ArrayList<>();
        for (Conversation c : conversations) {
            ConversationMember vm = viewerMember(membersByConv.get(c.getId()), userId);
            long clearedFloor = vm == null || vm.getClearedUpToMessageId() == null
                    ? 0L : vm.getClearedUpToMessageId();
            Message last = latestByConv.get(c.getId());
            if (last != null && !windows.isEmpty()
                    && BlockService.isHidden(windows, last.getSenderId(), last.getCreatedAt())) {
                // Only this conversation's preview is affected — find the newest
                // message that isn't inside a block window.
                last = messageRepository.findPage(c.getId(), null, clearedFloor, PageRequest.of(0, 30))
                        .stream()
                        .filter(m -> !BlockService.isHidden(windows, m.getSenderId(), m.getCreatedAt()))
                        .findFirst().orElse(null);
            }
            if (last != null && last.getId() > clearedFloor) visibleLast.add(last);
        }
        Map<Long, MessageDto> lastDtoByConv = new HashMap<>();
        for (MessageDto d : assembleBatch(visibleLast, users, m -> "SENT")) {
            lastDtoByConv.put(d.conversationId(), d);
        }

        // The viewer only ever sees other people's presence if they themselves
        // share last-seen (the reciprocal half of the privacy toggle).
        User viewerUser = users.get(userId);
        boolean viewerSharesLastSeen = viewerUser == null || viewerUser.isLastSeenEnabled();

        List<ConversationSummaryDto> result = new ArrayList<>(conversations.size());
        for (Conversation c : conversations) {
            List<ConversationMember> members = membersByConv.getOrDefault(c.getId(), List.of());
            // Only DIRECT chats need their members inline (to resolve the other
            // person). Shipping every group's roster made this response scale with
            // total membership rather than with what the user can actually see.
            List<UserDto> memberDtos = c.getType() == Conversation.Type.DIRECT
                    ? members.stream()
                        .map(m -> users.get(m.getUserId()))
                        .filter(Objects::nonNull)
                        .map(u -> memberDto(u, userId, viewerSharesLastSeen, online, lastSeen))
                        .toList()
                    : List.of();

            String name = c.getName();
            String avatar = c.getAvatarUrl();
            if (c.getType() == Conversation.Type.DIRECT) {
                User other = members.stream().map(ConversationMember::getUserId)
                        .filter(id -> !Objects.equals(id, userId))
                        .findFirst().map(users::get).orElse(null);
                if (other != null) {
                    name = other.getDisplayName();
                    // Hide a blocked user's picture (was an isBlocked() query per chat).
                    avatar = blockedIds.contains(other.getId()) ? null : other.getAvatarUrl();
                } else {
                    // The counterpart is gone (deleted account). Never return a null
                    // name — the client renders it directly, and null took the whole
                    // chat list down.
                    name = "Deleted user";
                }
            }

            result.add(new ConversationSummaryDto(c.getId(), c.getPublicId(), c.getType().name(),
                    name, avatar, lastDtoByConv.get(c.getId()),
                    unreadByConv.getOrDefault(c.getId(), 0L), memberDtos, members.size(),
                    c.getUpdatedAt(), c.getDisappearingTtlSeconds()));
        }
        return result;
    }

    private static ConversationMember viewerMember(List<ConversationMember> members, Long userId) {
        if (members == null) return null;
        return members.stream().filter(m -> Objects.equals(m.getUserId(), userId)).findFirst().orElse(null);
    }

    /**
     * A member's UserDto with presence revealed only when reciprocal last-seen
     * privacy permits it: a user always sees their own presence, but another
     * person's online/last-seen is shown only when BOTH have last-seen enabled.
     */
    private UserDto memberDto(User u, Long viewerId, boolean viewerSharesLastSeen,
                              Set<Long> online, Map<Long, java.time.Instant> lastSeen) {
        boolean reveal = Objects.equals(u.getId(), viewerId)
                || (viewerSharesLastSeen && u.isLastSeenEnabled());
        return reveal
                ? UserDto.from(u, online.contains(u.getId()), lastSeen.get(u.getId()))
                : UserDto.from(u, null, null);
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
        member.setUnreadCount(0);
        memberRepository.save(member);
    }

    @Transactional(readOnly = true)
    public ConversationSummaryDto toSummary(Conversation c, Long viewerId) {
        List<ConversationMember> members = memberRepository.findByConversationId(c.getId());
        Map<Long, User> users = userRepository.findAllById(
                        members.stream().map(ConversationMember::getUserId).toList())
                .stream().collect(Collectors.toMap(User::getId, u -> u));

        // Batched presence: one Redis MGET + one query for all members, instead of
        // isOnline()+lastSeen() per member.
        List<Long> memberIds = members.stream().map(ConversationMember::getUserId).toList();
        java.util.Set<Long> onlineMembers = presenceService.onlineAmong(memberIds);
        java.util.Map<Long, java.time.Instant> lastSeenMembers = presenceService.lastSeenAmong(memberIds);
        User viewerUser = users.get(viewerId);
        boolean viewerSharesLastSeen = viewerUser == null || viewerUser.isLastSeenEnabled();
        List<UserDto> memberDtos = members.stream()
                .map(m -> users.get(m.getUserId()))
                .filter(Objects::nonNull)
                .map(u -> memberDto(u, viewerId, viewerSharesLastSeen, onlineMembers, lastSeenMembers))
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
            } else {
                name = "Deleted user"; // counterpart's account was deleted
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
        long unread = viewerMember == null ? 0L : viewerMember.getUnreadCount();

        return new ConversationSummaryDto(c.getId(), c.getPublicId(), c.getType().name(), name, avatar,
                lastDto, unread, memberDtos, members.size(), c.getUpdatedAt(),
                c.getDisappearingTtlSeconds());
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

        // Highest message id that some OTHER member has read, subject to reciprocal
        // read-receipt privacy. My messages up to this id are "READ" (blue tick) —
        // so read state survives a page reload.
        boolean direct = conversationRepository.findById(conversationId)
                .map(c -> c.getType() == Conversation.Type.DIRECT).orElse(false);
        final long readCeil = visibleReadCeil(direct, userId,
                memberRepository.findByConversationId(conversationId));
        List<MessageDto> dtos = assembleBatch(page, senders, m ->
                Objects.equals(m.getSenderId(), userId) && m.getId() <= readCeil ? "READ" : "SENT");
        // return oldest-first for rendering
        Collections.reverse(dtos);
        return dtos;
    }

    @Transactional
    public Message persistMessage(Long senderId, SendMessageCommand cmd) {
        // Membership comes from the cache — this was an exists() query per message.
        if (!cache.memberIds(cmd.conversationId()).contains(senderId)) {
            throw ApiException.forbidden("You are not a member of this conversation");
        }
        Conversation conv = conversationRepository.findById(cmd.conversationId())
                .orElseThrow(() -> ApiException.notFound("Conversation not found"));
        assertCounterpartAlive(conv, senderId);
        Message m = new Message();
        m.setConversationId(cmd.conversationId());
        m.setSenderId(senderId);
        m.setContent(cmd.content());
        m.setType(parseType(cmd.type()));
        m.setAttachmentUrl(cmd.attachmentUrl());
        // Encryption is a property of DIRECT chats only. A client cannot mark a group
        // message encrypted: nobody in the group could read it, and it would make the
        // server hide the preview of a message everyone else can see anyway.
        m.setEncrypted(cmd.encrypted() && conv.getType() == Conversation.Type.DIRECT);
        // View-once only makes sense for a media message, and only in a direct chat —
        // in a group "first viewer burns it for everyone" has no sensible meaning.
        m.setViewOnce(cmd.viewOnce()
                && cmd.attachmentUrl() != null
                && conv.getType() == Conversation.Type.DIRECT);
        m.setMentions(encodeMentions(cmd.conversationId(), cmd.mentions()));
        // Disappearing-messages timer: stamp when this message self-destructs.
        if (conv.getDisappearingTtlSeconds() != null) {
            m.setExpiresAt(Instant.now().plusSeconds(conv.getDisappearingTtlSeconds()));
        }
        if (cmd.replyToId() != null) {
            // Only accept a reply target that belongs to the same conversation.
            messageRepository.findById(cmd.replyToId())
                    .filter(r -> Objects.equals(r.getConversationId(), cmd.conversationId()))
                    .ifPresent(r -> m.setReplyToMessageId(r.getId()));
        }
        Message saved = messageRepository.save(m);

        // Everything else happens AFTER the commit, on another thread.
        //
        // The send transaction is now a single INSERT. It used to also take the
        // conversation's row lock (SELECT ... FOR UPDATE) and UPDATE that row plus
        // one row per member — so every sender in a chat queued behind every other
        // sender, and the fsync-per-commit cost was paid three times over. None of
        // that is needed for the message to be delivered.
        //
        // The conversation pointer is advanced with GREATEST(), so two messages
        // landing at once can never move it backwards.
        afterCommit(() -> {
            postSend.finish(cmd.conversationId(), senderId, saved.getId());
            // Link preview: an off-thread fetch of any URL in the (readable) text. No-op
            // for encrypted messages and messages without a link. Fills the row and
            // broadcasts an update when it finds something.
            if (!saved.isEncrypted() && saved.getType() == Message.Type.TEXT) {
                unfurlService.submit(saved.getId(), saved.getContent(), saved.isEncrypted());
            }
        });
        return saved;
    }

    /** Run something once the message is safely committed — never before. */
    private void afterCommit(Runnable task) {
        if (org.springframework.transaction.support.TransactionSynchronizationManager
                .isSynchronizationActive()) {
            org.springframework.transaction.support.TransactionSynchronizationManager
                    .registerSynchronization(
                            new org.springframework.transaction.support.TransactionSynchronization() {
                                @Override
                                public void afterCommit() {
                                    task.run();
                                }
                            });
        } else {
            task.run();
        }
    }

    /** Ids a client may tag in one message. Bounds the stored CSV. */
    private static final int MAX_MENTIONS = 64;

    /**
     * Turn the client's @mention ids into the CSV stored on the row. Only real
     * members of the conversation survive, so a client can't tag an outsider (or
     * spam the column) by hand-crafting the frame.
     */
    private String encodeMentions(Long conversationId, List<Long> mentions) {
        if (mentions == null || mentions.isEmpty()) return null;
        Set<Long> members = new HashSet<>(memberUserIds(conversationId));
        String csv = mentions.stream()
                .filter(Objects::nonNull)
                .distinct()
                .filter(members::contains)
                .limit(MAX_MENTIONS)
                .map(String::valueOf)
                .collect(Collectors.joining(","));
        return csv.isEmpty() ? null : csv;
    }

    /** Parse the stored CSV back into ids; tolerant of anything malformed. */
    private static List<Long> decodeMentions(String csv) {
        if (csv == null || csv.isBlank()) return List.of();
        List<Long> ids = new ArrayList<>();
        for (String part : csv.split(",")) {
            try {
                ids.add(Long.valueOf(part.trim()));
            } catch (NumberFormatException ignored) {
                // skip
            }
        }
        return ids;
    }

    /**
     * Persist a status reply/reaction as a normal text message that carries a
     * snapshot of the status it answers. The caller has already resolved the
     * direct conversation and enforced block rules.
     */
    @Transactional
    public Message persistStatusReply(Long senderId, Long conversationId, String content,
                                      Long statusId, String statusType, String statusMediaUrl,
                                      String statusCaption, String statusBgColor) {
        assertMember(conversationId, senderId);
        Message m = new Message();
        m.setConversationId(conversationId);
        m.setSenderId(senderId);
        m.setContent(content);
        m.setType(Message.Type.TEXT);
        m.setStatusRefId(statusId);
        m.setStatusRefType(statusType);
        m.setStatusRefMediaUrl(statusMediaUrl);
        m.setStatusRefCaption(statusCaption);
        m.setStatusRefBgColor(statusBgColor);
        conversationRepository.findById(conversationId).ifPresent(c -> {
            if (c.getDisappearingTtlSeconds() != null) {
                m.setExpiresAt(Instant.now().plusSeconds(c.getDisappearingTtlSeconds()));
            }
        });
        Message saved = messageRepository.save(m);
        conversationRepository.findByIdForUpdate(conversationId).ifPresent(c -> {
            c.setLastMessageId(saved.getId());
            conversationRepository.save(c);
        });
        memberRepository.incrementUnread(conversationId, senderId);
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
        Message saved = messageRepository.save(m);

        // A deleted message must not keep inflating anyone's unread badge.
        memberRepository.decrementUnread(m.getConversationId(), m.getSenderId(), saved.getId());

        // If the deleted message was the conversation's preview, move the pointer
        // back to the newest surviving message (indexed, so this is a single seek).
        conversationRepository.findById(m.getConversationId()).ifPresent(c -> {
            if (Objects.equals(c.getLastMessageId(), saved.getId())) {
                Message prev = messageRepository
                        .findTopByConversationIdAndDeletedFalseOrderByIdDesc(c.getId());
                c.setLastMessageId(prev == null ? null : prev.getId());
                conversationRepository.save(c);
            }
        });
        return saved;
    }

    @Transactional
    public void markRead(Long userId, Long conversationId, Long messageId) {
        assertMember(conversationId, userId);
        memberRepository.findByConversationIdAndUserId(conversationId, userId).ifPresent(m -> {
            boolean advanced = m.getLastReadMessageId() == null || messageId > m.getLastReadMessageId();
            if (advanced) {
                m.setLastReadMessageId(messageId);
            }
            // Clear the badge whenever the chat is opened — NOT only when the read
            // pointer moves. Otherwise a count left over from any earlier drift
            // sticks forever, because the pointer is already at the newest message.
            if (advanced || m.getUnreadCount() != 0) {
                m.setUnreadCount(0);
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

    /**
     * The full transcript (oldest first) for a chat export, respecting the user's
     * per-chat cleared floor. One message query + one batched sender lookup — no
     * N+1. Capped at {@link #EXPORT_CAP} messages so a huge history can't blow up
     * a single request. Client formats the lines and downloads the file.
     */
    @Transactional(readOnly = true)
    public List<ExportMessageDto> exportChat(Long userId, Long conversationId) {
        assertMember(conversationId, userId);
        long cleared = memberRepository.findByConversationIdAndUserId(conversationId, userId)
                .map(m -> m.getClearedUpToMessageId() == null ? 0L : m.getClearedUpToMessageId())
                .orElse(0L);
        List<Message> msgs = messageRepository.findForExport(
                conversationId, cleared, PageRequest.of(0, EXPORT_CAP));
        Set<Long> senderIds = msgs.stream().map(Message::getSenderId).collect(Collectors.toSet());
        Map<Long, User> users = userRepository.findAllById(senderIds).stream()
                .collect(Collectors.toMap(User::getId, u -> u));
        return msgs.stream()
                .map(m -> {
                    User s = users.get(m.getSenderId());
                    return new ExportMessageDto(
                            s != null ? s.getDisplayName() : "Unknown",
                            m.getType().name(),
                            m.getContent(),
                            m.getCreatedAt(),
                            m.isDeleted());
                })
                .toList();
    }

    /**
     * "Message info" for one of my own messages: which members have read it and
     * which haven't. A member has read the message when their read pointer has
     * moved past it — so this is two queries (members + their users), never a
     * per-recipient lookup. Only the sender may ask, as in WhatsApp.
     */
    @Transactional(readOnly = true)
    public MessageInfoDto messageInfo(Long userId, Long conversationId, Long messageId) {
        assertMember(conversationId, userId);
        Message m = messageRepository.findById(messageId)
                .orElseThrow(() -> ApiException.notFound("Message not found"));
        if (!Objects.equals(m.getConversationId(), conversationId)) {
            throw ApiException.notFound("Message not found");
        }
        if (!Objects.equals(m.getSenderId(), userId)) {
            throw ApiException.forbidden("You can only see info for your own messages");
        }

        List<ConversationMember> members = memberRepository.findByConversationId(conversationId);
        Set<Long> otherIds = members.stream()
                .map(ConversationMember::getUserId)
                .filter(id -> !Objects.equals(id, userId))
                .collect(Collectors.toSet());
        Map<Long, User> users = userRepository.findAllById(otherIds).stream()
                .collect(Collectors.toMap(User::getId, u -> u));

        List<UserDto> readBy = new ArrayList<>();
        List<UserDto> pending = new ArrayList<>();
        for (ConversationMember cm : members) {
            User u = users.get(cm.getUserId());
            if (u == null) continue; // me, or a user that no longer exists
            Long lastRead = cm.getLastReadMessageId();
            boolean read = lastRead != null && lastRead >= messageId;
            (read ? readBy : pending).add(UserDto.from(u));
        }
        return new MessageInfoDto(readBy, pending);
    }

    /**
     * A page of shared media for a conversation (info panel), newest first,
     * cursor-paginated so a chat with lots of media loads incrementally rather
     * than all at once. Single indexed query, capped page size.
     */
    @Transactional(readOnly = true)
    public List<MediaItemDto> conversationMedia(Long userId, Long conversationId, String kind,
                                                Long beforeId, int limit) {
        assertMember(conversationId, userId);
        long cleared = memberRepository.findByConversationIdAndUserId(conversationId, userId)
                .map(m -> m.getClearedUpToMessageId() == null ? 0L : m.getClearedUpToMessageId())
                .orElse(0L);
        var page = PageRequest.of(0, Math.min(Math.max(limit, 1), 60));
        List<Message> rows = switch (kind == null ? "media" : kind.toLowerCase()) {
            case "docs" -> messageRepository.findAttachmentsByType(
                    conversationId, cleared, beforeId, Message.Type.FILE, page);
            case "links" -> messageRepository.findLinks(conversationId, cleared, beforeId, page);
            default -> messageRepository.findAttachmentsByType(
                    conversationId, cleared, beforeId, Message.Type.IMAGE, page);
        };
        return rows.stream()
                .map(m -> new MediaItemDto(m.getId(), m.getType().name(), m.getAttachmentUrl(),
                        m.getContent(), m.getCreatedAt()))
                .toList();
    }

    @Transactional(readOnly = true)
    public MessageDto toMessageDto(Message m, User sender, String status, String tempId) {
        // Single-message path (e.g. WebSocket echo): 1–2 small lookups are fine.
        return assemble(m, sender, status, tempId,
                reactionsFor(m.getId()), buildReplyPreview(m.getReplyToMessageId()));
    }

    /** Build a MessageDto from already-resolved reactions + reply preview (no queries). */
    private MessageDto assemble(Message m, User sender, String status, String tempId,
                                List<ReactionDto> reactions, ReplyPreview replyTo) {
        String senderName = sender != null ? sender.getDisplayName() : "Unknown";
        boolean deleted = m.isDeleted();
        String content = deleted ? null : m.getContent();
        String attachmentUrl = deleted ? null : m.getAttachmentUrl();
        StatusRef statusRef = deleted || m.getStatusRefType() == null ? null
                : new StatusRef(m.getStatusRefId(), m.getStatusRefType(),
                        m.getStatusRefMediaUrl(), m.getStatusRefCaption(), m.getStatusRefBgColor());
        return new MessageDto(m.getId(), m.getConversationId(), m.getSenderId(), senderName,
                content, m.getType().name(), attachmentUrl,
                m.getCreatedAt(), status, tempId, deleted, replyTo,
                reactions, m.isPinned(), m.getEditedAt(), statusRef,
                deleted ? List.of() : decodeMentions(m.getMentions()), m.isEncrypted(),
                m.getExpiresAt(), m.isViewOnce(), m.getViewOnceSeenAt() != null,
                deleted ? null : linkPreviewOf(m));
    }

    /** Build the link-preview DTO from the columns already on the row (no query). */
    private LinkPreviewDto linkPreviewOf(Message m) {
        if (m.getLinkUrl() == null) return null;
        return new LinkPreviewDto(m.getLinkTitle(), m.getLinkDesc(), m.getLinkImage(),
                m.getLinkSite(), m.getLinkUrl());
    }

    /**
     * Build DTOs for a whole page of messages with a fixed, small number of
     * queries — reactions, reply targets, and reply-target senders are each
     * loaded in ONE batch instead of per message (avoids N+1 on the hot
     * message-loading path).
     */
    @Transactional(readOnly = true)
    public List<MessageDto> assembleBatch(List<Message> messages, Map<Long, User> senders,
                                          java.util.function.Function<Message, String> statusFn) {
        if (messages.isEmpty()) return new ArrayList<>();
        List<Long> ids = messages.stream().map(Message::getId).toList();

        // 1) reactions for all messages, grouped (emoji -> userIds) per message
        Map<Long, List<ReactionDto>> reactionsByMsg = new HashMap<>();
        Map<Long, Map<String, List<Long>>> grouped = new HashMap<>();
        for (var r : reactionRepository.findByMessageIdIn(ids)) {
            grouped.computeIfAbsent(r.getMessageId(), k -> new LinkedHashMap<>())
                    .computeIfAbsent(r.getEmoji(), k -> new ArrayList<>()).add(r.getUserId());
        }
        grouped.forEach((mid, byEmoji) -> reactionsByMsg.put(mid, byEmoji.entrySet().stream()
                .map(e -> new ReactionDto(e.getKey(), e.getValue())).toList()));

        // 2) reply targets + their senders, batched
        List<Long> replyIds = messages.stream().map(Message::getReplyToMessageId)
                .filter(Objects::nonNull).distinct().toList();
        Map<Long, Message> targets = replyIds.isEmpty() ? Map.of()
                : messageRepository.findAllById(replyIds).stream()
                        .collect(Collectors.toMap(Message::getId, t -> t));
        Set<Long> targetSenderIds = targets.values().stream()
                .map(Message::getSenderId).collect(Collectors.toSet());
        Map<Long, User> targetSenders = targetSenderIds.isEmpty() ? Map.of()
                : userRepository.findAllById(targetSenderIds).stream()
                        .collect(Collectors.toMap(User::getId, u -> u));

        List<MessageDto> out = new ArrayList<>(messages.size());
        for (Message m : messages) {
            out.add(assemble(m, senders.get(m.getSenderId()), statusFn.apply(m), null,
                    reactionsByMsg.getOrDefault(m.getId(), List.of()),
                    replyPreviewFrom(m.getReplyToMessageId(), targets, targetSenders)));
        }
        return out;
    }

    private ReplyPreview replyPreviewFrom(Long replyToId, Map<Long, Message> targets,
                                          Map<Long, User> senders) {
        if (replyToId == null) return null;
        Message target = targets.get(replyToId);
        if (target == null) return null;
        String name = senders.containsKey(target.getSenderId())
                ? senders.get(target.getSenderId()).getDisplayName() : "Unknown";
        String preview = target.isDeleted() ? null : previewText(target);
        return new ReplyPreview(target.getId(), name, preview, target.getType().name());
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

    /** Read-tick status for a message, viewed by its sender (reciprocity applied). */
    private String statusFor(Message m) {
        boolean direct = conversationRepository.findById(m.getConversationId())
                .map(c -> c.getType() == Conversation.Type.DIRECT).orElse(false);
        long ceil = visibleReadCeil(direct, m.getSenderId(),
                memberRepository.findByConversationId(m.getConversationId()));
        return m.getId() <= ceil ? "READ" : "SENT";
    }

    /**
     * Highest message id that some member OTHER than the viewer has read, and that
     * the viewer is allowed to see as a read receipt. Read receipts are reciprocal
     * for DIRECT chats: if either side has turned them off, neither sees them.
     * Group read receipts are always on, exactly as WhatsApp behaves.
     */
    private long visibleReadCeil(boolean direct, Long viewerId, List<ConversationMember> members) {
        if (direct) {
            var vb = cache.brief(viewerId);
            if (vb != null && !vb.readReceipts()) return 0L; // viewer opted out → sees none
        }
        long ceil = 0L;
        for (ConversationMember mem : members) {
            if (Objects.equals(mem.getUserId(), viewerId)) continue;
            if (direct) {
                var ob = cache.brief(mem.getUserId());
                if (ob != null && !ob.readReceipts()) continue; // other opted out → hidden
            }
            long lr = mem.getLastReadMessageId() == null ? 0L : mem.getLastReadMessageId();
            if (lr > ceil) ceil = lr;
        }
        return ceil;
    }

    /**
     * Whether {@code readerId} marking a conversation read should be broadcast as a
     * live read receipt. For DIRECT chats this respects the reader's own toggle
     * (the recipient additionally suppresses it client-side if THEY opted out);
     * group read receipts always broadcast.
     */
    @Transactional(readOnly = true)
    public boolean readReceiptsBroadcastAllowed(Long readerId, Long conversationId) {
        boolean direct = conversationRepository.findById(conversationId)
                .map(c -> c.getType() == Conversation.Type.DIRECT).orElse(false);
        if (!direct) return true;
        var b = cache.brief(readerId);
        return b == null || b.readReceipts();
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
        // WhatsApp-style: a message is editable only within 15 minutes of sending
        // (read state no longer matters — you can edit a message that's been read).
        if (m.getCreatedAt() == null
                || Duration.between(m.getCreatedAt(), Instant.now()).compareTo(EDIT_WINDOW) > 0) {
            throw ApiException.badRequest("You can only edit a message within 15 minutes of sending");
        }
        String trimmed = content == null ? "" : content.trim();
        if (trimmed.isEmpty()) {
            throw ApiException.badRequest("Message cannot be empty");
        }
        m.setContent(trimmed);
        m.setEditedAt(Instant.now());
        return messageRepository.save(m);
    }

    /**
     * The recipient opened a view-once message. Stamp it seen, delete the stored
     * object, and null the URL so the bytes can never be served again. Idempotent,
     * and a no-op (beyond returning the DTO) when the SENDER previews their own —
     * only the other side's open burns it. Broadcasts the update so the sender's
     * bubble flips to "Opened" too.
     */
    @Transactional
    public MessageDto markViewOnceSeen(Long userId, Long messageId) {
        Message m = messageRepository.findById(messageId)
                .orElseThrow(() -> ApiException.notFound("Message not found"));
        assertMember(m.getConversationId(), userId);
        if (!m.isViewOnce()) {
            throw ApiException.badRequest("This message is not view-once");
        }
        // The sender looking at their own send does not consume it.
        if (Objects.equals(m.getSenderId(), userId)) {
            return refreshedDto(m);
        }
        if (m.getViewOnceSeenAt() == null) {
            String url = m.getAttachmentUrl();
            m.setViewOnceSeenAt(Instant.now());
            m.setAttachmentUrl(null);
            messageRepository.save(m);
            if (url != null) mediaService.deleteQuietly(url);
        }
        MessageDto dto = refreshedDto(m);
        broadcaster.sendUpdateToMembers(dto, memberUserIds(m.getConversationId()));
        return dto;
    }

    /**
     * Called (off-thread) by {@link UnfurlService} once it has a preview for a
     * message's link. Persists it on the row and broadcasts an in-place update so
     * every member's bubble grows the preview card live.
     */
    @Transactional
    public void applyLinkPreview(Long messageId, LinkPreviewDto preview) {
        Message m = messageRepository.findById(messageId).orElse(null);
        if (m == null || m.isDeleted() || m.isEncrypted() || m.getLinkUrl() != null) return;
        m.setLinkUrl(preview.url());
        m.setLinkTitle(preview.title());
        m.setLinkDesc(preview.description());
        m.setLinkImage(preview.imageUrl());
        m.setLinkSite(preview.siteName());
        messageRepository.save(m);
        broadcaster.sendUpdateToMembers(refreshedDto(m), memberUserIds(m.getConversationId()));
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

    /**
     * DTO for a message that was just created — the hot path.
     *
     * A brand-new message cannot have reactions, so querying for them is pointless,
     * and the sender's name comes from the cache. That removes two queries from
     * every single send; only a reply (rare) still costs a lookup.
     */
    @Transactional(readOnly = true)
    public MessageDto freshDto(Message m, String tempId) {
        var brief = cache.brief(m.getSenderId());
        String senderName = brief != null ? brief.displayName() : "Unknown";
        ReplyPreview replyTo = m.getReplyToMessageId() == null
                ? null : buildReplyPreview(m.getReplyToMessageId());
        StatusRef statusRef = m.getStatusRefType() == null ? null
                : new StatusRef(m.getStatusRefId(), m.getStatusRefType(), m.getStatusRefMediaUrl(),
                        m.getStatusRefCaption(), m.getStatusRefBgColor());
        return new MessageDto(m.getId(), m.getConversationId(), m.getSenderId(), senderName,
                m.getContent(), m.getType().name(), m.getAttachmentUrl(), m.getCreatedAt(),
                "SENT", tempId, false, replyTo, List.of(), m.isPinned(), m.getEditedAt(),
                statusRef, decodeMentions(m.getMentions()), m.isEncrypted(), m.getExpiresAt(),
                // A brand-new message: view-once flag is set, not yet seen, no preview yet
                // (the async unfurl broadcasts an update the moment it has one).
                m.isViewOnce(), false, null);
    }

    private Map<Long, User> loadSenders(List<Message> messages) {
        Set<Long> ids = messages.stream().map(Message::getSenderId).collect(Collectors.toSet());
        return userRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(User::getId, u -> u));
    }

    /**
     * Set (ttlSeconds &gt; 0) or clear (null / &lt;= 0) the disappearing-messages timer
     * for a conversation. Any member may change it, as WhatsApp allows. Returns the
     * value actually stored (null = off).
     */
    @Transactional
    public Integer setDisappearing(Long userId, Long conversationId, Integer ttlSeconds) {
        assertMember(conversationId, userId);
        Conversation c = conversationRepository.findById(conversationId)
                .orElseThrow(() -> ApiException.notFound("Conversation not found"));
        Integer ttl = (ttlSeconds == null || ttlSeconds <= 0) ? null : ttlSeconds;
        c.setDisappearingTtlSeconds(ttl);
        conversationRepository.save(c);
        return ttl;
    }

    /**
     * Everything the caller missed while offline: non-cleared messages in their
     * conversations with id greater than the client's watermark, oldest-first and
     * capped. One indexed ascending scan — the reconnect catch-up that live
     * (online-only) delivery does not provide.
     */
    @Transactional(readOnly = true)
    public List<MessageDto> syncSince(Long userId, long sinceId, int limit) {
        int cap = Math.min(Math.max(limit, 1), 500);
        List<Message> page = messageRepository.findSinceForUser(userId, sinceId, PageRequest.of(0, cap));
        if (page.isEmpty()) return List.of();
        // Hide messages sent while the viewer had the sender blocked.
        List<BlockService.BlockWindow> windows = blockService.blockWindows(userId);
        if (!windows.isEmpty()) {
            page = page.stream()
                    .filter(m -> !BlockService.isHidden(windows, m.getSenderId(), m.getCreatedAt()))
                    .toList();
        }
        Map<Long, User> senders = loadSenders(page);
        // Read-tick status only matters for the viewer's own outgoing messages,
        // which a catch-up does not return; SENT keeps this a single batched pass
        // with no per-conversation read-ceiling work.
        return assembleBatch(page, senders, m -> "SENT");
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
