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
            new Limit("/api/auth/password/forgot", 5, Duration.ofMinutes(10)),
            new Limit("/api/media/upload", 60, Duration.ofMinutes(1)),
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

    /** Signed-in users are limited per user; anonymous callers per client IP. */
    private String clientKey(HttpServletRequest req) {
        Long userId = SecurityUtils.currentUserIdOrNull();
        if (userId != null) return "u:" + userId;
        String fwd = req.getHeader("X-Forwarded-For");
        String ip = (fwd != null && !fwd.isBlank()) ? fwd.split(",")[0].trim() : req.getRemoteAddr();
        return "ip:" + ip;
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
