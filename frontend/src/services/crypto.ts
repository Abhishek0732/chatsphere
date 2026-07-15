/**
 * End-to-end encryption for direct chats.
 *
 * The shape of it:
 *
 *   - Every user has an ECDH P-256 key pair. The public half is published; the
 *     private half NEVER leaves the browser in the clear.
 *   - The private key is wrapped with AES-GCM under a key derived from the user's
 *     password (PBKDF2, 250k iterations). Only that blob goes to the server, so the
 *     server can store your key and still be unable to use it. Log in anywhere with
 *     your password and you get your key — and your history — back.
 *   - To message someone, ECDH(my private, their public) gives a shared secret that
 *     only the two of us can compute. HKDF turns it into an AES-GCM key. Both sides
 *     derive the identical key without ever transmitting it.
 *   - Each message gets a fresh random 96-bit IV. The stored form is
 *     `v1.<iv>.<ciphertext>` — the server keeps that string and can do nothing with it.
 *
 * Everything here is the browser's own WebCrypto. No crypto library, nothing
 * hand-rolled: the primitives are the ones the platform ships.
 *
 * WHAT THIS DOES NOT GIVE YOU, stated plainly so nobody assumes otherwise:
 *   - No forward secrecy. The conversation key is derived from the two identity keys,
 *     so it is stable: someone who steals a private key can read that conversation's
 *     past messages. A Signal-style ratchet is what fixes that, and it is a much
 *     bigger build.
 *   - It protects you from the SERVER, not from your own browser. Anything that can
 *     run script in the page (an XSS) can read the key while it is in memory.
 *   - Groups are not encrypted (they need per-member key distribution and re-keying).
 *   - Attachments are not encrypted yet — only message text.
 */

const KDF_ITERATIONS = 250_000;
const ENVELOPE_VERSION = 'v1';

const enc = new TextEncoder();
const dec = new TextDecoder();

// ── small helpers ────────────────────────────────────────────────────────────

function toB64(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s);
}

function fromB64(b64: string): Uint8Array {
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function randomBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n));
}

/** Is E2E encryption possible at all here? (Requires a secure context.) */
export function cryptoAvailable(): boolean {
  return typeof crypto !== 'undefined' && !!crypto.subtle;
}

// ── identity ─────────────────────────────────────────────────────────────────

export interface WrappedIdentity {
  publicKey: string; // raw ECDH public point, base64
  encPrivateKey: string; // AES-GCM(pkcs8 private key), base64
  encKeySalt: string; // PBKDF2 salt, base64
  encKeyIv: string; // AES-GCM IV for the wrap, base64
}

/** The key that wraps the private key. Derived from the password — never stored. */
async function wrappingKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: KDF_ITERATIONS, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Generate a brand-new identity and wrap it under the given password. */
export async function createIdentity(
  password: string,
): Promise<{ wrapped: WrappedIdentity; privateKey: CryptoKey }> {
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveKey',
    'deriveBits',
  ]);
  const publicRaw = await crypto.subtle.exportKey('raw', pair.publicKey);
  const privatePkcs8 = await crypto.subtle.exportKey('pkcs8', pair.privateKey);

  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const kek = await wrappingKey(password, salt);
  const wrappedPrivate = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, kek, privatePkcs8);

  return {
    wrapped: {
      publicKey: toB64(publicRaw),
      encPrivateKey: toB64(wrappedPrivate),
      encKeySalt: toB64(salt),
      encKeyIv: toB64(iv),
    },
    privateKey: pair.privateKey,
  };
}

/**
 * Unwrap the stored private key with the password.
 * Returns null when the password does not open it — which is exactly what happens
 * after a password RESET, because the old password is gone and with it the key.
 */
export async function unwrapIdentity(
  wrapped: WrappedIdentity,
  password: string,
): Promise<CryptoKey | null> {
  try {
    const kek = await wrappingKey(password, fromB64(wrapped.encKeySalt));
    const pkcs8 = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromB64(wrapped.encKeyIv) },
      kek,
      fromB64(wrapped.encPrivateKey),
    );
    return await crypto.subtle.importKey('pkcs8', pkcs8, { name: 'ECDH', namedCurve: 'P-256' }, true, [
      'deriveKey',
      'deriveBits',
    ]);
  } catch {
    // AES-GCM is authenticated, so a wrong password fails here rather than
    // silently producing a garbage key.
    return null;
  }
}

/** Re-wrap an existing private key under a new password (used on password change). */
export async function rewrapIdentity(
  privateKey: CryptoKey,
  publicKeyB64: string,
  newPassword: string,
): Promise<WrappedIdentity> {
  const privatePkcs8 = await crypto.subtle.exportKey('pkcs8', privateKey);
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const kek = await wrappingKey(newPassword, salt);
  const wrappedPrivate = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, kek, privatePkcs8);
  return {
    publicKey: publicKeyB64,
    encPrivateKey: toB64(wrappedPrivate),
    encKeySalt: toB64(salt),
    encKeyIv: toB64(iv),
  };
}

