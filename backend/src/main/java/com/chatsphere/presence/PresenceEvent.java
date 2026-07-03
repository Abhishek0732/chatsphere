package com.chatsphere.presence;

import java.time.Instant;

/** Broadcast on /topic/presence when a user's online state changes. */
public record PresenceEvent(Long userId, boolean online, Instant lastSeen) {}
