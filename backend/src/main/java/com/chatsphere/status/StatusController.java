package com.chatsphere.status;

import com.chatsphere.common.security.SecurityUtils;
import com.chatsphere.status.dto.StatusDtos.*;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/status")
public class StatusController {

    private final StatusService statusService;

    public StatusController(StatusService statusService) {
        this.statusService = statusService;
    }

    /** Status feed: me first, then contacts / people I chat with. */
    @GetMapping
    public List<StatusUserDto> feed() {
        return statusService.feed(SecurityUtils.currentUserId());
    }

    @PostMapping
    public StatusItemDto create(@Valid @RequestBody CreateStatusRequest req) {
        return statusService.create(SecurityUtils.currentUserId(), req);
    }

    @PostMapping("/{id}/view")
    public ResponseEntity<Void> markViewed(@PathVariable Long id) {
        statusService.markViewed(SecurityUtils.currentUserId(), id);
        return ResponseEntity.noContent().build();
    }

    /** Who viewed my status (owner only). */
    @GetMapping("/{id}/views")
    public List<StatusViewerDto> views(@PathVariable Long id) {
        return statusService.viewers(SecurityUtils.currentUserId(), id);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        statusService.delete(SecurityUtils.currentUserId(), id);
        return ResponseEntity.noContent().build();
    }
}
