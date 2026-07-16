package com.chatsphere.music;

import com.chatsphere.music.dto.MusicDtos.CategoriesDto;
import com.chatsphere.music.dto.MusicDtos.TrackDto;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Catalogue search for status music (Instagram-style). */
@RestController
@RequestMapping("/api/music")
public class MusicController {

    private final MusicService musicService;

    public MusicController(MusicService musicService) {
        this.musicService = musicService;
    }

    /** Browse shelves — Trending, Bollywood, Pop, Lo-Fi… */
    @GetMapping("/categories")
    public CategoriesDto categories() {
        return new CategoriesDto(MusicService.CATEGORIES);
    }

    /**
     * Search the catalogue. With no `q`, returns the given browse category
     * (default Trending), so the picker has something to show before you type.
     */
    @GetMapping("/search")
    public List<TrackDto> search(@RequestParam(required = false) String q,
                                 @RequestParam(required = false) String category,
                                 @RequestParam(defaultValue = "25") int limit) {
        if (q != null && !q.isBlank()) {
            return musicService.search(q, limit);
        }
        return musicService.category(category, limit);
    }
}
