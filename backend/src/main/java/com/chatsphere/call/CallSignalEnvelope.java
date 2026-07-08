package com.chatsphere.call;

import com.chatsphere.call.dto.CallDtos.CallSignal;

/**
 * What travels over the Redis pub/sub channel between Spring instances. Every
 * instance receives it, but only the one holding {@code username}'s live STOMP
 * session actually delivers — the rest no-op. This is the cross-instance
 * backplane that lets a horizontally-scaled signaling tier ring a socket it
 * doesn't itself hold.
 */
public record CallSignalEnvelope(String username, String destination, CallSignal signal) {}
