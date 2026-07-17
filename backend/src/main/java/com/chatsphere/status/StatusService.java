package com.chatsphere.status;

import com.chatsphere.block.BlockService;
import com.chatsphere.chat.ChatBroadcaster;
import com.chatsphere.chat.ChatService;
import com.chatsphere.chat.domain.Conversation;
import com.chatsphere.chat.domain.Message;
import com.chatsphere.chat.dto.ChatDtos.MessageDto;
import com.chatsphere.chat.repo.ConversationMemberRepository;
import com.chatsphere.common.error.ApiException;
import com.chatsphere.contact.ContactRepository;
import com.chatsphere.messaging.ChatEventPublisher;
import com.chatsphere.notification.NotificationService;
import com.chatsphere.status.dto.StatusDtos.*;
import com.chatsphere.user.User;
import com.chatsphere.user.UserRepository;
import com.chatsphere.user.dto.UserDto;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class StatusService {

    private final StatusRepository statusRepository;
    private final StatusViewRepository viewRepository;
    private final ContactRepository contactRepository;
    private final ConversationMemberRepository memberRepository;
    private final UserRepository userRepository;
    private final BlockService blockService;
    private final ChatService chatService;
    private final ChatBroadcaster chatBroadcaster;
    private final NotificationService notificationService;
    private final ChatEventPublisher chatEventPublisher;
    private final StatusPrivacyRepository privacyRepository;
    private final StatusPrivacyUserRepository privacyUserRepository;
    private final ObjectMapper objectMapper;

    public StatusService(StatusRepository statusRepository,
                         StatusViewRepository viewRepository,
                         ContactRepository contactRepository,
                         ConversationMemberRepository memberRepository,
                         UserRepository userRepository,
                         BlockService blockService,
                         ChatService chatService,
                         ChatBroadcaster chatBroadcaster,
                         NotificationService notificationService,
                         ChatEventPublisher chatEventPublisher,
                         StatusPrivacyRepository privacyRepository,
                         StatusPrivacyUserRepository privacyUserRepository,
                         ObjectMapper objectMapper) {
        this.statusRepository = statusRepository;
        this.viewRepository = viewRepository;
        this.contactRepository = contactRepository;
        this.memberRepository = memberRepository;
        this.userRepository = userRepository;
        this.blockService = blockService;
        this.chatService = chatService;
        this.chatBroadcaster = chatBroadcaster;
        this.notificationService = notificationService;
        this.chatEventPublisher = chatEventPublisher;
        this.privacyRepository = privacyRepository;
        this.privacyUserRepository = privacyUserRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public StatusItemDto create(Long userId, CreateStatusRequest req) {
        Status.Type type;
        try {
            type = Status.Type.valueOf(req.type().toUpperCase());
        } catch (Exception e) {
            throw ApiException.badRequest("Invalid status type");
        }
        // Several photos/videos picked at once form one album; a single pick (or an
        // older client) just sends mediaUrl. The first album item is the primary.
        List<StatusMediaDto> album = normalizeAlbum(req.media());
        String primaryUrl = album.isEmpty() ? blankToNull(req.mediaUrl()) : album.get(0).url();
        if (type != Status.Type.TEXT && primaryUrl == null) {
            throw ApiException.badRequest("Media is required");
        }
        if (type == Status.Type.TEXT && isBlank(req.caption())) {
            throw ApiException.badRequest("Text is required");
        }
        Status s = new Status();
        s.setUserId(userId);
        s.setType(type);
        s.setMediaUrl(primaryUrl);
        // Only a real album (2+) needs the JSON; one item lives in mediaUrl alone.
        s.setMediaJson(album.size() >= 2 ? writeAlbum(album) : null);
        s.setCaption(blankToNull(req.caption()));
        s.setBgColor(blankToNull(req.bgColor()));
        String musicUrl = blankToNull(req.musicUrl());
        s.setMusicUrl(musicUrl);
        if (musicUrl != null) {
            s.setMusicTitle(blankToNull(req.musicTitle()));
            s.setMusicArtist(blankToNull(req.musicArtist()));
            Integer dur = req.musicDurationMs();
            s.setMusicDurationMs(dur != null && dur > 0 ? dur : null);
            Integer start = req.musicStartMs();
            s.setMusicStartMs(start != null && start > 0 ? start : null);
        }
        s.setMentions(encodeMentions(userId, req.mentions()));
        s.setExpiresAt(Instant.now().plus(24, ChronoUnit.HOURS));
        Status saved = statusRepository.save(s);

        notifyMentioned(userId, saved);
        return toItem(saved, true, 0, relatedUsers(List.of(saved)), false);
    }

    /**
     * Add someone else's status to my own — the "Add to my status" flow, offered
     * to a person who was @mentioned in it.
     *
     * The copy is a normal status row that remembers where it came from, so it is
     * credited to the original author, runs its own 24h clock, and survives the
     * original expiring or being deleted.
     */
    @Transactional
    public StatusItemDto addToMyStatus(Long me, Long statusId) {
        Status src = statusRepository.findById(statusId)
                .orElseThrow(() -> ApiException.notFound("Status not found"));
        if (Objects.equals(src.getUserId(), me)) {
            throw ApiException.badRequest("This is already your status");
        }
        // Only the tagged people may re-share it — that is the whole point of the
        // permission. Anything else would let a viewer copy a status the author
        // never offered them.
        if (!decodeMentions(src.getMentions()).contains(me)) {
            throw ApiException.forbidden("Only people mentioned in this status can add it");
        }
        if (src.getExpiresAt().isBefore(Instant.now())) {
            throw ApiException.badRequest("This status has expired");
        }
        if (blockService.blockRelatedUserIds(me).contains(src.getUserId())
                || !canSeeStatus(src.getUserId(), me)) {
            throw ApiException.forbidden("You can't add this status");
        }

        // Adding a status that was itself added from someone else keeps pointing at
        // the ORIGINAL, so credit never drifts and the "already added?" check below
        // still recognises it.
        Long rootId = src.getOriginalStatusId() != null ? src.getOriginalStatusId() : src.getId();
        Long rootAuthor = src.getOriginalUserId() != null ? src.getOriginalUserId() : src.getUserId();
        if (Objects.equals(rootAuthor, me)) {
            throw ApiException.badRequest("This status is already yours");
        }
        if (statusRepository.existsByUserIdAndOriginalStatusId(me, rootId)) {
            throw ApiException.badRequest("Already added to your status");
        }

        Status copy = new Status();
        copy.setUserId(me);
        copy.setType(src.getType());
        copy.setMediaUrl(src.getMediaUrl());
        copy.setMediaJson(src.getMediaJson()); // carry the whole album, if any
        copy.setCaption(src.getCaption());
        copy.setBgColor(src.getBgColor());
        copy.setMusicUrl(src.getMusicUrl());
        copy.setMusicTitle(src.getMusicTitle());
        copy.setMusicArtist(src.getMusicArtist());
        copy.setMusicDurationMs(src.getMusicDurationMs());
        copy.setMusicStartMs(src.getMusicStartMs());
        // The tags travel with the caption purely so "@Alice" still renders as a
        // tag in the copy. Nobody is notified a second time — being tagged in the
        // original already told them.
        copy.setMentions(src.getMentions());
        copy.setOriginalStatusId(rootId);
        copy.setOriginalUserId(rootAuthor);
        copy.setExpiresAt(Instant.now().plus(24, ChronoUnit.HOURS));
        Status saved = statusRepository.save(copy);

        // Tell the author their status was shared — one row, like any other.
        String sharer = userRepository.findById(me).map(User::getDisplayName).orElse("Someone");
        notificationService.notifyUser(rootAuthor, "STATUS_REPOST", sharer,
                "added your status to theirs", null);

        return toItem(saved, true, 0, relatedUsers(List.of(saved)), false);
    }

    /** Ids a client may tag in one status. Bounds the stored CSV. */
    private static final int MAX_MENTIONS = 32;

    /**
     * Keep only people who are actually the author's contacts — a client can't
     * tag (and so notify) a stranger by hand-crafting the request.
     */
    private String encodeMentions(Long authorId, List<Long> mentions) {
        if (mentions == null || mentions.isEmpty()) return null;
        Set<Long> contacts = contactRepository.findByOwnerIdOrderByIdDesc(authorId).stream()
                .map(c -> c.getContactUserId())
                .collect(Collectors.toSet());
        String csv = mentions.stream()
                .filter(Objects::nonNull)
                .distinct()
                .filter(contacts::contains)
                .limit(MAX_MENTIONS)
                .map(String::valueOf)
                .collect(Collectors.joining(","));
        return csv.isEmpty() ? null : csv;
    }

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

    /** Tell the tagged people — being mentioned is the point of tagging. */
    private void notifyMentioned(Long authorId, Status s) {
        List<Long> ids = decodeMentions(s.getMentions());
        if (ids.isEmpty()) return;
        String author = userRepository.findById(authorId)
                .map(User::getDisplayName).orElse("Someone");
        String preview = s.getCaption() == null || s.getCaption().isBlank()
                ? "mentioned you in their status"
                : "mentioned you in their status: " + s.getCaption();
        for (Long uid : ids) {
            if (Objects.equals(uid, authorId)) continue;
            // refId stays null: a status id is not a conversation id, and the
            // client turns a non-null ref into a "open this chat" link.
            notificationService.notifyUser(uid, "STATUS_MENTION", author, preview, null);
        }
    }

    /**
     * Every user these statuses refer to — the people they @mention, plus the
     * original author of anything that was added from someone else's status — in
     * ONE query, so neither feature puts an N+1 in the feed.
     */
    private Map<Long, User> relatedUsers(List<Status> statuses) {
        Set<Long> ids = new HashSet<>();
        for (Status s : statuses) {
            ids.addAll(decodeMentions(s.getMentions()));
            if (s.getOriginalUserId() != null) ids.add(s.getOriginalUserId());
        }
        if (ids.isEmpty()) return Map.of();
        return userRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(User::getId, u -> u));
    }

    /** Statuses from me + my contacts + everyone I share a conversation with. */
    @Transactional(readOnly = true)
    public List<StatusUserDto> feed(Long me) {
        Set<Long> visible = new HashSet<>();
        visible.add(me);
        contactRepository.findByOwnerIdOrderByIdDesc(me)
                .forEach(c -> visible.add(c.getContactUserId()));
        visible.addAll(memberRepository.findConnectedUserIds(me));
        // A block hides statuses both ways: I don't see people I've blocked, and
        // people who've blocked me don't see mine (messenger-style).
        visible.removeAll(blockService.blockRelatedUserIds(me));
        visible.add(me);

        List<Status> statuses = statusRepository
                .findByUserIdInAndExpiresAtAfterOrderByCreatedAtAsc(visible, Instant.now());
        if (statuses.isEmpty()) {
            return List.of();
        }

        List<Long> ids = statuses.stream().map(Status::getId).toList();
        Set<Long> viewedByMe = viewRepository.findByViewerIdAndStatusIdIn(me, ids).stream()
                .map(StatusView::getStatusId).collect(Collectors.toSet());
        Map<Long, User> users = userRepository.findAllById(visible).stream()
                .collect(Collectors.toMap(User::getId, u -> u));
        // Everyone the feed refers to (mentions + original authors), in one query.
        Map<Long, User> related = relatedUsers(statuses);

        // Which statuses have I already added to mine? My own statuses are part of
        // this very feed, and a status only lives 24h — so the answer is already in
        // memory and costs no query.
        Set<Long> alreadyAdded = statuses.stream()
                .filter(s -> Objects.equals(s.getUserId(), me))
                .map(Status::getOriginalStatusId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        // View counts for MY statuses, in ONE grouped query. This used to be a
        // COUNT(*) per status inside the render loop.
        List<Long> myStatusIds = statuses.stream()
                .filter(s -> Objects.equals(s.getUserId(), me))
                .map(Status::getId)
                .toList();
        Map<Long, Long> viewCounts = new HashMap<>();
        if (!myStatusIds.isEmpty()) {
            for (Object[] row : viewRepository.countByStatusIdIn(myStatusIds)) {
                viewCounts.put((Long) row[0], (Long) row[1]);
            }
        }

        Map<Long, List<Status>> byUser = new LinkedHashMap<>();
        for (Status s : statuses) {
            byUser.computeIfAbsent(s.getUserId(), k -> new ArrayList<>()).add(s);
        }

        // Drop owners whose status-privacy setting excludes me.
        Set<Long> allowedOwners = ownersVisibleTo(byUser.keySet(), me);

        List<StatusUserDto> result = new ArrayList<>();
        for (var e : byUser.entrySet()) {
            User u = users.get(e.getKey());
            if (u == null) continue;
            if (!allowedOwners.contains(e.getKey())) continue;
            boolean isMe = Objects.equals(e.getKey(), me);
            List<StatusItemDto> items = new ArrayList<>();
            boolean allViewed = true;
            for (Status s : e.getValue()) {
                boolean viewed = isMe || viewedByMe.contains(s.getId());
                if (!viewed) allViewed = false;
                long count = isMe ? viewCounts.getOrDefault(s.getId(), 0L) : 0;
                items.add(toItem(s, viewed, count, related, canAdd(s, me, alreadyAdded)));
            }
            result.add(new StatusUserDto(UserDto.from(u), isMe, allViewed, items));
        }

        // Me first, then users with unseen updates, then seen — each by recency.
        result.sort((a, b) -> {
            if (a.me() != b.me()) return a.me() ? -1 : 1;
            if (a.allViewed() != b.allViewed()) return a.allViewed() ? 1 : -1;
            Instant la = a.items().get(a.items().size() - 1).createdAt();
            Instant lb = b.items().get(b.items().size() - 1).createdAt();
            return lb.compareTo(la);
        });
        return result;
    }

    @Transactional
    public void markViewed(Long me, Long statusId) {
        Status s = statusRepository.findById(statusId)
                .orElseThrow(() -> ApiException.notFound("Status not found"));
        if (Objects.equals(s.getUserId(), me)) return; // never record own views
        // A blocked relationship (either direction) can't view the status.
        if (blockService.blockRelatedUserIds(me).contains(s.getUserId())) {
            throw ApiException.forbidden("You can't view this status");
        }
        // The owner's privacy setting may hide it from me.
        if (!canSeeStatus(s.getUserId(), me)) {
            throw ApiException.forbidden("You can't view this status");
        }
        if (!viewRepository.existsByStatusIdAndViewerId(statusId, me)) {
            StatusView v = new StatusView();
            v.setStatusId(statusId);
            v.setViewerId(me);
            viewRepository.save(v);
        }
    }

    /**
     * Reply or react to a status. Delivered as a normal chat message in the 1:1
     * conversation with the status owner, carrying a snapshot of the status so
     * the recipient sees what it answers (messenger-style).
     */
    @Transactional
    public void reply(Long me, Long statusId, StatusReplyRequest req) {
        Status s = statusRepository.findById(statusId)
                .orElseThrow(() -> ApiException.notFound("Status not found"));
        Long owner = s.getUserId();
        if (Objects.equals(owner, me)) {
            throw ApiException.badRequest("You can't reply to your own status");
        }
        if (blockService.blockRelatedUserIds(me).contains(owner)) {
            throw ApiException.forbidden("You can't reply to this status");
        }
        if (!canSeeStatus(owner, me)) {
            throw ApiException.forbidden("You can't reply to this status");
        }
        String emoji = req == null ? null : blankToNull(req.emoji());
        String text = req == null ? null : blankToNull(req.text());
        // An emoji-only reaction sends the emoji as the message body.
        String content = text != null ? text : emoji;
        if (content == null) {
            throw ApiException.badRequest("Reply cannot be empty");
        }

        Conversation c = chatService.getOrCreateDirect(me, owner);
        Message saved = chatService.persistStatusReply(me, c.getId(), content, s.getId(),
                s.getType().name(), s.getMediaUrl(), s.getCaption(), s.getBgColor());
        MessageDto dto = chatService.toMessageDto(saved, (String) null);

        List<Long> members = chatService.memberUserIds(c.getId());
        List<Long> deliverable = blockService.filterDeliverable(me, members);
        chatBroadcaster.sendMessageToMembers(dto, deliverable);
        chatEventPublisher.publishMessage(dto);
        notificationService.notifyNewMessage(dto, deliverable, me);
    }

    @Transactional(readOnly = true)
    public List<StatusViewerDto> viewers(Long me, Long statusId) {
        Status s = statusRepository.findById(statusId)
                .orElseThrow(() -> ApiException.notFound("Status not found"));
        if (!Objects.equals(s.getUserId(), me)) {
            throw ApiException.forbidden("You can only see views on your own status");
        }
        List<StatusView> views = viewRepository.findByStatusIdOrderByViewedAtDesc(statusId);
        Map<Long, User> users = userRepository
                .findAllById(views.stream().map(StatusView::getViewerId).toList()).stream()
                .collect(Collectors.toMap(User::getId, u -> u));
        return views.stream()
                .filter(v -> users.containsKey(v.getViewerId()))
                .map(v -> new StatusViewerDto(UserDto.from(users.get(v.getViewerId())), v.getViewedAt()))
                .toList();
    }

    @Transactional
    public void delete(Long me, Long statusId) {
        Status s = statusRepository.findById(statusId)
                .orElseThrow(() -> ApiException.notFound("Status not found"));
        if (!Objects.equals(s.getUserId(), me)) {
            throw ApiException.forbidden("Not your status");
        }
        statusRepository.delete(s);
    }

    // ── Status privacy ──

    @Transactional(readOnly = true)
    public StatusPrivacyDto getPrivacy(Long me) {
        StatusPrivacy.Mode mode = privacyRepository.findById(me)
                .map(StatusPrivacy::getMode).orElse(StatusPrivacy.Mode.ALL);
        List<Long> userIds = privacyUserRepository.findByOwnerId(me).stream()
                .map(StatusPrivacyUser::getTargetUserId).toList();
        return new StatusPrivacyDto(mode.name(), userIds);
    }

    @Transactional
    public StatusPrivacyDto setPrivacy(Long me, StatusPrivacyDto req) {
        StatusPrivacy.Mode mode;
        try {
            mode = StatusPrivacy.Mode.valueOf(req.mode() == null ? "ALL" : req.mode().toUpperCase());
        } catch (Exception e) {
            throw ApiException.badRequest("Invalid privacy mode");
        }
        StatusPrivacy setting = privacyRepository.findById(me).orElseGet(() -> {
            StatusPrivacy p = new StatusPrivacy();
            p.setUserId(me);
            return p;
        });
        setting.setMode(mode);
        privacyRepository.save(setting);

        // Replace the chosen-user list. ALL keeps no list.
        privacyUserRepository.deleteByOwnerId(me);
        if (mode != StatusPrivacy.Mode.ALL && req.userIds() != null) {
            for (Long uid : new LinkedHashSet<>(req.userIds())) {
                if (uid == null || Objects.equals(uid, me)) continue;
                StatusPrivacyUser spu = new StatusPrivacyUser();
                spu.setOwnerId(me);
                spu.setTargetUserId(uid);
                privacyUserRepository.save(spu);
            }
        }
        return getPrivacy(me);
    }

    /** Owners (from the set) whose privacy setting lets {@code viewer} see them. */
    private Set<Long> ownersVisibleTo(Collection<Long> ownerIds, Long viewer) {
        Map<Long, StatusPrivacy.Mode> modes = privacyRepository.findAllById(ownerIds).stream()
                .collect(Collectors.toMap(StatusPrivacy::getUserId, StatusPrivacy::getMode));
        Map<Long, Set<Long>> targets = new HashMap<>();
        for (StatusPrivacyUser spu : privacyUserRepository.findByOwnerIdIn(ownerIds)) {
            targets.computeIfAbsent(spu.getOwnerId(), k -> new HashSet<>()).add(spu.getTargetUserId());
        }
        Set<Long> ok = new HashSet<>();
        for (Long owner : ownerIds) {
            if (Objects.equals(owner, viewer) || isVisible(
                    modes.getOrDefault(owner, StatusPrivacy.Mode.ALL),
                    targets.getOrDefault(owner, Set.of()), viewer)) {
                ok.add(owner);
            }
        }
        return ok;
    }

    /** Whether {@code viewer} may see {@code ownerId}'s statuses. */
    private boolean canSeeStatus(Long ownerId, Long viewer) {
        if (Objects.equals(ownerId, viewer)) return true;
        StatusPrivacy.Mode mode = privacyRepository.findById(ownerId)
                .map(StatusPrivacy::getMode).orElse(StatusPrivacy.Mode.ALL);
        if (mode == StatusPrivacy.Mode.ALL) return true;
        Set<Long> list = privacyUserRepository.findByOwnerId(ownerId).stream()
                .map(StatusPrivacyUser::getTargetUserId).collect(Collectors.toSet());
        return isVisible(mode, list, viewer);
    }

    private static boolean isVisible(StatusPrivacy.Mode mode, Set<Long> chosen, Long viewer) {
        return switch (mode) {
            case ALL -> true;
            case EXCEPT -> !chosen.contains(viewer);
            case ONLY -> chosen.contains(viewer);
        };
    }

    /**
     * May {@code me} add this status to their own? Only if it isn't mine, it tags
     * me, and I haven't added it already (which is also re-checked, authoritatively,
     * in {@link #addToMyStatus}).
     */
    private boolean canAdd(Status s, Long me, Set<Long> alreadyAdded) {
        if (Objects.equals(s.getUserId(), me)) return false;
        if (!decodeMentions(s.getMentions()).contains(me)) return false;
        Long root = s.getOriginalStatusId() != null ? s.getOriginalStatusId() : s.getId();
        if (Objects.equals(s.getOriginalUserId(), me)) return false; // my own, shared back to me
        return !alreadyAdded.contains(root);
    }

    private StatusItemDto toItem(Status s, boolean viewed, long count,
                                 Map<Long, User> related, boolean canAdd) {
        List<UserDto> mentions = decodeMentions(s.getMentions()).stream()
                .map(related::get)
                .filter(Objects::nonNull)
                .map(UserDto::from)
                .toList();
        User origin = s.getOriginalUserId() == null ? null : related.get(s.getOriginalUserId());
        return new StatusItemDto(s.getId(), s.getType().name(), s.getMediaUrl(), readAlbum(s),
                s.getCaption(), s.getBgColor(), s.getMusicUrl(), s.getMusicTitle(), s.getMusicArtist(),
                s.getMusicDurationMs(), s.getMusicStartMs(), s.getCreatedAt(), viewed, count, mentions,
                origin == null ? null : UserDto.from(origin), canAdd);
    }

    /** Bound the album so one status can't carry an unbounded media list. */
    private static final int MAX_ALBUM = 20;

    /** Keep the well-formed items, normalise each type to IMAGE/VIDEO, cap the size. */
    private List<StatusMediaDto> normalizeAlbum(List<StatusMediaDto> media) {
        if (media == null || media.isEmpty()) return List.of();
        List<StatusMediaDto> out = new ArrayList<>();
        for (StatusMediaDto m : media) {
            if (m == null || isBlank(m.url())) continue;
            String type = "VIDEO".equalsIgnoreCase(m.type()) ? "VIDEO" : "IMAGE";
            out.add(new StatusMediaDto(m.url().trim(), type));
            if (out.size() >= MAX_ALBUM) break;
        }
        return out;
    }

    private String writeAlbum(List<StatusMediaDto> album) {
        try {
            return objectMapper.writeValueAsString(album);
        } catch (Exception e) {
            return null; // fall back to the single mediaUrl rather than fail the post
        }
    }

    /**
     * The status's media as a list — always at least one item for a media status.
     * Reads the stored album JSON when present, otherwise synthesises a one-item
     * list from mediaUrl. TEXT statuses have no media (empty list).
     */
    private List<StatusMediaDto> readAlbum(Status s) {
        String json = s.getMediaJson();
        if (json != null && !json.isBlank()) {
            try {
                List<StatusMediaDto> list =
                        objectMapper.readValue(json, new TypeReference<List<StatusMediaDto>>() {});
                if (list != null && !list.isEmpty()) return list;
            } catch (Exception ignored) {
                // corrupt JSON — fall through to the single-URL view
            }
        }
        if (s.getMediaUrl() != null) {
            return List.of(new StatusMediaDto(s.getMediaUrl(), s.getType().name()));
        }
        return List.of();
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private static String blankToNull(String s) {
        return isBlank(s) ? null : s.trim();
    }
}
