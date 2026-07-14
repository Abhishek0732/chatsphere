package com.chatsphere.common.security;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * The Redis token bucket: longest-prefix limit matching, 429 past the limit, and
 * fail-open when Redis is down. Redis is mocked — an in-memory counter stands in
 * for INCR.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class RateLimitFilterTest {

    @Mock StringRedisTemplate redis;
    @Mock ValueOperations<String, String> valueOps;
    @Mock FilterChain chain;

    private RateLimitFilter filter;

    /** Stands in for Redis INCR. */
    private final Map<String, Long> counters = new HashMap<>();
    /** Every key INCR'd, in order. */
    private final List<String> incremented = new ArrayList<>();

    @BeforeEach
    void setUp() {
        filter = new RateLimitFilter(redis);
        when(redis.opsForValue()).thenReturn(valueOps);
        when(valueOps.increment(anyString())).thenAnswer(inv -> {
            String key = inv.getArgument(0);
            incremented.add(key);
            return counters.merge(key, 1L, Long::sum);
        });
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private MockHttpServletResponse call(String uri) throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest("POST", uri);
        req.setRequestURI(uri);
        req.setRemoteAddr("10.0.0.1");
        MockHttpServletResponse res = new MockHttpServletResponse();
        filter.doFilter(req, res, chain);
        return res;
    }

    // ─────────────────────────────────────────────────────────────────────
    @DisplayName("longest-prefix matching")
    @Test
    void sendOtpMatchesItsOwnLimitNotTheShorterRegisterPrefix() throws Exception {
        call("/api/auth/register/send-otp");

        // The key carries the matched prefix, so it proves WHICH limit was chosen.
        assertThat(incremented).containsExactly("rl:/api/auth/register/send-otp:ip:10.0.0.1");
    }

    @Test
    void registerMatchesTheRegisterLimit() throws Exception {
        call("/api/auth/register");
        assertThat(incremented).containsExactly("rl:/api/auth/register:ip:10.0.0.1");
    }

    @Test
    void loginMatchesTheLoginLimit() throws Exception {
        call("/api/auth/login");
        assertThat(incremented).containsExactly("rl:/api/auth/login:ip:10.0.0.1");
    }

    @Test
    void anUnlimitedPathNeverTouchesRedisAndPassesStraightThrough() throws Exception {
        MockHttpServletResponse res = call("/api/chat/conversations");

        verifyNoInteractions(redis);
        verify(chain).doFilter(any(), any());
        assertThat(res.getStatus()).isEqualTo(200);
    }

    // ─────────────────────────────────────────────────────────────────────
    @DisplayName("429 past the limit")
    @Test
    void loginAllowsTenThenReturns429() throws Exception {
        for (int i = 1; i <= 10; i++) {
            MockHttpServletResponse ok = call("/api/auth/login");
            assertThat(ok.getStatus()).as("request %d", i).isEqualTo(200);
        }
        verify(chain, org.mockito.Mockito.times(10)).doFilter(any(), any());

        MockHttpServletResponse blocked = call("/api/auth/login");

        assertThat(blocked.getStatus()).isEqualTo(429);
        assertThat(blocked.getHeader("Retry-After")).isEqualTo("60");
        assertThat(blocked.getContentType()).isEqualTo("application/json");
        assertThat(blocked.getContentAsString()).contains("\"status\":429", "Too Many Requests");
        // The request never reached the app.
        verify(chain, org.mockito.Mockito.times(10)).doFilter(any(), any());
    }

    @Test
    void sendOtpAllowsFiveThenReturns429_withItsTenMinuteRetryAfter() throws Exception {
        for (int i = 1; i <= 5; i++) {
            assertThat(call("/api/auth/register/send-otp").getStatus()).isEqualTo(200);
        }
        MockHttpServletResponse blocked = call("/api/auth/register/send-otp");

        assertThat(blocked.getStatus()).isEqualTo(429);
        assertThat(blocked.getHeader("Retry-After")).isEqualTo("600");
    }

    /** The window TTL is set once, on the first hit — not on every request. */
    @Test
    void expiryIsSetOnlyOnTheFirstHitOfAWindow() throws Exception {
        call("/api/auth/login");
        call("/api/auth/login");
        call("/api/auth/login");

        verify(redis, org.mockito.Mockito.times(1))
                .expire("rl:/api/auth/login:ip:10.0.0.1", Duration.ofMinutes(1));
    }

    // ─────────────────────────────────────────────────────────────────────
    @DisplayName("client key")
    @Test
    void anonymousCallersAreLimitedPerClientIp_honouringXForwardedFor() throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest("POST", "/api/auth/login");
        req.setRequestURI("/api/auth/login");
        req.setRemoteAddr("10.0.0.1"); // the proxy
        req.addHeader("X-Forwarded-For", "203.0.113.9, 10.0.0.1");
        filter.doFilter(req, new MockHttpServletResponse(), chain);

        assertThat(incremented).containsExactly("rl:/api/auth/login:ip:203.0.113.9");
    }

    @Test
    void signedInCallersAreLimitedPerUser() throws Exception {
        UserPrincipal principal = new UserPrincipal(77L, "alice", "hash", "USER");
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));

        call("/api/search");

        assertThat(incremented).containsExactly("rl:/api/search:u:77");
    }

    /** Two IPs have their own buckets — one attacker cannot lock everyone else out. */
    @Test
    void limitsAreScopedPerClient() throws Exception {
        for (int i = 1; i <= 11; i++) call("/api/auth/login");

        MockHttpServletRequest other = new MockHttpServletRequest("POST", "/api/auth/login");
        other.setRequestURI("/api/auth/login");
        other.setRemoteAddr("10.0.0.2");
        MockHttpServletResponse res = new MockHttpServletResponse();
        filter.doFilter(other, res, chain);

        assertThat(res.getStatus()).isEqualTo(200);
    }

    // ─────────────────────────────────────────────────────────────────────
    /** Redis down must not lock everyone out of the app. */
    @Test
    void failsOpenWhenRedisIsUnavailable() throws Exception {
        when(valueOps.increment(anyString()))
                .thenThrow(new org.springframework.dao.QueryTimeoutException("redis down"));

        MockHttpServletResponse res = call("/api/auth/login");

        assertThat(res.getStatus()).isEqualTo(200);
        verify(chain).doFilter(any(), any());
    }

    @Test
    void aNullIncrementResultIsTreatedAsAllowed() throws Exception {
        when(valueOps.increment(anyString())).thenReturn(null);

        MockHttpServletResponse res = call("/api/auth/login");

        assertThat(res.getStatus()).isEqualTo(200);
        verify(chain).doFilter(any(), any());
        verify(redis, never()).expire(anyString(), any(Duration.class));
    }
}
