/**
 * Signing in, and not leaking who has an account.
 */
import { post, assert, assertEqual, assertStatus, randomIp } from '../lib/api.mjs';

export const area = 'auth';

export const checks = [
  {
    name: 'login with the right password returns a token',
    async run(ctx) {
      const res = await post('/auth/login', {
        body: { usernameOrEmail: 'alice', password: 'password' },
      });
      assertStatus(res, 200, 'login as alice');
      assert(typeof res.body.accessToken === 'string' && res.body.accessToken.length > 20,
        'login returned no usable accessToken');
      assert(typeof res.body.refreshToken === 'string' && res.body.refreshToken.length > 0,
        'login returned no refreshToken');
      assertEqual(res.body.user?.username, 'alice', 'logged-in user');
    },
  },

  {
    name: 'login with a bad password is rejected',
    async run() {
      const res = await post('/auth/login', {
        body: { usernameOrEmail: 'alice', password: 'definitely-not-the-password' },
      });
      assertStatus(res, 401, 'login with a wrong password');
      assert(
        !res.body?.accessToken,
        'a rejected login must not hand out a token',
      );
    },
  },

  {
    name: 'forgot-password is always 204 (no account enumeration)',
    async run(ctx) {
      // A real account and one that cannot exist must be indistinguishable —
      // same status, same (empty) body. Otherwise the endpoint is an oracle for
      // "is this person a user here".
      const real = await post('/auth/forgot-password', {
        body: { email: ctx.alice.user.email },
        // Fresh client identity: this endpoint is hit twice and we don't want
        // this check to be the thing that trips anyone else's bucket.
        ip: randomIp(),
      });
      assertStatus(real, 204, 'forgot-password for an existing account');

      const unknown = await post('/auth/forgot-password', {
        body: { email: `nobody-${Date.now()}@chatsphere.test` },
        ip: randomIp(),
      });
      assertStatus(unknown, 204, 'forgot-password for an unknown address');

      assertEqual(real.body, unknown.body,
        'forgot-password response body differs between a known and an unknown email');
    },
  },
];
