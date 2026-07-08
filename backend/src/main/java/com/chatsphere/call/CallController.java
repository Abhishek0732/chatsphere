package com.chatsphere.call;

import com.chatsphere.call.dto.CallDtos.ActiveCallDto;
import com.chatsphere.call.dto.CallDtos.CallHistoryDto;
import com.chatsphere.call.dto.CallDtos.CallTokenDto;
import com.chatsphere.call.dto.CallDtos.RegisterDeviceRequest;
import com.chatsphere.common.security.SecurityUtils;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/** REST surface for call history, missed-count, resume-on-reconnect, and device registration. */
@RestController
@RequestMapping("/api/calls")
public class CallController {

    private final CallService callService;
    private final CallMediaService mediaService;

    public CallController(CallService callService, CallMediaService mediaService) {
        this.callService = callService;
        this.mediaService = mediaService;
    }

    /** Mint this participant's LiveKit token + ICE servers to join the media room. */
    @GetMapping("/{callId}/token")
    public CallTokenDto token(@PathVariable String callId) {
        return mediaService.tokenFor(SecurityUtils.currentUserId(), callId);
    }

    /** The caller's current live call, or 204 if none — used to resume after a socket drop. */
    @GetMapping("/active")
    public ResponseEntity<ActiveCallDto> active() {
        ActiveCallDto active = callService.activeCall(SecurityUtils.currentUserId());
        return active == null ? ResponseEntity.noContent().build() : ResponseEntity.ok(active);
    }

    @GetMapping
    public List<CallHistoryDto> history(@RequestParam(defaultValue = "0") int page,
                                        @RequestParam(defaultValue = "30") int size) {
        return callService.history(SecurityUtils.currentUserId(), page, Math.min(size, 100));
    }

    @GetMapping("/missed/count")
    public Map<String, Long> missedCount() {
        return Map.of("count", callService.missedCount(SecurityUtils.currentUserId()));
    }

    @PostMapping("/devices")
    public ResponseEntity<Void> registerDevice(@RequestBody RegisterDeviceRequest req) {
        callService.registerDevice(SecurityUtils.currentUserId(), req);
        return ResponseEntity.noContent().build();
    }
}
