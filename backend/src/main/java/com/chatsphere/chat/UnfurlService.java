package com.chatsphere.chat;

import com.chatsphere.chat.dto.ChatDtos.LinkPreviewDto;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.net.InetAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.HexFormat;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Server-side link previews (URL unfurling).
 *
 * When a plaintext message contains a URL, we fetch the page once, read its Open
 * Graph tags, and store a small preview on the message row. Clients then show a
 * title/description/thumbnail card instead of a bare link.
 *
 * Three things are non-negotiable here, and the code below is built around them:
 *
 *   1. SSRF safety. This makes an outbound request to a URL a USER supplied. Left
 *      unguarded it is a server-side request forgery primitive: "http://169.254.169.254/…"
 *      (cloud metadata), "http://localhost:9000" (our own MinIO), "http://10.0.0.5/…"
 *      (anything on the internal network). So every hop is resolved and rejected if
 *      it points at a private / loopback / link-local / CGNAT address, and redirects
 *      are followed manually so each new host is re-validated (auto-follow would skip
 *      the check).
 *   2. It must not drain the request threads. The fetch is @Async (off the Tomcat
 *      pool) AND every network call has a hard timeout — one slow page can never
 *      wedge a worker.
 *   3. No repeated work. Every URL's result (including "nothing found") is cached in
 *      Redis, so the same link shared a thousand times costs one fetch, not a thousand.
 *
 * Encrypted messages are never unfurled: the server only holds ciphertext, so there
 * is no URL for it to read. Previews therefore appear in group chats and any chat
 * that is not end-to-end encrypted — never at the cost of the padlock.
 */
@Service
public class UnfurlService {

    private static final Logger log = LoggerFactory.getLogger(UnfurlService.class);

    private static final Duration CACHE_TTL = Duration.ofHours(24);
    /** Never read more than this many bytes of a page — og tags live in the <head>. */
    private static final int MAX_BYTES = 512 * 1024;
    private static final int MAX_REDIRECTS = 3;

    private static final Pattern URL_RE =
            Pattern.compile("https?://[^\\s<>\"')]+", Pattern.CASE_INSENSITIVE);

    private final ChatService chatService;
    private final StringRedisTemplate redis;
    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient client;

    public UnfurlService(@Lazy ChatService chatService, StringRedisTemplate redis) {
        this.chatService = chatService;
        this.redis = redis;
        // followRedirects(NEVER): we resolve each redirect ourselves so every hop is
        // SSRF-checked. connectTimeout bounds the TCP connect; each request bounds read.
        this.client = HttpClient.newBuilder()
                .followRedirects(HttpClient.Redirect.NEVER)
                .connectTimeout(Duration.ofSeconds(3))
                .build();
    }

    /**
     * Kick off unfurling for a freshly-sent message. Runs on the async pool so the
     * sender's message appears instantly; the preview is filled in and broadcast a
     * moment later. Encrypted or link-free messages return immediately.
     */
    @Async
    public void submit(Long messageId, String content, boolean encrypted) {
        if (encrypted || content == null || content.isBlank()) return;
        String url = firstUrl(content);
        if (url == null) return;
        try {
            LinkPreviewDto preview = preview(url);
            if (preview != null) {
                chatService.applyLinkPreview(messageId, preview);
            }
        } catch (Exception e) {
            log.debug("unfurl failed for message {}: {}", messageId, e.toString());
        }
    }

    static String firstUrl(String content) {
        Matcher m = URL_RE.matcher(content);
        if (!m.find()) return null;
        String url = m.group();
        // Trim trailing sentence punctuation the regex may have swept in.
        while (!url.isEmpty() && ".,;:!?".indexOf(url.charAt(url.length() - 1)) >= 0) {
            url = url.substring(0, url.length() - 1);
        }
        return url.length() > 1024 ? null : url;
    }

    /** Cached preview for a URL (negative results are cached too, as the string "null"). */
    private LinkPreviewDto preview(String url) {
        String key = "unfurl:" + sha1(url);
        try {
            String hit = redis.opsForValue().get(key);
            if (hit != null) {
                return "null".equals(hit) ? null : mapper.readValue(hit, LinkPreviewDto.class);
            }
        } catch (Exception e) {
            log.debug("unfurl cache read failed for {}: {}", key, e.toString());
        }
        LinkPreviewDto preview = fetch(url);
        try {
            redis.opsForValue().set(key, preview == null ? "null" : mapper.writeValueAsString(preview),
                    CACHE_TTL);
        } catch (Exception e) {
            log.debug("unfurl cache write failed for {}: {}", key, e.toString());
        }
        return preview;
    }

    /** One fetch, with manual (re-validated) redirect handling. Any failure → null. */
    private LinkPreviewDto fetch(String startUrl) {
        String current = startUrl;
        for (int hop = 0; hop < MAX_REDIRECTS; hop++) {
            URI uri;
            try {
                uri = URI.create(current);
            } catch (Exception e) {
                return null;
            }
            if (!isSafe(uri)) {
                log.debug("unfurl blocked unsafe url: {}", current);
                return null;
            }
            HttpResponse<InputStream> resp;
            try {
                HttpRequest req = HttpRequest.newBuilder(uri)
                        .timeout(Duration.ofSeconds(4))
                        .header("User-Agent", "ChatSphereBot/1.0 (+link-preview)")
                        .header("Accept", "text/html,application/xhtml+xml")
                        .GET()
                        .build();
                resp = client.send(req, HttpResponse.BodyHandlers.ofInputStream());
            } catch (Exception e) {
                return null;
            }
            try (InputStream body = resp.body()) {
                int sc = resp.statusCode();
                if (sc >= 300 && sc < 400) {
                    String loc = resp.headers().firstValue("location").orElse(null);
                    if (loc == null) return null;
                    current = uri.resolve(loc).toString(); // re-validated at loop top
                    continue;
                }
                if (sc != 200) return null;
                String ct = resp.headers().firstValue("content-type").orElse("").toLowerCase();
                if (!ct.contains("text/html") && !ct.contains("application/xhtml")) return null;
                String html = readBounded(body);
                return parse(uri, html);
            } catch (Exception e) {
                return null;
            }
        }
        return null; // too many redirects
    }

