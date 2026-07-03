package com.chatsphere.common.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Binds all {@code chatsphere.*} configuration properties.
 */
@ConfigurationProperties(prefix = "chatsphere")
public record AppProperties(Jwt jwt, Cors cors, Minio minio, Kafka kafka) {

    public record Jwt(String secret, long accessTtlMin, long refreshTtlDays) {}

    public record Cors(String allowedOrigins) {}

    public record Minio(String endpoint, String publicEndpoint, String accessKey,
                        String secretKey, String bucket) {}

    public record Kafka(Topics topics) {
        public record Topics(String messages, String presence, String notifications) {}
    }
}
