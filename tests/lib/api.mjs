/**
 * HTTP plumbing for the suite: config, a small fetch wrapper, and assertions.
 *
 * Rate limiting (RateLimitFilter) buckets anonymous callers by client IP, taken
 * from X-Forwarded-For when present. Every request the suite makes therefore
 * carries a per-run X-Forwarded-For, which is what makes the suite RERUNNABLE:
 * a second run inside the same minute gets its own fresh login/register buckets
 * instead of inheriting an exhausted one from the run before it.
 */
export const API_URL = process.env.API_URL ?? 'http://localhost:8080/api';
export const WS_URL = process.env.WS_URL ?? 'ws://localhost:8080/ws/websocket';
export const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://localhost:8025';

/** Unique per process run — a distinct rate-limit identity, and unique fixtures. */
export const RUN_ID = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;

/** A stable-looking but unique client IP for this run. */
export const RUN_IP = randomIp();

export function randomIp() {
  const oct = () => 1 + Math.floor(Math.random() * 254);
  return `10.${oct()}.${oct()}.${oct()}`;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * One HTTP call. Never throws on a non-2xx — the checks assert on `status`
 * themselves, because "did this return 403 and not 500" is usually the point.
 *
 * @returns {Promise<{status:number, body:any, ms:number, headers:Headers}>}
 */
export async function request(method, path, { token, body, ip = RUN_IP, headers = {} } = {}) {
  const url = path.startsWith('http') ? path : API_URL + path;
  const started = performance.now();
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      // See the note at the top of this file.
      'X-Forwarded-For': ip,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const ms = performance.now() - started;
  const text = await res.text();
  let parsed = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }
  return { status: res.status, body: parsed, ms, headers: res.headers };
}

export const get = (path, opts) => request('GET', path, opts);
export const post = (path, opts) => request('POST', path, opts);
export const put = (path, opts) => request('PUT', path, opts);
export const del = (path, opts) => request('DELETE', path, opts);

// ── assertions ──────────────────────────────────────────────────────────────

export function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function assertEqual(actual, expected, what) {
  if (actual !== expected) {
    throw new Error(`${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

export function assertStatus(res, expected, what) {
  if (res.status !== expected) {
    throw new Error(
      `${what}: expected HTTP ${expected}, got ${res.status} — ${JSON.stringify(res.body)}`,
    );
  }
}

/** Poll `fn` until it returns something truthy, or give up. */
export async function waitFor(fn, { timeoutMs = 10_000, intervalMs = 100, what = 'condition' } = {}) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    last = await fn();
    if (last) return last;
    await sleep(intervalMs);
  }
  throw new Error(`timed out after ${timeoutMs}ms waiting for ${what}`);
}

// ── auth helpers ────────────────────────────────────────────────────────────

export async function login(usernameOrEmail, password, opts = {}) {
  const res = await post('/auth/login', { body: { usernameOrEmail, password }, ...opts });
  assertStatus(res, 200, `login as ${usernameOrEmail}`);
  return res.body; // { accessToken, refreshToken, user }
}

/** Time a call, returning [result, milliseconds]. */
export async function timed(fn) {
  const started = performance.now();
  const result = await fn();
  return [result, performance.now() - started];
}
