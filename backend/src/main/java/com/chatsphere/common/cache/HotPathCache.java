package com.chatsphere.common.cache;

import com.chatsphere.user.User;
import com.chatsphere.user.UserRepository;
import com.chatsphere.chat.domain.ConversationMember;
import com.chatsphere.chat.repo.ConversationMemberRepository;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * The send path used to run ~13 SQL queries for ONE message: the member list was
 * loaded three separate times, the users behind it twice, and the sender once
 * more — every time anybody said anything. With 400 people chatting at once that
 * queued up and messages took over THREE SECONDS to arrive.
 *
 * Almost none of it changes between messages, so it is cached here:
 *  - who is in a conversation (invalidated whenever membership changes),
 *  - a user's username / display name / deleted flag.
 *
 * Both are per-instance and short-lived. Membership is invalidated explicitly on
 * every join/leave, so it cannot go stale; the user entries expire on a timer,
 * which is fine for a display name and a deleted flag.
 */
@Component
public class HotPathCache {

    private static final Duration MEMBERS_TTL = Duration.ofMinutes(5);
    private static final Duration USER_TTL = Duration.ofMinutes(5);
    /** Stops the caches growing without bound on a long-lived instance. */
    private static final int MAX_ENTRIES = 50_000;

    /** The bits of a user the send path actually needs. */
    public record UserBrief(Long id, String username, String displayName, boolean deleted) {}

    private record Entry<T>(T value, Instant expiresAt) {
        boolean live() {
            return Instant.now().isBefore(expiresAt);
        }
    }

    private final Map<Long, Entry<List<Long>>> members = new ConcurrentHashMap<>();
    private final Map<Long, Entry<UserBrief>> users = new ConcurrentHashMap<>();

    private final ConversationMemberRepository memberRepository;
    private final UserRepository userRepository;

    public HotPathCache(ConversationMemberRepository memberRepository, UserRepository userRepository) {
        this.memberRepository = memberRepository;
        this.userRepository = userRepository;
    }

    /** Member user ids of a conversation. */
    public List<Long> memberIds(Long conversationId) {
        Entry<List<Long>> hit = members.get(conversationId);
        if (hit != null && hit.live()) return hit.value();

        List<Long> ids = memberRepository.findByConversationId(conversationId).stream()
                .map(ConversationMember::getUserId)
                .toList();
        if (members.size() > MAX_ENTRIES) members.clear();
        members.put(conversationId, new Entry<>(ids, Instant.now().plus(MEMBERS_TTL)));
        return ids;
    }

    /** Someone joined or left — the cached roster is wrong from this moment on. */
    public void invalidateMembers(Long conversationId) {
        members.remove(conversationId);
    }

    /** Usernames / display names / deleted flags, loading only what's missing. */
    public Map<Long, UserBrief> briefs(Collection<Long> userIds) {
        Map<Long, UserBrief> out = new HashMap<>();
        List<Long> missing = new ArrayList<>();
        for (Long id : userIds) {
            Entry<UserBrief> hit = users.get(id);
            if (hit != null && hit.live()) {
                out.put(id, hit.value());
            } else {
                missing.add(id);
            }
        }
        if (!missing.isEmpty()) {
            if (users.size() > MAX_ENTRIES) users.clear();
            for (User u : userRepository.findAllById(missing)) {
                UserBrief b = new UserBrief(u.getId(), u.getUsername(), u.getDisplayName(),
                        u.getDeletedAt() != null);
                users.put(u.getId(), new Entry<>(b, Instant.now().plus(USER_TTL)));
                out.put(u.getId(), b);
            }
        }
        return out;
    }

    public UserBrief brief(Long userId) {
        return briefs(List.of(userId)).get(userId);
    }

    /** A rename, a photo change or a deletion must not be served from a stale entry. */
    public void invalidateUser(Long userId) {
        users.remove(userId);
    }
}
