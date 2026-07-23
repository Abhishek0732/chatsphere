package com.chatsphere.common.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.time.Duration;
import java.util.List;

/**
 * A Redis token bucket in front of the endpoints that are expensive or abusable.
 * There was no rate limiting anywhere in the app, which meant:
 *
 *  - /auth/login runs BCrypt (~80ms of CPU) on every attempt. A few hundred
 *    requests a second peg every core, and the whole API — including the
 *    WebSocket handshake — stops responding. That is a trivial denial of service,
 *    quite apart from unlimited password guessing.
 *  - /auth/register/send-otp mails anyone, as often as asked: an email bomb, and
 *    your provider's quota.
 *  - /media/upload accepts 25MB per call with no limit on calls.
 *  - /music/search reaches out to a third party; hammering it gets us throttled.
 *
 * Counting in Redis (not in the JVM) means the limit holds ACROSS instances,
 * which is the whole point once there is more than one.
 */
@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(RateLimitFilter.class);

    /** path prefix -> (requests, window). Longest match wins. */
    private record Limit(String prefix, int requests, Duration window) {}

    private static final List<Limit> LIMITS = List.of(
            // Auth is the expensive one (BCrypt) and the one worth attacking.
            new Limit("/api/auth/login", 10, Duration.ofMinutes(1)),
            new Limit("/api/auth/register/send-otp", 5, Duration.ofMinutes(10)),
            new Limit("/api/auth/register", 5, Duration.ofMinutes(10)),
            // NB: this must match the REAL path (PasswordController maps
            // /api/auth/forgot-password). It used to read "/api/auth/password/forgot",
            // which matches nothing — so the one unauthenticated endpoint that SENDS
            // AN EMAIL PER CALL had no limit at all: a free mail bomb, and a fast way
            // to burn the SMTP quota.
            new Limit("/api/auth/forgot-password", 5, Duration.ofMinutes(10)),
            new Limit("/api/auth/reset-password", 5, Duration.ofMinutes(10)),
            new Limit("/api/account/password", 5, Duration.ofMinutes(10)),
            // Generous on purpose: selecting an album (30-40 photos) to send is one
            // burst of that many upload calls, and each may re-send once on a dropped
            // tunnel connection. 60/min tripped on ordinary multi-select sends. This is
            // still a per-authenticated-user bucket, so it bounds abuse without
            // punishing a normal "send these 40 pictures" action.
            new Limit("/api/media/upload", 240, Duration.ofMinutes(1)),
            // Outbound third-party call.
            new Limit("/api/music", 30, Duration.ofMinutes(1)),
            // Full-text search over every message the user can see.
            new Limit("/api/search", 60, Duration.ofMinutes(1)));

    private final StringRedisTemplate redis;

    public RateLimitFilter(StringRedisTemplate redis) {
        this.redis = redis;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        Limit limit = limitFor(req.getRequestURI());
        if (limit != null && !allow(limit, clientKey(req))) {
            res.setStatus(429); // Too Many Requests
            res.setHeader("Retry-After", String.valueOf(limit.window().toSeconds()));
            res.setContentType("application/json");
            res.getWriter().write("{\"status\":429,\"error\":\"Too Many Requests\","
                    + "\"message\":\"Slow down and try again shortly.\"}");
            return;
        }
        chain.doFilter(req, res);
    }

    private Limit limitFor(String uri) {
        Limit best = null;
        for (Limit l : LIMITS) {
            if (uri.startsWith(l.prefix())
                    && (best == null || l.prefix().length() > best.prefix().length())) {
                best = l;
            }
        }
        return best;
    }

    /**
     * Who is this request from — a signed-in user, or an IP?
     *
     * X-Forwarded-For is only believed when the request actually came from our own
     * reverse proxy. It used to be trusted from ANYONE, and the header is client-
     * supplied: send a different X-Forwarded-For on every request and you get a
     * brand-new bucket every time, which quietly nullified the whole filter — the
     * unlimited password guessing and the BCrypt CPU-exhaustion it exists to stop
     * were both still wide open.
     *
     * In this deployment the only thing in front of the backend is the nginx
     * container on the private Docker network, so a private/loopback peer is the
     * proxy and anything else is the public internet talking to us directly.
     */
    private String clientKey(HttpServletRequest req) {
        Long userId = SecurityUtils.currentUserIdOrNull();
        if (userId != null) return "u:" + userId;

        String peer = req.getRemoteAddr();
        String ip = peer;
        if (isTrustedProxy(peer)) {
            String fwd = req.getHeader("X-Forwarded-For");
            if (fwd != null && !fwd.isBlank()) {
                ip = fwd.split(",")[0].trim();
            }
        }
        return "ip:" + ip;
    }

    /** Loopback or an RFC1918 private address — i.e. our own nginx, not the internet. */
    private static boolean isTrustedProxy(String ip) {
        if (ip == null || ip.isBlank()) return false;
        try {
            InetAddress addr = InetAddress.getByName(ip);
            return addr.isLoopbackAddress() || addr.isSiteLocalAddress() || addr.isLinkLocalAddress();
        } catch (UnknownHostException e) {
            return false;
        }
    }

    /** INCR + EXPIRE on first hit: a fixed window, which is plenty here. */
    private boolean allow(Limit limit, String client) {
        String key = "rl:" + limit.prefix() + ":" + client;
        try {
            Long n = redis.opsForValue().increment(key);
            if (n != null && n == 1L) {
                redis.expire(key, limit.window());
            }
            return n == null || n <= limit.requests();
        } catch (Exception e) {
            // Redis unavailable: don't lock everyone out of the app.
            log.warn("rate limit check failed for {}: {}", key, e.toString());
            return true;
        }
    }
}
