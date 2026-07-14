package com.chatsphere.chat;

import org.junit.jupiter.api.Test;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;

import java.util.List;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The gate that stops one connection's messages being persisted out of order.
 *
 * Two properties matter, and the second is why this class was rewritten:
 *   1. Order is exact — messages run in the sequence they arrived in.
 *   2. NOTHING EVER BLOCKS A POOL THREAD. The first version made a message wait for
 *      its predecessor, which burned a thread; under load the pool parked itself on
 *      messages whose predecessors could not run, because the threads that would have
 *      run them were the ones parked. Delivery went from ~50ms to over 500ms.
 */
class SessionOrderingTest {

    private static SessionOrdering ordering() {
        ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(2);
        scheduler.initialize();
        return new SessionOrdering(scheduler);
    }

    @Test
    void messagesRunInArrivalOrder_evenWhenSubmittedBackwards() {
        SessionOrdering ordering = ordering();
        ConcurrentLinkedQueue<Long> ran = new ConcurrentLinkedQueue<>();

        // Worst case: they arrive in reverse.
        for (long seq = 4; seq >= 1; seq--) {
            final long s = seq;
            ordering.submit("s1", s, () -> ran.add(s));
        }
        ordering.submit("s1", 0L, () -> ran.add(0L));

        // The moment the missing 0 arrives, the whole backlog drains in order.
        assertThat(ran).containsExactly(0L, 1L, 2L, 3L, 4L);
    }

    @Test
    void aMessageOutOfTurnDoesNotBlockTheThreadThatBroughtIt() throws Exception {
        SessionOrdering ordering = ordering();

        // seq 1 arrives first. Its predecessor (0) is nowhere to be seen. The calling
        // thread MUST come straight back — parking it here is what starved the pool.
        long start = System.currentTimeMillis();
        ordering.submit("s1", 1L, () -> {});
        long elapsed = System.currentTimeMillis() - start;

        assertThat(elapsed).isLessThan(50);
    }

    @Test
    void manySendersOnManyThreadsAreEachOrderedWithoutStarvingThePool() throws Exception {
        SessionOrdering ordering = ordering();

        final int sessions = 50;
        final int perSession = 10;
        // Deliberately FEWER threads than sessions: if a single out-of-turn message
        // parked a thread, this pool would deadlock itself.
        ExecutorService pool = Executors.newFixedThreadPool(4);
        CountDownLatch done = new CountDownLatch(sessions * perSession);

        ConcurrentLinkedQueue<String> ran = new ConcurrentLinkedQueue<>();

        for (int s = 0; s < sessions; s++) {
            final String session = "s" + s;
            // Submit each session's messages in a jumbled order.
            for (long seq : new long[] {3, 1, 4, 0, 8, 2, 9, 5, 7, 6}) {
                pool.submit(() -> {
                    ordering.submit(session, seq, () -> ran.add(session + ":" + seq));
                    done.countDown();
                });
            }
        }

        assertThat(done.await(10, TimeUnit.SECONDS)).isTrue();
        pool.shutdown();
        assertThat(pool.awaitTermination(10, TimeUnit.SECONDS)).isTrue();

        // Every session's messages must appear in sequence order.
        for (int s = 0; s < sessions; s++) {
            String session = "s" + s;
            List<Long> seqs = ran.stream()
                    .filter(e -> e.startsWith(session + ":"))
                    .map(e -> Long.valueOf(e.substring(session.length() + 1)))
                    .toList();
            assertThat(seqs)
                    .as("session %s ran in order", session)
                    .containsExactly(0L, 1L, 2L, 3L, 4L, 5L, 6L, 7L, 8L, 9L);
        }
    }

    @Test
    void aMessageIsNeverLostWhenAnEarlierOneNeverArrives() throws Exception {
        SessionOrdering ordering = ordering();
        AtomicInteger ran = new AtomicInteger();

        // Sequence 0 never arrives (its frame died). Sequence 1 must STILL run — a
        // message slightly out of order is bad; one that never arrives is far worse.
        ordering.submit("s1", 1L, ran::incrementAndGet);
        assertThat(ran.get()).isZero(); // waiting for 0…

        // …and the gap timeout lets it through.
        long deadline = System.currentTimeMillis() + 3_000;
        while (ran.get() == 0 && System.currentTimeMillis() < deadline) {
            Thread.sleep(25);
        }
        assertThat(ran.get()).isEqualTo(1);
    }

    @Test
    void aFailingSendStillHandsOnTheTurn() {
        SessionOrdering ordering = ordering();
        ConcurrentLinkedQueue<Long> ran = new ConcurrentLinkedQueue<>();

        // The first message blows up (a database error, say). The next one must not be
        // stuck behind it forever.
        try {
            ordering.submit("s1", 0L, () -> {
                throw new IllegalStateException("insert failed");
            });
        } catch (IllegalStateException expected) {
            // the handler's own error path deals with this
        }
        ordering.submit("s1", 1L, () -> ran.add(1L));

        assertThat(ran).containsExactly(1L);
    }

    @Test
    void anUnstampedMessageJustRuns() {
        SessionOrdering ordering = ordering();
        ConcurrentLinkedQueue<Long> ran = new ConcurrentLinkedQueue<>();
        ordering.submit(null, 3L, () -> ran.add(3L));
        ordering.submit("s", null, () -> ran.add(9L));
        assertThat(ran).containsExactly(3L, 9L);
    }

    @Test
    void differentSessionsNeverBlockEachOther() {
        SessionOrdering ordering = ordering();
        ConcurrentLinkedQueue<String> ran = new ConcurrentLinkedQueue<>();

        // Session A is stuck (its seq 0 never arrives). Session B must be unaffected —
        // one stalled sender may never slow anybody else down.
        ordering.submit("A", 5L, () -> ran.add("A5"));

        long start = System.currentTimeMillis();
        ordering.submit("B", 0L, () -> ran.add("B0"));
        long elapsed = System.currentTimeMillis() - start;

        assertThat(ran).containsExactly("B0");
        assertThat(elapsed).isLessThan(50);
    }

    @Test
    void forgettingASessionReleasesItsState() {
        SessionOrdering ordering = ordering();
        ConcurrentLinkedQueue<Long> ran = new ConcurrentLinkedQueue<>();

        ordering.submit("s1", 0L, () -> ran.add(0L));
        ordering.forget("s1");

        // A reconnect is a NEW session and starts from zero again.
        ordering.submit("s1", 0L, () -> ran.add(100L));
        assertThat(ran).containsExactly(0L, 100L);
    }
}
