package com.chatsphere.music.dto;

import java.util.List;

public final class MusicDtos {

    private MusicDtos() {}

    /**
     * One catalogue track. {@code previewUrl} is the ~30s clip a status actually
     * plays; {@code durationMs} is that clip's length, not the full song's, so the
     * story timeline is right.
     */
    public record TrackDto(String id,
                           String title,
                           String artist,
                           String genre,
                           String artworkUrl,
                           String previewUrl,
                           int durationMs) {}

    /** The browse shelves offered by the picker. */
    public record CategoriesDto(List<String> categories) {}
}
