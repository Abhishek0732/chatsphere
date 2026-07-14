package com.chatsphere.chat;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.Map;
import java.util.PriorityQueue;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Makes one connection's messages persist in the order they were typed — without
 * ever making a thread wait.
 *
 * The problem: the inbound WebSocket channel is a thread pool, so two sends from one
 * connection run concurrently and race to the INSERT. The loser can get the lower id,
 * and a conversation is ordered by id, so the messages end up stored — and displayed
 * forever — in the wrong order.
 *
 * The obvious fix is to make a message WAIT for its predecessor. That is what this
 * class did first, and it was badly wrong: waiting burns a pool thread. Under load the
 * threads all ended up parked on messages whose predecessors could not run, because
 * the threads that would have run them were the ones parked. Delivery went from ~50ms
 * to over 500ms — the pool was starving itself.
 *
 * So nothing waits here. A message that arrives out of turn is PARKED (a cheap queue
 * entry) and the thread is released immediately. Whichever thread finishes the
 * predecessor then drains the queue in sequence order. Threads are never blocked, the
 * order is exact, and a sender is never serialised against anybody but themselves.
 */
@Component
public class SessionOrdering {

    private static final Logger log = LoggerFactory.getLogger(SessionOrdering.class);

    /**
     * How long a message will wait for a predecessor that never arrives (the frame
     * died, or was rejected before it reached us). After that we give up and let the
     * queue move on: a message slightly out of order is bad, a message that never
     * arrives at all is far worse.
     */
    private static final Duration GAP_TIMEOUT = Duration.ofMillis(500);

    private record Pending(long seq, Runnable task) {}

    private static final class Gate {
        /** The sequence whose turn it is. */
        private long next;
        /** Messages that arrived early, smallest sequence first. */
        private final PriorityQueue<Pending> queue =
                new PriorityQueue<>(Comparator.comparingLong(Pending::seq));
        /** True while some thread is draining this session's queue. */
        private boolean draining;
        /** True while a gap-timeout check is already scheduled. */
        private boolean gapWatch;
    }

    private final Map<String, Gate> gates = new ConcurrentHashMap<>();
    private final TaskScheduler scheduler;

    public SessionOrdering(TaskScheduler scheduler) {
        this.scheduler = scheduler;
    }

    /**
     * Run this message's work in arrival order for its connection.
     *
     * Runs INLINE on the calling thread when it is already this message's turn, which
     * is the overwhelmingly common case (nobody is usually mid-send when they send
     * again) — so the fast path costs nothing at all.
     */
    public void submit(String sessionId, Long seq, Runnable task) {
        if (sessionId == null || seq == null) {
            task.run(); // not stamped: nothing to order it against
            return;
        }
        Gate gate = gates.computeIfAbsent(sessionId, k -> new Gate());
        synchronized (gate) {
            gate.queue.add(new Pending(seq, task));
            if (gate.draining) {
                // Another thread is already running this session's queue; it will pick
                // ours up in order. Do NOT block waiting for it.
                return;
            }
            gate.draining = true;
        }
        drain(sessionId, gate);
    }

    private void drain(String sessionId, Gate gate) {
        for (;;) {
            Runnable task;
            long seq;
            synchronized (gate) {
                Pending head = gate.queue.peek();
                if (head == null) {
                    gate.draining = false;
                    return;
                }
                if (head.seq() > gate.next) {
                    // An earlier message has not arrived yet. Release the thread and
                    // let whoever brings it drain the rest.
                    gate.draining = false;
                    scheduleGapCheck(sessionId, gate);
                    return;
                }
                gate.queue.poll();
                if (head.seq() < gate.next) {
                    continue; // already handled (a late duplicate) — skip it
                }
                task = head.task();
                seq = head.seq();
            }

            // Outside the lock: this is the actual database work.
            try {
                task.run();
            } catch (RuntimeException e) {
                // One failed send must not take the connection down with it. Letting the
                // exception escape here left the queue marked "draining" forever, so
                // every later message from this connection silently stopped being
                // processed — a far worse outcome than the send that failed.
                log.warn("send failed on session {} (seq {}): {}", sessionId, seq, e.toString());
            } finally {
                synchronized (gate) {
                    gate.next++;
                }
            }
        }
    }

    /** If the missing predecessor never turns up, force the queue forward. */
    private void scheduleGapCheck(String sessionId, Gate gate) {
        synchronized (gate) {
            if (gate.gapWatch) return;
            gate.gapWatch = true;
        }
        scheduler.schedule(() -> {
            boolean drain = false;
            synchronized (gate) {
                gate.gapWatch = false;
                Pending head = gate.queue.peek();
                if (head != null && head.seq() > gate.next && !gate.draining) {
                    // Skip the hole and carry on.
                    gate.next = head.seq();
                    gate.draining = true;
                    drain = true;
                }
            }
            if (drain) drain(sessionId, gate);
        }, Instant.now().plus(GAP_TIMEOUT));
    }

    /** Session closed — drop its queue so the map cannot grow without bound. */
    public void forget(String sessionId) {
        if (sessionId != null) gates.remove(sessionId);
    }
}
