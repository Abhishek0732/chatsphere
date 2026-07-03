package com.chatsphere.user;

import com.chatsphere.common.security.SecurityUtils;
import com.chatsphere.presence.PresenceService;
import com.chatsphere.user.dto.UpdateProfileRequest;
import com.chatsphere.user.dto.UserDto;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;
    private final PresenceService presenceService;

    public UserController(UserService userService, PresenceService presenceService) {
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
