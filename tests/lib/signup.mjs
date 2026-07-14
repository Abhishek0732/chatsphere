/**
 * Registering a throwaway account, the way a real person has to.
 *
 * chatsphere.app.require-email-verification defaults to TRUE (application.yml),
 * and nothing in docker-compose turns it off — so signup is a three-step flow:
 * send-otp → verify-otp → register. The code is only ever delivered by email, so
 * we read it out of the dev inbox (Mailpit), which is exactly where this stack
 * sends it. EmailVerificationService puts it in the SUBJECT of the mail:
 * "123456 is your ChatSphere verification code".
 */
import { MAILPIT_URL, post, get, assertStatus, waitFor, RUN_ID } from './api.mjs';

/** Every message currently in the dev inbox. */
async function inbox() {
  const res = await get(`${MAILPIT_URL}/api/v1/messages?limit=200`);
  return res.body?.messages ?? [];
}

/** Pull the 6-digit signup code for `email` out of Mailpit (the mail is sent async). */
export async function fetchOtp(email) {
  const wanted = email.toLowerCase();
  const msg = await waitFor(
    async () => {
      const messages = await inbox();
      return messages.find(
        (m) =>
          (m.To ?? []).some((t) => (t.Address ?? '').toLowerCase() === wanted) &&
          /verification code/i.test(m.Subject ?? ''),
      );
    },
    { timeoutMs: 20_000, intervalMs: 250, what: `the signup OTP email for ${email}` },
  );
  const code = (msg.Subject.match(/\b(\d{6})\b/) ?? [])[1];
  if (!code) throw new Error(`no 6-digit code in the mail subject: ${msg.Subject}`);
  return { code, id: msg.ID };
}

/** Tidy up after ourselves so the dev inbox doesn't fill with test mail. */
export async function deleteMail(ids) {
  if (!ids.length) return;
  await fetch(`${MAILPIT_URL}/api/v1/messages`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ IDs: ids }),
  }).catch(() => {});
}

/**
 * Register a brand-new user end to end, OTP and all.
 *
 * With no explicit username the account is unique to this RUN — which is what
 * the deleted-account check needs, since a deleted username is retired forever
 * and can never be reused.
 *
 * @returns {Promise<{accessToken:string, refreshToken:string, user:object, password:string}>}
 */
export async function registerUser({
  prefix = 'e2e',
  username = `${prefix}_${RUN_ID}`.slice(0, 50),
  email = `${username}@chatsphere.test`,
  password = 'password123',
  displayName = `E2E ${prefix}`,
} = {}) {
  const sent = await post('/auth/register/send-otp', { body: { email } });
  assertStatus(sent, 204, `send the signup OTP to ${email}`);

  const { code, id } = await fetchOtp(email);

  const verified = await post('/auth/register/verify-otp', { body: { email, code } });
  assertStatus(verified, 204, `verify the signup OTP for ${email}`);

  const registered = await post('/auth/register', {
    body: { username, email, password, displayName },
  });
  assertStatus(registered, 200, `register ${username}`);

  await deleteMail([id]);
  return { ...registered.body, password };
}

/**
 * A user that persists ACROSS runs: sign in if they exist, sign them up if they
 * don't. Used for fixtures we don't destroy, so repeated runs don't litter the
 * database with a new account every time.
 */
export async function ensureUser({ username, password = 'password123', displayName }) {
  const email = `${username}@chatsphere.test`;
  const existing = await post('/auth/login', { body: { usernameOrEmail: username, password } });
  if (existing.status === 200) return { ...existing.body, password };
  if (existing.status !== 401) {
    throw new Error(`unexpected ${existing.status} signing in fixture ${username}: ${JSON.stringify(existing.body)}`);
  }
  return registerUser({ username, email, password, displayName: displayName ?? username });
}
