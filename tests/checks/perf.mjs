/**
 * Latency budgets on the three things a person does in the first five seconds of
 * opening the app: see their chats, open one, and look someone up. Each of these
 * has been an N+1 at some point in this project's life.
 *
 * One warm-up call (not counted), then three timed calls; the MEDIAN must be
 * inside budget. A smoke test should fail on a regression, not on the one call
 * that happened to land while the JIT was still thinking.
 */
import { get, assert, assertStatus } from '../lib/api.mjs';

export const area = 'perf smoke';

const BUDGET_MS = 500;

async function measure(path, token) {
  await get(path, { token }); // warm-up, discarded
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const res = await get(path, { token });
    assertStatus(res, 200, `GET ${path}`);
    samples.push(res.ms);
  }
  const sorted = [...samples].sort((a, b) => a - b);
  return { median: sorted[1], samples, last: sorted };
}

function report(ctx, label, result) {
  const shown = result.samples.map((m) => `${Math.round(m)}ms`).join(', ');
  ctx.note(`${label}: median ${Math.round(result.median)}ms (${shown})`);
  assert(
    result.median < BUDGET_MS,
    `${label} took ${Math.round(result.median)}ms (median of ${shown}) — budget is ${BUDGET_MS}ms`,
  );
}

export const checks = [
  {
    name: `chat list, open-a-chat and user search are each < ${BUDGET_MS}ms`,
    async run(ctx) {
      const token = ctx.alice.token;
      const convId = await ctx.aliceBobConversation();

      report(ctx, 'chat list      ', await measure('/conversations', token));
      report(ctx, 'open a chat    ', await measure(`/conversations/${convId}/messages?limit=30`, token));
      report(ctx, 'user search    ', await measure('/search/users?q=bo', token));
    },
  },
];
