package com.chatsphere.chat;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The gate that stops one connection's messages being persisted out of order.
 *
 * The bug it exists for: the inbound channel is a thread pool, so two sends from
 * one connection run concurrently and race to the INSERT — the loser can get the
 * lower id, and a conversation ordered by id then shows them swapped forever.
 */
class SessionOrderingTest {

    @Test
    void messagesFromOneSessionAreProcessedInArrivalOrder_evenWhenThreadsRunThemBackwards() throws Exception {
        SessionOrdering ordering = new SessionOrdering();
        String session = "s1";

        ConcurrentLinkedQueue<Long> processed = new ConcurrentLinkedQueue<>();
        ExecutorService pool = Executors.newFixedThreadPool(8);
        CountDownLatch done = new CountDownLatch(8);

        // Hand the work to the pool in REVERSE order, which is the worst case the
        // real thread pool can produce.
        for (long seq = 7; seq >= 0; seq--) {
            final long s = seq;
            pool.submit(() -> {
                try {
                    ordering.awaitTurn(session, s);
                    processed.add(s);          // stands in for the INSERT
                } finally {
                    ordering.complete(session, s);
                    done.countDown();
                }
            });
            // Give the pool a moment, so the tasks really are started backwards
            // rather than all queueing up behind one another.
            Thread.sleep(5);
        }

        assertThat(done.await(5, TimeUnit.SECONDS)).isTrue();
        pool.shutdownNow();

        assertThat(processed).containsExactly(0L, 1L, 2L, 3L, 4L, 5L, 6L, 7L);
    }

    @Test
    void aMessageIsNeverLostWhenAnEarlierOneNeverCompletes() {
        SessionOrdering ordering = new SessionOrdering();

        // Sequence 0 never completes (imagine its thread died). Sequence 1 must
        // still go through — bounded wait, then proceed. A message that is slightly
        // out of order is bad; a message that never arrives is far worse.
        long start = System.currentTimeMillis();
        ordering.awaitTurn("s1", 1L);
        long waited = System.currentTimeMillis() - start;

        assertThat(waited).isGreaterThanOrEqualTo(400); // it did wait its turn…
        assertThat(waited).isLessThan(2_000);           // …but gave up rather than hang
    }

    @Test
    void differentSessionsNeverBlockEachOther() throws Exception {
        SessionOrdering ordering = new SessionOrdering();

        // Session A is stuck waiting for a predecessor that never arrives.
        Thread stuck = new Thread(() -> ordering.awaitTurn("A", 5L));
        stuck.start();

        // Session B must be completely unaffected — one slow sender may never slow
        // anybody else down.
        long start = System.currentTimeMillis();
        ordering.awaitTurn("B", 0L);
        ordering.complete("B", 0L);
        long elapsed = System.currentTimeMillis() - start;

        assertThat(elapsed).isLessThan(100);
        stuck.join(2_000);
    }

    @Test
    void anUnstampedMessageJustGoes() {
        SessionOrdering ordering = new SessionOrdering();
        // No session or no sequence (e.g. a frame that predates the interceptor):
        // it must pass straight through rather than block.
        long start = System.currentTimeMillis();
        ordering.awaitTurn(null, 3L);
        ordering.awaitTurn("s", null);
        assertThat(System.currentTimeMillis() - start).isLessThan(100);
    }

    @Test
    void forgettingASessionDoesNotBreakALaterOne() {
        SessionOrdering ordering = new SessionOrdering();
        ordering.awaitTurn("s1", 0L);
        ordering.complete("s1", 0L);
        ordering.forget("s1");

        // A reconnect reuses nothing: the new session starts from zero again.
        long start = System.currentTimeMillis();
        ordering.awaitTurn("s1", 0L);
        ordering.complete("s1", 0L);
        assertThat(System.currentTimeMillis() - start).isLessThan(100);
    }

    @Test
    void completingOutOfOrderNeverMovesTheTurnBackwards() {
        SessionOrdering ordering = new SessionOrdering();
        ordering.awaitTurn("s", 0L);
        ordering.complete("s", 0L);
        ordering.awaitTurn("s", 1L);
        ordering.complete("s", 1L);

        // A late duplicate completion for an old sequence must not rewind the gate,
        // or the next message would wait for a turn that has already passed.
        ordering.complete("s", 0L);

        long start = System.currentTimeMillis();
        ordering.awaitTurn("s", 2L);
        assertThat(System.currentTimeMillis() - start).isLessThan(100);
    }

    @Test
    void aBurstOfEightIsNotSlowedDownWhenItArrivesInOrder() throws Exception {
        SessionOrdering ordering = new SessionOrdering();
        List<Long> seqs = List.of(0L, 1L, 2L, 3L, 4L, 5L, 6L, 7L);

        long start = System.currentTimeMillis();
        for (Long seq : seqs) {
            ordering.awaitTurn("s", seq);
            ordering.complete("s", seq);
        }
        // The normal case must cost nothing: nobody waits when it is already
        // their turn.
        assertThat(System.currentTimeMillis() - start).isLessThan(50);
    }
}
