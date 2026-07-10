package com.chatsphere.user;

import com.chatsphere.common.error.ApiException;
import com.chatsphere.common.util.QrTokens;
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
