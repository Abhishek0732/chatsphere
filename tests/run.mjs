#!/usr/bin/env node
/**
 * ChatSphere end-to-end regression suite.
 *
 * Runs every check in tests/checks/ against a REAL running stack — the actual
 * HTTP API and the actual STOMP WebSocket, no mocks, no test doubles. Each check
 * prints ✓/✗ with its timing; the process exits non-zero if anything failed.
 *
 *   node run.mjs            # everything
 *   node run.mjs status     # only areas matching "status"
 */
import { API_URL, WS_URL, RUN_ID, RUN_IP, get, post, login, assertStatus } from './lib/api.mjs';
import { connectChatUser } from './lib/stomp.mjs';

import * as auth from './checks/auth.mjs';
import * as messaging from './checks/messaging.mjs';
import * as chatList from './checks/chat-list.mjs';
import * as deletedUser from './checks/deleted-user.mjs';
import * as status from './checks/status.mjs';
import * as rateLimit from './checks/rate-limit.mjs';
import * as perf from './checks/perf.mjs';

// Order matters only in that the cheap, foundational things run first — a broken
// login should be reported as a broken login, not as six mysterious timeouts.
const MODULES = [auth, messaging, chatList, deletedUser, status, rateLimit, perf];

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

/** Shared state every check gets: signed-in users, sockets, and a bin for cleanup. */
async function buildContext() {
  const aliceAuth = await login('alice', 'password');
  const bobAuth = await login('bob', 'password');

  const sockets = new Map();
  const users = {
    alice: { token: aliceAuth.accessToken, user: aliceAuth.user },
    bob: { token: bobAuth.accessToken, user: bobAuth.user },
  };

  let directConvId = null;
  let noteSink = [];

  const ctx = {
    ...users,
    /** Notes a check wants printed underneath its result line. */
    note: (text) => noteSink.push(text),
    _takeNotes: () => {
      const n = noteSink;
      noteSink = [];
      return n;
    },

    /** A connected STOMP client per user, reused across checks. */
    async stompFor(who) {
      if (!sockets.has(who)) {
        sockets.set(who, await connectChatUser(users[who].token, who));
      }
      return sockets.get(who);
    },

    /** The alice↔bob direct conversation (created on first use, then reused). */
    async aliceBobConversation() {
      if (directConvId == null) {
        const res = await post('/conversations/direct', {
          token: users.alice.token,
          body: { targetUserId: users.bob.user.id },
        });
        assertStatus(res, 200, 'get-or-create the alice↔bob direct conversation');
        directConvId = res.body.id;
      }
      return directConvId;
    },

    /** Things to undo at the end, so the suite can be run again and again. */
    trash: { messages: [], after: [] },

    async _cleanup() {
      // Messages go back out through the app's own delete, over the socket.
      for (const { conversationId, messageId, as } of ctx.trash.messages) {
        try {
          const sock = await ctx.stompFor(as);
          sock.publish('/app/chat.delete', { conversationId, messageId });
        } catch {
          // best effort — a failed cleanup must not fail the run
        }
      }
      for (const undo of ctx.trash.after) {
        try {
          await undo();
        } catch {
          // ditto
        }
      }
      // Give the delete frames a moment to land before we pull the sockets down.
      await new Promise((r) => setTimeout(r, 500));
      for (const sock of sockets.values()) await sock.disconnect();
    },
  };
  return ctx;
}

async function main() {
  const filter = process.argv[2];

  console.log(`${BOLD}ChatSphere end-to-end regression suite${RESET}`);
  console.log(`${DIM}  api    ${API_URL}`);
  console.log(`  ws     ${WS_URL}`);
  console.log(`  run    ${RUN_ID} (client ${RUN_IP})${RESET}\n`);

  let ctx;
  try {
    ctx = await buildContext();
  } catch (e) {
    console.error(`${RED}✗ could not sign in the demo users — is the stack up?${RESET}`);
    console.error(`  ${e.message}`);
    process.exit(1);
  }

  const results = [];
  const startedAll = performance.now();

  for (const mod of MODULES) {
    if (filter && !mod.area.includes(filter)) continue;
    console.log(`${BOLD}${mod.area}${RESET}`);

    for (const check of mod.checks) {
      const started = performance.now();
      let error = null;
      try {
        await check.run(ctx);
      } catch (e) {
        error = e;
      }
      const ms = Math.round(performance.now() - started);
      const notes = ctx._takeNotes();

      if (error) {
        console.log(`  ${RED}✗${RESET} ${check.name} ${DIM}(${ms}ms)${RESET}`);
        for (const n of notes) console.log(`    ${DIM}${n}${RESET}`);
        console.log(`    ${RED}${error.message}${RESET}`);
      } else {
        console.log(`  ${GREEN}✓${RESET} ${check.name} ${DIM}(${ms}ms)${RESET}`);
        for (const n of notes) console.log(`    ${DIM}${n}${RESET}`);
      }
      results.push({ area: mod.area, name: check.name, ms, error });
    }
    console.log('');
  }

  await ctx._cleanup();

  const totalMs = Math.round(performance.now() - startedAll);
  const failed = results.filter((r) => r.error);
  const passed = results.length - failed.length;

  if (failed.length) {
    console.log(`${BOLD}${RED}FAILED${RESET}`);
    for (const f of failed) {
      console.log(`  ${RED}✗${RESET} ${f.area} › ${f.name}`);
      console.log(`    ${f.error.message}`);
    }
    console.log('');
  }

  const summary =
    `${passed}/${results.length} checks passed` +
    (failed.length ? `, ${failed.length} FAILED` : '') +
    ` in ${(totalMs / 1000).toFixed(1)}s`;
  console.log(`${BOLD}${failed.length ? RED : GREEN}${summary}${RESET}`);

  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(`${RED}the suite itself blew up:${RESET}`, e);
  process.exit(1);
});
