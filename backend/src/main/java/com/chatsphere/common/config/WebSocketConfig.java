package com.chatsphere.common.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final WebSocketAuthChannelInterceptor authInterceptor;
    private final AppProperties props;

    public WebSocketConfig(WebSocketAuthChannelInterceptor authInterceptor, AppProperties props) {
        this.authInterceptor = authInterceptor;
        this.props = props;
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        String[] origins = props.cors().allowedOrigins().split(",");
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns(origins)
                .withSockJS();
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic", "/queue");
        registry.setApplicationDestinationPrefixes("/app");
        registry.setUserDestinationPrefix("/user");
    }

    /**
     * The inbound channel is where every chat.send is executed, and each one does
     * blocking database work. Left at the default (2 x cores, unbounded queue) it
     * was the bottleneck: with 400 people chatting at once, messages queued behind
     * a handful of threads and took over 3 SECONDS to arrive.
     */
    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(authInterceptor);
        registration.taskExecutor()
                .corePoolSize(32)
                .maxPoolSize(64)
                // Bounded: if we ever fall this far behind, fail fast rather than
                // grow an invisible in-memory backlog until the JVM dies.
                .queueCapacity(10_000);
    }

    /** Fan-out to clients. Same reasoning — the default pool is far too small. */
    @Override
    public void configureClientOutboundChannel(ChannelRegistration registration) {
        registration.taskExecutor()
                .corePoolSize(32)
                .maxPoolSize(64)
                .queueCapacity(20_000);
    }

    @Override
    public void configureWebSocketTransport(
            org.springframework.web.socket.config.annotation.WebSocketTransportRegistration registration) {
        registration.setMessageSizeLimit(256 * 1024);      // a long message + metadata
        registration.setSendBufferSizeLimit(2 * 1024 * 1024);
        registration.setSendTimeLimit(20_000);             // a slow mobile client
    }
}
