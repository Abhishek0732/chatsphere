package com.chatsphere.user;

import com.chatsphere.common.security.SecurityUtils;
import com.chatsphere.presence.PresenceService;
import com.chatsphere.user.dto.DeleteAccountRequest;
import com.chatsphere.user.dto.InviteDto;
import com.chatsphere.user.dto.QrDto;
import com.chatsphere.user.dto.UpdateProfileRequest;
import com.chatsphere.user.dto.UserDto;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;
    private final PresenceService presenceService;
    private final AccountDeletionService accountDeletionService;

    public UserController(UserService userService,
                          PresenceService presenceService,
                          AccountDeletionService accountDeletionService) {
        this.accountDeletionService = accountDeletionService;
        this.userService = userService;
        this.presenceService = presenceService;
    }

    @GetMapping("/me")
    public UserDto me() {
        return UserDto.from(userService.getById(SecurityUtils.currentUserId()));
    }

    @PutMapping("/me")
    public UserDto updateMe(@Valid @RequestBody UpdateProfileRequest req) {
        return UserDto.from(userService.updateProfile(SecurityUtils.currentUserId(), req));
    }

    @GetMapping("/me/qr")
    public QrDto myQr() {
        return userService.myQr(SecurityUtils.currentUserId());
    }

    @PostMapping("/me/qr/rotate")
    public QrDto rotateQr() {
        return userService.rotateQr(SecurityUtils.currentUserId());
    }

    /**
     * Delete my account, for good. The person's messages stay in other people's
     * chats (as "Deleted user") — one person's decision must not tear holes in
     * someone else's history — but the account is closed, anonymised, and its
     * username/email are retired so they can never be registered again.
     */
    @DeleteMapping("/me")
    public ResponseEntity<Void> deleteMe(@Valid @RequestBody DeleteAccountRequest req) {
        accountDeletionService.deleteOwnAccount(SecurityUtils.currentUserId(), req.password());
        return ResponseEntity.noContent().build();
    }

    /** The short code behind my shareable invite link (/i/<code>). */
    @GetMapping("/me/invite")
    public InviteDto myInvite() {
        return userService.myInvite(SecurityUtils.currentUserId());
    }

    /** Issue a new invite code — any link already shared stops working. */
    @PostMapping("/me/invite/rotate")
    public InviteDto rotateInvite() {
        return userService.rotateInvite(SecurityUtils.currentUserId());
    }

    @GetMapping
    public List<UserDto> search(@RequestParam(name = "search", required = false) String search) {
        Long me = SecurityUtils.currentUserId();
        return userService.search(search, me).stream()
                .map(u -> UserDto.from(u, presenceService.isOnline(u.getId()),
                        presenceService.lastSeen(u.getId())))
                .toList();
    }

    @GetMapping("/{id}")
    public UserDto byId(@PathVariable Long id) {
        var u = userService.getById(id);
        return UserDto.from(u, presenceService.isOnline(id), presenceService.lastSeen(id));
    }
}
