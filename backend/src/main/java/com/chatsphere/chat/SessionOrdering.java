package com.chatsphere.chat;

import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Makes one connection's messages persist in the order they were typed.
 *
 * The inbound channel is a thread pool, so two sends from the same connection are
 * executed on two threads at once and race to the INSERT. Whichever wins gets the
 * lower id — and a conversation is ordered by id — so the messages could be stored,
 * and shown forever, in the wrong order.
 *
 * Each send arrives stamped with its true arrival position (see
 * {@code InboundSequenceInterceptor}). Here, a send simply waits until every
 * EARLIER send from the SAME connection has been written, then goes.
 *
 * This costs nothing in the normal case — one person is not usually mid-send when
 * they send again, so the turn is already theirs — and it only ever makes a sender
 * wait behind THEMSELVES. Different people, and different connections, are never
 * serialised against each other, so throughput is untouched.
 */
@Component
public class SessionOrdering {

    /**
     * A message never waits longer than this for its predecessor. If a frame ahead
     * of us died somewhere it never got to report completion, and blocking forever
     * would be far worse than a message that is merely out of order: it would be a
     * message that never arrives at all.
     */
    private static final long MAX_WAIT_MS = 500;

    private static final class Gate {
        /** The sequence whose turn it currently is. */
        private long next;
    }

    private final Map<String, Gate> gates = new ConcurrentHashMap<>();

    /** Block until it is this message's turn (or we give up waiting). */
    public void awaitTurn(String sessionId, Long seq) {
        if (sessionId == null || seq == null) return; // not stamped: nothing to order

        Gate gate = gates.computeIfAbsent(sessionId, k -> new Gate());
        synchronized (gate) {
            long deadline = System.currentTimeMillis() + MAX_WAIT_MS;
            while (gate.next < seq) {
                long remaining = deadline - System.currentTimeMillis();
                if (remaining <= 0) {
                    // Give up and go: better slightly out of order than lost.
                    gate.next = seq;
                    break;
                }
                try {
                    gate.wait(remaining);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
        }
    }

    /** Hand the turn to the next message. MUST be called, even when the send failed. */
    public void complete(String sessionId, Long seq) {
        if (sessionId == null || seq == null) return;
        Gate gate = gates.get(sessionId);
        if (gate == null) return;
        synchronized (gate) {
            if (gate.next <= seq) {
                gate.next = seq + 1;
            }
            gate.notifyAll();
        }
    }

    /** Session closed — drop its gate so the map cannot grow without bound. */
    public void forget(String sessionId) {
        if (sessionId != null) gates.remove(sessionId);
    }
}
