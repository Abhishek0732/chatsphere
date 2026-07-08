package com.chatsphere.common.config;

import com.chatsphere.call.CallBroadcaster;
import com.chatsphere.call.CallSignalListener;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;

/**
 * Wires the Redis pub/sub backplane for call signaling. The connection factory
 * is Spring Boot auto-configured (Lettuce) — the same Redis already used for
 * presence. This adds the one listener container that makes signaling
 * cluster-aware.
 */
@Configuration
public class CallRedisConfig {

    @Bean
    public RedisMessageListenerContainer callSignalListenerContainer(
            RedisConnectionFactory connectionFactory, CallSignalListener listener) {
        RedisMessageListenerContainer container = new RedisMessageListenerContainer();
        container.setConnectionFactory(connectionFactory);
        container.addMessageListener(listener, new ChannelTopic(CallBroadcaster.CHANNEL));
        return container;
    }
}
