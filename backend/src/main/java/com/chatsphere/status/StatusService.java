package com.chatsphere.status;

import com.chatsphere.block.BlockService;
import com.chatsphere.chat.repo.ConversationMemberRepository;
import com.chatsphere.common.error.ApiException;
import com.chatsphere.contact.ContactRepository;
import com.chatsphere.status.dto.StatusDtos.*;
import com.chatsphere.user.User;
import com.chatsphere.user.UserRepository;
import com.chatsphere.user.dto.UserDto;
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

    public StatusService(StatusRepository statusRepository,
                         StatusViewRepository viewRepository,
                         ContactRepository contactRepository,
                         ConversationMemberRepository memberRepository,
                         UserRepository userRepository,
                         BlockService blockService) {
        this.statusRepository = statusRepository;
        this.viewRepository = viewRepository;
        this.contactRepository = contactRepository;
        this.memberRepository = memberRepository;
        this.userRepository = userRepository;
        this.blockService = blockService;
    }

    @Transactional
    public StatusItemDto create(Long userId, CreateStatusRequest req) {
        Status.Type type;
        try {
            type = Status.Type.valueOf(req.type().toUpperCase());
        } catch (Exception e) {
            throw ApiException.badRequest("Invalid status type");
        }
        if (type != Status.Type.TEXT && isBlank(req.mediaUrl())) {
            throw ApiException.badRequest("Media is required");
        }
        if (type == Status.Type.TEXT && isBlank(req.caption())) {
            throw ApiException.badRequest("Text is required");
        }
        Status s = new Status();
        s.setUserId(userId);
        s.setType(type);
        s.setMediaUrl(blankToNull(req.mediaUrl()));
        s.setCaption(blankToNull(req.caption()));
        s.setBgColor(blankToNull(req.bgColor()));
        s.setMusicUrl(blankToNull(req.musicUrl()));
        s.setExpiresAt(Instant.now().plus(24, ChronoUnit.HOURS));
        return toItem(statusRepository.save(s), true, 0);
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
        // people who've blocked me don't see mine (WhatsApp-style).
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

        Map<Long, List<Status>> byUser = new LinkedHashMap<>();
        for (Status s : statuses) {
            byUser.computeIfAbsent(s.getUserId(), k -> new ArrayList<>()).add(s);
        }

        List<StatusUserDto> result = new ArrayList<>();
        for (var e : byUser.entrySet()) {
            User u = users.get(e.getKey());
            if (u == null) continue;
            boolean isMe = Objects.equals(e.getKey(), me);
            List<StatusItemDto> items = new ArrayList<>();
            boolean allViewed = true;
            for (Status s : e.getValue()) {
                boolean viewed = isMe || viewedByMe.contains(s.getId());
                if (!viewed) allViewed = false;
                long count = isMe ? viewRepository.countByStatusId(s.getId()) : 0;
                items.add(toItem(s, viewed, count));
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
        if (!viewRepository.existsByStatusIdAndViewerId(statusId, me)) {
            StatusView v = new StatusView();
            v.setStatusId(statusId);
            v.setViewerId(me);
            viewRepository.save(v);
        }
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

    private StatusItemDto toItem(Status s, boolean viewed, long count) {
        return new StatusItemDto(s.getId(), s.getType().name(), s.getMediaUrl(), s.getCaption(),
                s.getBgColor(), s.getMusicUrl(), s.getCreatedAt(), viewed, count);
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private static String blankToNull(String s) {
        return isBlank(s) ? null : s.trim();
    }
}
