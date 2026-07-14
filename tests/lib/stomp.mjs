/**
 * A STOMP client for Node, talking to the same destinations the browser uses.
 *
 * The browser reaches /ws through SockJS; from Node we skip SockJS and use the
 * raw WebSocket sub-endpoint SockJS would negotiate anyway (/ws/websocket). The
 * JWT rides on the CONNECT frame — WebSocketAuthChannelInterceptor authenticates
 * it there, exactly as the frontend does in src/services/socket.ts.
 */
import { Client } from '@stomp/stompjs';
import WebSocket from 'ws';
import { WS_URL, sleep } from './api.mjs';

export class StompUser {
  /** @param {string} token JWT access token */
  constructor(token, label = 'user') {
    this.token = token;
    this.label = label;
    this.client = null;
    /** Every frame received, per destination. */
    this.received = new Map();
  }

  connect(timeoutMs = 15_000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`[${this.label}] STOMP connect timed out after ${timeoutMs}ms`)),
        timeoutMs,
      );
      const fail = (err) => {
        clearTimeout(timer);
        reject(err);
      };

      this.client = new Client({
        webSocketFactory: () => new WebSocket(WS_URL),
        connectHeaders: { Authorization: `Bearer ${this.token}` },
        // A dropped socket mid-test is a failure, not something to paper over.
        reconnectDelay: 0,
        heartbeatIncoming: 10_000,
        heartbeatOutgoing: 10_000,
        onConnect: () => {
          clearTimeout(timer);
          resolve(this);
        },
        onStompError: (frame) =>
          fail(new Error(`[${this.label}] STOMP error: ${frame.headers?.message} ${frame.body}`)),
        onWebSocketError: (e) =>
          fail(new Error(`[${this.label}] WebSocket error: ${e?.message ?? e}`)),
      });
      this.client.activate();
    });
  }

  /** Subscribe, recording every frame body (parsed) that arrives on `destination`. */
  subscribe(destination) {
    if (!this.received.has(destination)) this.received.set(destination, []);
    const bucket = this.received.get(destination);
    this.client.subscribe(destination, (frame) => {
      try {
        bucket.push(JSON.parse(frame.body));
      } catch {
        bucket.push(frame.body);
      }
    });
    return bucket;
  }

  frames(destination) {
    return this.received.get(destination) ?? [];
  }

  publish(destination, payload) {
    this.client.publish({ destination, body: JSON.stringify(payload) });
  }

  /** Wait until a frame matching `predicate` shows up on `destination`. */
  async waitForFrame(destination, predicate, timeoutMs = 8000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const hit = this.frames(destination).find(predicate);
      if (hit) return hit;
      await sleep(25);
    }
    throw new Error(
      `[${this.label}] no matching frame on ${destination} within ${timeoutMs}ms ` +
        `(${this.frames(destination).length} frame(s) seen)`,
    );
  }

  /** Assert nothing matching `predicate` arrives within the window. */
  async expectNoFrame(destination, predicate, windowMs = 2500) {
    await sleep(windowMs);
    const hit = this.frames(destination).find(predicate);
    if (hit) {
      throw new Error(
        `[${this.label}] unexpected frame on ${destination}: ${JSON.stringify(hit).slice(0, 200)}`,
      );
    }
  }

  async disconnect() {
    if (this.client) {
      try {
        await this.client.deactivate();
      } catch {
        // already gone — nothing to do
      }
      this.client = null;
    }
  }
}

/** Connect a user and subscribe to the personal queue the app delivers messages on. */
export async function connectChatUser(token, label) {
  const u = new StompUser(token, label);
  await u.connect();
  u.subscribe('/user/queue/messages');
  return u;
}

/** The frame the frontend sends for a new message (see socket.ts sendMessage). */
export function sendMessage(user, conversationId, content, tempId, opts = {}) {
  user.publish('/app/chat.send', {
    conversationId,
    content,
    type: 'TEXT',
    attachmentUrl: null,
    replyToId: null,
    tempId,
    mentions: [],
    // End-to-end encrypted direct messages: `content` is ciphertext and the server
    // must treat it as opaque.
    encrypted: opts.encrypted === true,
  });
}
