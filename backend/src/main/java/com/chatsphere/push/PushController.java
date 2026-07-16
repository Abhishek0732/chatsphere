package com.chatsphere.push;

import com.chatsphere.common.error.ApiException;
import com.chatsphere.common.security.SecurityUtils;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/push")
public class PushController {

    private final PushService pushService;
    private final PushSubscriptionRepository repository;
    private final PushSubscribers subscribers;

    public PushController(PushService pushService,
                          PushSubscriptionRepository repository,
                          PushSubscribers subscribers) {
        this.pushService = pushService;
        this.repository = repository;
        this.subscribers = subscribers;
    }

    /**
     * The VAPID public key the browser needs in order to subscribe, plus whether
     * push is switched on at all — the client uses this to decide whether to even
     * ask for notification permission.
     */
    @GetMapping("/key")
    public Map<String, Object> key() {
        return Map.of("enabled", pushService.isEnabled(), "publicKey", pushService.publicKey());
    }

    /**
     * Send a test notification to the caller's own devices so they can confirm
     * OS notifications actually arrive when the app isn't focused. Returns how
     * many devices are registered — 0 means "turn notifications on first".
     */
    @PostMapping("/test")
    public Map<String, Object> test() {
        Long me = SecurityUtils.currentUserId();
        int devices = repository.findByUserIdIn(java.util.List.of(me)).size();
        if (devices > 0) pushService.pushTest(me);
        return Map.of("enabled", pushService.isEnabled(), "devices", devices);
    }

    public record SubscribeRequest(String endpoint, String p256dh, String auth) {}

    /**
     * Register (or re-register) this browser. Keyed on the endpoint, so logging in
     * again on the same browser moves the existing subscription to the current user
     * instead of leaving a second row that would push to the wrong person.
     */
    @PostMapping("/subscribe")
    @Transactional
    public ResponseEntity<Void> subscribe(@RequestBody SubscribeRequest req) {
        if (req == null || isBlank(req.endpoint()) || isBlank(req.p256dh()) || isBlank(req.auth())) {
            throw ApiException.badRequest("Invalid push subscription");
        }
        Long me = SecurityUtils.currentUserId();
        PushSubscription sub = repository.findByEndpoint(req.endpoint())
                .orElseGet(PushSubscription::new);
        sub.setUserId(me);
        sub.setEndpoint(req.endpoint());
        sub.setP256dh(req.p256dh());
        sub.setAuth(req.auth());
        repository.save(sub);
        // The send path asks Redis (not the DB) whether a recipient has push at all.
        subscribers.remember(me);
        return ResponseEntity.noContent().build();
    }

    /** Called on logout / when the user turns notifications off. */
    @PostMapping("/unsubscribe")
    @Transactional
    public ResponseEntity<Void> unsubscribe(@RequestBody SubscribeRequest req) {
        if (req != null && !isBlank(req.endpoint())) {
            repository.findByEndpoint(req.endpoint())
                    .filter(s -> s.getUserId().equals(SecurityUtils.currentUserId()))
                    .ifPresent(s -> {
                        repository.deleteByEndpoint(s.getEndpoint());
                        subscribers.forgetIfLast(s.getUserId());
                    });
        }
        return ResponseEntity.noContent().build();
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
