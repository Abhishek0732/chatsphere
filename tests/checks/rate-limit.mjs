/**
 * Rate limiting on the login endpoint.
 *
 * /auth/login runs BCrypt (~80ms of CPU) on every attempt, so an unlimited login
 * endpoint is both a password-guessing oracle and a trivial way to peg every core
 * on the box — which takes the whole API, WebSocket handshake included, down with
 * it. RateLimitFilter allows 10 per minute per client; the 11th must be refused.
 *
 * The check runs under its OWN client identity (X-Forwarded-For), so it gets a
 * clean bucket: it neither inherits a previous run's counter nor burns the one
 * the rest of the suite is signing in with.
 */
import { post, assert, assertEqual, randomIp } from '../lib/api.mjs';

export const area = 'rate limiting';

const ATTEMPTS = 11;
const ALLOWED = 10;

export const checks = [
  {
    name: `${ATTEMPTS} rapid bad logins: the last one is 429`,
    async run(ctx) {
      const ip = randomIp(); // a fresh client, every run
      const statuses = [];

      for (let i = 0; i < ATTEMPTS; i++) {
        const res = await post('/auth/login', {
          body: { usernameOrEmail: 'alice', password: `wrong-${i}` },
          ip,
        });
        statuses.push(res.status);
      }

      ctx.note(`statuses: ${statuses.join(' ')}`);

      assertEqual(
        statuses[ATTEMPTS - 1],
        429,
        `attempt #${ATTEMPTS} from one client (expected the limiter to refuse it)`,
      );
      assert(
        statuses.slice(0, ALLOWED).every((s) => s === 401 || s === 429),
        `the first ${ALLOWED} attempts should be plain auth failures, got ${statuses.join(',')}`,
      );
      assert(
        statuses[0] === 401,
        'the very first attempt was already refused — the limiter is not starting from a clean bucket',
      );
      assert(
        !statuses.includes(200),
        'a wrong password was somehow accepted',
      );
    },
  },
];
