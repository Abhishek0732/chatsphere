package com.chatsphere.common.realtime;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.List;

/**
 * One STOMP frame in flight across the cluster.
 *
 * @param usernames  recipients' STOMP principal names, or null for a topic broadcast
 * @param destination STOMP destination ("/queue/messages", "/topic/.../typing", …)
 * @param payload    the frame body, kept as a tree so the relay stays generic
 */
public record RelayEnvelope(List<String> usernames, String destination, JsonNode payload) {}