    /**
     * Reject any URL that resolves to an address we must never fetch from the server:
     * loopback, private ranges, link-local, CGNAT, multicast, wildcard, IPv6 ULA.
     *
     * Residual note: this resolves DNS here and the HttpClient resolves again on
     * connect, so a hostile DNS-rebind could differ between the two. The blast radius
     * is limited — the bot only reads public HTML and sends no credentials — but a
     * fully hardened version would pin the validated IP for the connection.
     */
    static boolean isSafe(URI uri) {
        String scheme = uri.getScheme();
        if (scheme == null || !(scheme.equalsIgnoreCase("http") || scheme.equalsIgnoreCase("https"))) {
            return false;
        }
        String host = uri.getHost();
        if (host == null || host.isBlank()) return false;
        try {
            InetAddress[] addrs = InetAddress.getAllByName(host);
            if (addrs.length == 0) return false;
            for (InetAddress a : addrs) {
                if (a.isAnyLocalAddress() || a.isLoopbackAddress() || a.isLinkLocalAddress()
                        || a.isSiteLocalAddress() || a.isMulticastAddress()) {
                    return false;
                }
                byte[] b = a.getAddress();
                // CGNAT 100.64.0.0/10
                if (b.length == 4 && (b[0] & 0xff) == 100 && (b[1] & 0xc0) == 0x40) return false;
                // IPv6 unique-local fc00::/7
                if (b.length == 16 && (b[0] & 0xfe) == 0xfc) return false;
            }
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private static String readBounded(InputStream in) throws Exception {
        byte[] buf = new byte[MAX_BYTES];
        int off = 0;
        int r;
        while (off < MAX_BYTES && (r = in.read(buf, off, MAX_BYTES - off)) != -1) {
            off += r;
        }
        return new String(buf, 0, off, StandardCharsets.UTF_8);
    }

    // ── HTML parsing (Open Graph, with a <title> fallback) ───────────────────────

    private LinkPreviewDto parse(URI base, String html) {
        String title = firstNonBlank(meta(html, "og:title"), meta(html, "twitter:title"), titleTag(html));
        String desc = firstNonBlank(meta(html, "og:description"), meta(html, "twitter:description"),
                meta(html, "description"));
        String image = firstNonBlank(meta(html, "og:image"), meta(html, "twitter:image"),
                meta(html, "og:image:url"));
        String site = firstNonBlank(meta(html, "og:site_name"), base.getHost());

        if (image != null && !image.isBlank()) {
            try {
                image = base.resolve(image.trim()).toString(); // absolutise a relative og:image
            } catch (Exception ignored) {
                image = null;
            }
            if (image != null && !isSafe(URI.create(image))) image = null; // don't proxy an internal image URL
        }
        if ((title == null || title.isBlank()) && (image == null || image.isBlank())) {
            return null; // nothing worth showing
        }
        return new LinkPreviewDto(
                clip(title, 300), clip(desc, 600), clip(image, 1024), clip(site, 150),
                base.toString().length() > 1024 ? null : base.toString());
    }

    private static final Pattern TITLE_TAG =
            Pattern.compile("<title[^>]*>(.*?)</title>", Pattern.CASE_INSENSITIVE | Pattern.DOTALL);

    private static String titleTag(String html) {
        Matcher m = TITLE_TAG.matcher(html);
        return m.find() ? decode(m.group(1)) : null;
    }

    /** Read a meta tag's content, tolerating either attribute order. */
    private static String meta(String html, String key) {
        String k = Pattern.quote(key);
        // property/name="key" ... content="value"
        Matcher m1 = Pattern.compile(
                "<meta[^>]+(?:property|name)\\s*=\\s*[\"']" + k + "[\"'][^>]*?content\\s*=\\s*[\"']([^\"']*)[\"']",
                Pattern.CASE_INSENSITIVE).matcher(html);
        if (m1.find()) return decode(m1.group(1));
        // content="value" ... property/name="key"
        Matcher m2 = Pattern.compile(
                "<meta[^>]+content\\s*=\\s*[\"']([^\"']*)[\"'][^>]*?(?:property|name)\\s*=\\s*[\"']" + k + "[\"']",
                Pattern.CASE_INSENSITIVE).matcher(html);
        if (m2.find()) return decode(m2.group(1));
        return null;
    }

    private static String firstNonBlank(String... vals) {
        for (String v : vals) if (v != null && !v.isBlank()) return v.trim();
        return null;
    }

    private static String clip(String s, int max) {
        if (s == null) return null;
        String t = s.trim();
        if (t.isEmpty()) return null;
        return t.length() > max ? t.substring(0, max) : t;
    }

    /** Light HTML-entity decode — enough for titles/descriptions. */
    private static String decode(String s) {
        if (s == null) return null;
        return s.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
                .replace("&quot;", "\"").replace("&#39;", "'").replace("&apos;", "'")
                .replace("&#x27;", "'").replace("&nbsp;", " ").trim();
    }

    private static String sha1(String s) {
        try {
            byte[] d = MessageDigest.getInstance("SHA-1").digest(s.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(d);
        } catch (Exception e) {
            return String.valueOf(s.hashCode());
        }
    }
}