// ── safety numbers (identity verification) ───────────────────────────────────
//
// A "safety number" lets two people confirm, out of band, that no one is sitting
// in the middle. It is derived from BOTH identity public keys, so if the server
// ever substituted a key (a man-in-the-middle), the two sides would compute
// DIFFERENT numbers and the mismatch would give it away. Comparing the number in
// person — or scanning the other's QR — is what upgrades "encrypted" to "verified".
//
// The number is symmetric: both people compute the same 60 digits from the same
// two keys, regardless of who is "me". That is what makes a QR scan a simple equality
// check.

/** 30 digits (six 5-digit groups) fingerprinting one public key. */
async function fingerprint30(publicKeyB64: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', fromB64(publicKeyB64)));
  let out = '';
  for (let g = 0; g < 6; g++) {
    let n = 0;
    for (let j = 0; j < 5; j++) n = (n * 256 + digest[g * 5 + j]) % 100000;
    out += n.toString().padStart(5, '0');
  }
  return out;
}

/**
 * The 60-digit safety number for a pair of identity keys. Order-independent: the
 * two per-key fingerprints are sorted before joining, so both participants derive
 * the identical value. Returns null if either key is missing.
 */
export async function safetyNumber(
  myPublicKeyB64: string | null,
  theirPublicKeyB64: string | null,
): Promise<string | null> {
  if (!myPublicKeyB64 || !theirPublicKeyB64) return null;
  const [a, b] = await Promise.all([
    fingerprint30(myPublicKeyB64),
    fingerprint30(theirPublicKeyB64),
  ]);
  return [a, b].sort().join('');
}

/** Group a 60-digit safety number into 12 space-separated blocks of five. */
export function formatSafetyNumber(digits: string): string {
  return (digits.match(/.{1,5}/g) ?? []).join(' ');
}

// ── conversation keys ────────────────────────────────────────────────────────

/**
 * The key for a conversation with one other person.
 *
 * ECDH gives both sides the same secret from (my private, their public) and
 * (their private, my public) — it never travels. HKDF then binds it to this app and
 * this pair of users, so the same secret cannot be reused as a key somewhere else.
 */
export async function deriveConversationKey(
  myPrivateKey: CryptoKey,
  theirPublicKeyB64: string,
  myUserId: number,
  theirUserId: number,
): Promise<CryptoKey> {
  const theirPublic = await crypto.subtle.importKey(
    'raw',
    fromB64(theirPublicKeyB64),
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );

  const sharedBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: theirPublic },
    myPrivateKey,
    256,
  );

  const hkdfKey = await crypto.subtle.importKey('raw', sharedBits, 'HKDF', false, ['deriveKey']);
  // Same info string on both sides — so sort the ids rather than using "me" and "them".
  const [lo, hi] = [myUserId, theirUserId].sort((a, b) => a - b);
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: enc.encode('chatsphere-dm-v1'),
      info: enc.encode(`dm:${lo}:${hi}`),
    },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

// ── messages ─────────────────────────────────────────────────────────────────

/** `v1.<iv>.<ciphertext>` — the only thing the server ever sees. */
export async function encryptMessage(plaintext: string, key: CryptoKey): Promise<string> {
  const iv = randomBytes(12); // never reused: a fresh one per message
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext));
  return `${ENVELOPE_VERSION}.${toB64(iv)}.${toB64(ct)}`;
}

export function isEnvelope(text: string | null | undefined): boolean {
  return !!text && text.startsWith(`${ENVELOPE_VERSION}.`) && text.split('.').length === 3;
}

// ── attachments ──────────────────────────────────────────────────────────────
// A file is encrypted with the same conversation key as the text. The stored object
// is `iv(12 bytes) || ciphertext` — raw bytes, no envelope string, because this is a
// binary blob in object storage rather than a database column. The IV travels with
// the file, which is fine: an IV is not a secret, it just has to be unique.

const IV_BYTES = 12;

/** Encrypt file bytes for upload. What reaches storage is indistinguishable from noise. */
export async function encryptBytes(data: ArrayBuffer, key: CryptoKey): Promise<Blob> {
  const iv = randomBytes(IV_BYTES);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  return new Blob([iv, new Uint8Array(ct)], { type: 'application/octet-stream' });
}

/** Decrypt a downloaded attachment. Null when it cannot be read. */
export async function decryptBytes(
  blob: ArrayBuffer,
  key: CryptoKey,
): Promise<ArrayBuffer | null> {
  if (blob.byteLength <= IV_BYTES) return null;
  const bytes = new Uint8Array(blob);
  try {
    return await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: bytes.slice(0, IV_BYTES) },
      key,
      bytes.slice(IV_BYTES),
    );
  } catch {
    return null;
  }
}

/**
 * Decrypt one message. Returns null if it cannot be read — a message from before
 * the peer rotated their key, say. The caller shows a placeholder rather than
 * pretending nothing is there.
 */
export async function decryptMessage(envelope: string, key: CryptoKey): Promise<string | null> {
  if (!isEnvelope(envelope)) return null;
  const [, ivB64, ctB64] = envelope.split('.');
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromB64(ivB64) },
      key,
      fromB64(ctB64),
    );
    return dec.decode(plain);
  } catch {
    // AES-GCM is authenticated: a tampered or undecryptable message fails here
    // rather than decoding to garbage. That is the point.
    return null;
  }
}
