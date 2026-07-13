package com.chatsphere.common.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;
import java.util.concurrent.ThreadPoolExecutor;

/**
 * The thread pool behind every {@code @Async} method.
 *
 * Without this bean Spring falls back to SimpleAsyncTaskExecutor, which creates a
 * BRAND NEW THREAD for every single call and never reuses one. Two things on the
 * send path are @Async (the notification fan-out and the unread bump), so every
 * message being sent spawned two fresh OS threads. With a few hundred people
 * chatting at once that is thousands of threads: the machine spends its time
 * context-switching and fighting over database connections instead of delivering
 * messages, and delivery latency went from ~10ms to over 2 SECONDS.
 *
 * A bounded pool fixes it: threads are reused, and if we ever fall behind, the
 * caller runs the task itself (CallerRunsPolicy) rather than the queue growing
 * until the JVM dies.
 */
@Configuration
public class AsyncConfig {

    @Bean(name = "taskExecutor")
    public Executor taskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(16);
        executor.setMaxPoolSize(32);
        executor.setQueueCapacity(20_000);
        executor.setThreadNamePrefix("async-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(20);
        executor.initialize();
        return executor;
    }
}
