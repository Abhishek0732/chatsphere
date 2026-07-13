package com.chatsphere.music;

import com.chatsphere.music.dto.MusicDtos.TrackDto;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;

/**
 * A real, searchable music catalogue for statuses — the way Instagram/WhatsApp
 * do it, rather than a handful of files bundled with the app.
 *
 * Backed by Apple's public iTunes Search API: millions of real songs, each with
 * a ~30s preview clip and cover art, and no API key required. A status caps its
 * music at 30s anyway, so a preview clip is exactly the right unit.
 *
 * Every lookup is cached in Redis, so repeated searches and the browse
 * categories (which are the same query for every user) cost one upstream call
 * per period, not one per user — this stays cheap at scale.
 */
@Service
public class MusicService {

    private static final Logger log = LoggerFactory.getLogger(MusicService.class);

    private static final String SEARCH_URL = "https://itunes.apple.com/search";
    /** Preview clips are ~30s, which is also the story music cap. */
    private static final int PREVIEW_MS = 30_000;
    private static final Duration CACHE_TTL = Duration.ofHours(12);
    private static final int MAX_LIMIT = 40;
    /** Bounds the text we will hash into a cache key and send upstream. */
    private static final int MAX_QUERY_LEN = 60;

    /** Browse rows, in the spirit of Instagram's "Trending / Moods" shelves. */
    public static final List<String> CATEGORIES = List.of(
            "Trending", "Bollywood", "Punjabi", "Pop", "Hip-Hop", "Romantic", "Party", "Lo-Fi", "Sad");

    /** The query each category actually runs. */
    private static String termFor(String category) {
        return switch (category.toLowerCase(Locale.ROOT)) {
            case "trending" -> "top hits";
            case "bollywood" -> "bollywood hits";
            case "punjabi" -> "punjabi hits";
            case "hip-hop", "hip hop" -> "hip hop";
            case "romantic" -> "romantic love songs";
            case "party" -> "party dance hits";
            case "lo-fi", "lofi" -> "lofi chill beats";
            case "sad" -> "sad songs";
            default -> category;
        };
    }

    private final RestClient http;
    private final StringRedisTemplate redis;
    private final ObjectMapper mapper = new ObjectMapper();
    private final String country;

    public MusicService(StringRedisTemplate redis,
                        @Value("${chatsphere.music.country:IN}") String country) {
        this.redis = redis;
        this.country = country;
        // TIMEOUTS ARE NOT OPTIONAL: this call goes out to a third party from a
        // request thread. Without them, one slow/hanging upstream drains the whole
        // Tomcat thread pool and every endpoint in the app — including the
        // WebSocket handshake — stops responding.
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout((int) Duration.ofSeconds(2).toMillis());
        factory.setReadTimeout((int) Duration.ofSeconds(3).toMillis());
        this.http = RestClient.builder().baseUrl(SEARCH_URL).requestFactory(factory).build();
    }

    /** Songs matching a free-text query (title, artist, album…). */
    public List<TrackDto> search(String query, int limit) {
        String q = query == null ? "" : query.trim();
        if (q.isEmpty()) return List.of();
        if (q.length() > MAX_QUERY_LEN) q = q.substring(0, MAX_QUERY_LEN);
        // Clamp BEFORE the key is built, or ?limit=1..40 (and 99999) each mint a
        // separate Redis key for the same result. Hash the user's text so an
        // attacker can't grow Redis with arbitrary long keys.
        int n = clampLimit(limit);
        String key = "music:q:" + sha1(q.toLowerCase(Locale.ROOT)) + ":" + n;
        return cached(key, q, n);
    }

    /** A browse row — the same query for everyone, so it's near-always a cache hit. */
    public List<TrackDto> category(String category, int limit) {
        // Only the known shelves are accepted, so this can never be a cache-key
        // amplification vector.
        String c = CATEGORIES.stream()
                .filter(x -> x.equalsIgnoreCase(category))
                .findFirst()
                .orElse("Trending");
        int n = clampLimit(limit);
        return cached("music:cat:" + c.toLowerCase(Locale.ROOT) + ":" + n, termFor(c), n);
    }

    private static int clampLimit(int limit) {
        return Math.min(Math.max(limit, 1), MAX_LIMIT);
    }

    private static String sha1(String s) {
        try {
            byte[] d = MessageDigest.getInstance("SHA-1").digest(s.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(d);
        } catch (NoSuchAlgorithmException e) {
            return String.valueOf(s.hashCode());
        }
    }

    private List<TrackDto> cached(String key, String term, int n) {
        try {
            String hit = redis.opsForValue().get(key);
            if (hit != null) {
                return mapper.readValue(hit, mapper.getTypeFactory()
                        .constructCollectionType(List.class, TrackDto.class));
            }
        } catch (Exception e) {
            log.debug("music cache read failed for {}: {}", key, e.toString());
        }

        List<TrackDto> tracks = fetch(term, n);
        if (!tracks.isEmpty()) {
            try {
                redis.opsForValue().set(key, mapper.writeValueAsString(tracks), CACHE_TTL);
            } catch (Exception e) {
                log.debug("music cache write failed for {}: {}", key, e.toString());
            }
        }
        return tracks;
    }

    /** One upstream call. Any failure degrades to an empty list — never a 500. */
    private List<TrackDto> fetch(String term, int limit) {
        try {
            String body = http.get()
                    .uri(uri -> uri
                            .queryParam("term", term)
                            .queryParam("media", "music")
                            .queryParam("entity", "song")
                            .queryParam("country", country)
                            .queryParam("limit", limit)
                            .build())
                    .retrieve()
                    .body(String.class);
            if (body == null) return List.of();

            JsonNode results = mapper.readTree(body).path("results");
            List<TrackDto> out = new ArrayList<>();
            for (JsonNode r : results) {
                String preview = r.path("previewUrl").asText(null);
                if (preview == null || preview.isBlank()) continue; // unplayable — skip
                // Ask for the larger artwork; the API hands back a 100px thumb.
                String art = r.path("artworkUrl100").asText("").replace("100x100", "300x300");
                out.add(new TrackDto(
                        String.valueOf(r.path("trackId").asLong()),
                        r.path("trackName").asText("Unknown"),
                        r.path("artistName").asText("Unknown"),
                        r.path("primaryGenreName").asText(""),
                        art,
                        preview,
                        PREVIEW_MS));
            }
            return out;
        } catch (Exception e) {
            // Offline / upstream down: the picker falls back to the bundled tracks.
            log.warn("music lookup failed for '{}': {}", term, e.toString());
            return List.of();
        }
    }
}
