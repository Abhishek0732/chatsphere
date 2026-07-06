package com.chatsphere.block;

import com.chatsphere.common.security.SecurityUtils;
import com.chatsphere.user.dto.UserDto;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/blocks")
public class BlockController {

    private final BlockService blockService;

    public BlockController(BlockService blockService) {
        this.blockService = blockService;
    }

    /** Users I have blocked. */
    @GetMapping
    public List<UserDto> list() {
        return blockService.listBlocked(SecurityUtils.currentUserId());
    }

    @PostMapping("/{userId}")
    public ResponseEntity<Void> block(@PathVariable Long userId) {
        blockService.block(SecurityUtils.currentUserId(), userId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{userId}")
    public ResponseEntity<Void> unblock(@PathVariable Long userId) {
        blockService.unblock(SecurityUtils.currentUserId(), userId);
        return ResponseEntity.noContent().build();
    }
}
