package com.chatsphere.user;

import com.chatsphere.common.error.ApiException;
import com.chatsphere.common.util.QrTokens;
import com.chatsphere.user.dto.InviteDto;
import com.chatsphere.user.dto.QrDto;
import com.chatsphere.user.dto.UpdateProfileRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class UserService {

    private final UserRepository userRepository;

    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public User getById(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("User not found: " + id));
    }

    @Transactional(readOnly = true)
    public List<User> search(String query, Long excludeUserId) {
        if (query == null || query.isBlank()) {
            return List.of();
        }
        return userRepository.search(query.trim(), excludeUserId);
    }

    /** The current user's QR token + the payload their QR image should encode. */
    @Transactional(readOnly = true)
    public QrDto myQr(Long userId) {
        User u = getById(userId);
        return new QrDto(u.getQrToken(), QrTokens.payload(u.getQrToken()));
    }

    /** Issue a fresh QR token, invalidating any previously shared code. */
    @Transactional
    public QrDto rotateQr(Long userId) {
        User u = getById(userId);
        u.setQrToken(QrTokens.newToken());
        userRepository.save(u);
        return new QrDto(u.getQrToken(), QrTokens.payload(u.getQrToken()));
    }

    /**
     * The short code behind my shareable invite link. Minted on first use, so
     * existing accounts get one without a backfill.
     */
    @Transactional
    public InviteDto myInvite(Long userId) {
        User u = getById(userId);
        if (u.getInviteCode() == null || u.getInviteCode().isBlank()) {
            u.setInviteCode(freshInviteCode());
            userRepository.save(u);
        }
        return new InviteDto(u.getInviteCode());
    }

    /** Issue a new invite code — any link already shared stops working. */
    @Transactional
    public InviteDto rotateInvite(Long userId) {
        User u = getById(userId);
        u.setInviteCode(freshInviteCode());
        userRepository.save(u);
        return new InviteDto(u.getInviteCode());
    }

    /** A code nobody else holds. Collisions are vanishingly rare, but cheap to retry. */
    private String freshInviteCode() {
        for (int i = 0; i < 10; i++) {
            String code = QrTokens.newInviteCode();
            if (!userRepository.existsByInviteCode(code)) return code;
        }
        throw ApiException.badRequest("Could not allocate an invite code, please retry");
    }

    @Transactional
    public User updateProfile(Long userId, UpdateProfileRequest req) {
        User user = getById(userId);
        if (req.displayName() != null && !req.displayName().isBlank()) {
            user.setDisplayName(req.displayName());
        }
        if (req.about() != null) {
            user.setAbout(req.about());
        }
        if (req.avatarUrl() != null) {
            // Empty string is an explicit "remove my picture"; null = leave unchanged.
            user.setAvatarUrl(req.avatarUrl().isBlank() ? null : req.avatarUrl());
        }
        if (req.protectAvatar() != null) {
            user.setProtectAvatar(req.protectAvatar());
        }
        return userRepository.save(user);
    }
}
