package com.chatsphere.push;

import com.fasterxml.jackson.databind.ObjectMapper;
import nl.martijndwars.webpush.Notification;
import org.apache.http.HttpResponse;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.Security;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Map;

/**
 * Sends a Web Push message to a user's registered browsers.
 *
 * This is what makes a notification arrive when the app is CLOSED. Everything
 * else in the system announces a message over the open WebSocket, which by
 * definition only reaches somebody who is already looking at the app.
 *
 * If no VAPID keys are configured the whole thing quietly disables itself — the
 * app must still run for anyone who has not set them up.
 */
@Service
public class PushService {

    private static final Logger log = LoggerFactory.getLogger(PushService.class);

    /** Anything longer is pointless in a notification body — and it is encrypted per device. */
    private static final int MAX_BODY = 180;

    private final PushSubscriptionRepository repository;
    private final PushSubscribers subscriberFilter;
    private final ObjectMapper mapper;
    private final String publicKey;
    private final nl.martijndwars.webpush.PushService pushService;

    public PushService(PushSubscriptionRepository repository,
                       PushSubscribers subscriberFilter,
                       ObjectMapper mapper,
                       @Value("${chatsphere.push.vapid.public-key:}") String publicKey,
                       @Value("${chatsphere.push.vapid.private-key:}") String privateKey,
                       @Value("${chatsphere.push.vapid.subject:mailto:admin@chatsphere.dev}") String subject) {
        this.repository = repository;
        this.subscriberFilter = subscriberFilter;
        this.mapper = mapper;
        this.publicKey = publicKey == null ? "" : publicKey.trim();

        nl.martijndwars.webpush.PushService svc = null;
        if (!this.publicKey.isEmpty() && privateKey != null && !privateKey.isBlank()) {
            try {
                // The payload encryption is elliptic-curve; the JDK provider does not
                // do what the Web Push spec needs, so BouncyCastle is registered here.
                if (Security.getProvider(BouncyCastleProvider.PROVIDER_NAME) == null) {
                    Security.addProvider(new BouncyCastleProvider());
                }
                svc = new nl.martijndwars.webpush.PushService(this.publicKey, privateKey.trim(), subject);
                log.info("Web Push enabled");
            } catch (Exception e) {
                log.warn("Web Push disabled: could not initialise VAPID keys ({})", e.getMessage());
            }
        } else {
            log.info("Web Push disabled: no VAPID keys configured "
                    + "(set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY to enable)");
        }
        this.pushService = svc;
    }

    public boolean isEnabled() {
        return pushService != null;
    }

    /** The key the browser needs to subscribe. Empty when push is off. */
    public String publicKey() {
        return isEnabled() ? publicKey : "";
    }

    /**
     * Push to every device of every one of these users.
     *
     * {@code @Async} because a push is an HTTPS round trip to Google/Mozilla/Apple:
     * it must never sit between a sender pressing Enter and their message being
     * delivered. Sending is best-effort — a push that fails is not a message that
     * failed.
     */
    @Async
    @Transactional
    public void pushToUsers(Collection<Long> userIds, String title, String body, String url) {
        if (!isEnabled() || userIds == null || userIds.isEmpty()) return;

        // Almost nobody has enabled push, but EVERY message to an offline recipient
        // was asking the database whether they had. At lakh scale that is a query per
        // message for a row that is almost never there. A Redis set of the user ids
        // that actually have a subscription answers it in microseconds, and the
        // database is only touched for the few who do.
        List<Long> subscribers = subscriberFilter.subscribersAmong(userIds);
        if (subscribers.isEmpty()) return;

        List<PushSubscription> subs = repository.findByUserIdIn(subscribers);
        if (subs.isEmpty()) return;

        String payload;
        try {
            String safe = body == null ? "" : body;
            payload = mapper.writeValueAsString(Map.of(
                    "title", title == null ? "ChatSphere" : title,
                    "body", safe.length() > MAX_BODY ? safe.substring(0, MAX_BODY) + "…" : safe,
                    "url", url == null ? "/" : url));
        } catch (Exception e) {
            log.warn("Could not serialise push payload: {}", e.getMessage());
            return;
        }

        for (PushSubscription sub : subs) {
            send(sub, payload);
        }
    }

    private void send(PushSubscription sub, String payload) {
        try {
            Notification notification = new Notification(
                    sub.getEndpoint(), sub.getP256dh(), sub.getAuth(), payload.getBytes());
            HttpResponse response = pushService.send(notification);
            int status = response.getStatusLine().getStatusCode();

            // 404/410 mean the browser threw the subscription away (cleared data,
            // uninstalled the PWA, revoked permission). Keeping the row would mean
            // retrying a dead endpoint on every single message, forever.
            if (status == 404 || status == 410) {
                repository.deleteByEndpoint(sub.getEndpoint());
                subscriberFilter.forgetIfLast(sub.getUserId());
                return;
            }
            if (status >= 200 && status < 300) {
                sub.setLastUsedAt(Instant.now());
                repository.save(sub);
            } else {
                log.warn("Push rejected ({}): {}", status, sub.getEndpoint());
            }
        } catch (Exception e) {
            // A push failing must never break the thing that triggered it.
            log.warn("Push failed for {}: {}", sub.getEndpoint(), e.toString());
        }
    }
}
