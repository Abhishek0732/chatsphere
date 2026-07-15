import { getMyKeys, getPeerKey, publishKeys } from '@/api/keys';
import { e2eeAccessors } from '@/store/e2eeStore';
import {
  createIdentity,
  cryptoAvailable,
  decryptBytes,
  decryptMessage,
  deriveConversationKey,
  encryptBytes,
  encryptMessage,
  isEnvelope,
  rewrapIdentity,
  unwrapIdentity,
} from './crypto';

/**
 * The session's encryption state: my private key, and the per-peer conversation
 * keys derived from it.
 *
 * The private key is unlocked with the password at login and then cached on THIS
 * DEVICE (IndexedDB) so a reload does not demand the password again. It is never
 * sent anywhere: the server only ever holds the password-wrapped blob.
 */

const DB_NAME = 'chatsphere-e2ee';
const STORE = 'identity';

let privateKey: CryptoKey | null = null;
let myPublicKey: string | null = null;
let myUserId: number | null = null;

/** peerUserId -> AES key for that conversation. Derivation is not free; do it once. */
const conversationKeys = new Map<number, CryptoKey>();
/** peerUserId -> their public key, so we don't re-fetch it per message. */
const peerKeys = new Map<number, string | null>();

// ── device-local cache of the unlocked key ───────────────────────────────────
// Storing the unlocked private key here is what makes a reload painless. It is a
// deliberate trade: anything that can run script in this origin could read it. That
// is inherent to end-to-end encryption in a browser — the alternative is asking for
// the password on every page load, which people would simply turn off.

function idb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null);
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

async function cacheKey(userId: number, key: CryptoKey, publicKey: string): Promise<void> {
  const db = await idb();
  if (!db) return;
  const jwk = await crypto.subtle.exportKey('jwk', key);
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ jwk, publicKey }, `u${userId}`);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

async function loadCachedKey(
  userId: number,
): Promise<{ key: CryptoKey; publicKey: string } | null> {
  const db = await idb();
  if (!db) return null;
  const record = await new Promise<{ jwk: JsonWebKey; publicKey: string } | null>((resolve) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(`u${userId}`);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => resolve(null);
  });
  if (!record) return null;
  try {
    const key = await crypto.subtle.importKey(
      'jwk',
      record.jwk,
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveKey', 'deriveBits'],
    );
    return { key, publicKey: record.publicKey };
  } catch {
    return null;
  }
}

async function clearCachedKey(userId: number): Promise<void> {
  const db = await idb();
  if (!db) return;
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).delete(`u${userId}`);
}

// ── setup ────────────────────────────────────────────────────────────────────

export type E2eeSetup = 'ready' | 'created' | 'rotated' | 'unavailable';

/**
 * Called at LOGIN, where we have the password (the only moment we do).
 *
 * - No identity yet → make one and publish it.
 * - Identity exists → unwrap it with the password.
 * - Identity exists but the password does NOT open it → the password was reset, so
 *   the old private key is gone for good. Make a new one. Messages encrypted to the
 *   old key stay unreadable; there is no way around that, and pretending otherwise
 *   would be worse than saying it.
 */
export async function setupEncryption(userId: number, password: string): Promise<E2eeSetup> {
  if (!cryptoAvailable()) return 'unavailable';
  myUserId = userId;

  const mine = await getMyKeys();

  if (!mine.publicKey || !mine.encPrivateKey || !mine.encKeySalt || !mine.encKeyIv) {
    const { wrapped, privateKey: pk } = await createIdentity(password);
    await publishKeys({ ...wrapped, rotated: true });
    privateKey = pk;
    myPublicKey = wrapped.publicKey;
    await cacheKey(userId, pk, wrapped.publicKey);
    e2eeAccessors.setReady(true);
    return 'created';
  }

  const unwrapped = await unwrapIdentity(
    {
      publicKey: mine.publicKey,
      encPrivateKey: mine.encPrivateKey,
      encKeySalt: mine.encKeySalt,
      encKeyIv: mine.encKeyIv,
    },
    password,
  );

  if (unwrapped) {
    privateKey = unwrapped;
    myPublicKey = mine.publicKey;
    await cacheKey(userId, unwrapped, mine.publicKey);
    e2eeAccessors.setReady(true);
    return 'ready';
  }

  // The password cannot open the key: it was reset. Start a new identity.
  const { wrapped, privateKey: pk } = await createIdentity(password);
  await publishKeys({ ...wrapped, rotated: true });
  privateKey = pk;
  myPublicKey = wrapped.publicKey;
  conversationKeys.clear();
  await cacheKey(userId, pk, wrapped.publicKey);
  e2eeAccessors.setReady(true);
  return 'rotated';
}

/** Called on a page load: restore the key from this device, without the password. */
export async function restoreEncryption(userId: number): Promise<boolean> {
  if (!cryptoAvailable()) return false;
  myUserId = userId;
  const cached = await loadCachedKey(userId);
  if (!cached) return false;
  privateKey = cached.key;
  myPublicKey = cached.publicKey;
  e2eeAccessors.setReady(true);
  return true;
}

/** Password changed: re-wrap the SAME key, or the user loses their own history. */
export async function rewrapForNewPassword(newPassword: string): Promise<void> {
  if (!privateKey || !myPublicKey) return;
  const wrapped = await rewrapIdentity(privateKey, myPublicKey, newPassword);
  // rotated: false — the key pair is unchanged, so peers' derived secrets (and every
  // message they can already read) are unaffected.
  await publishKeys({ ...wrapped, rotated: false });
}

export async function forgetEncryption(): Promise<void> {
  if (myUserId != null) await clearCachedKey(myUserId);
  privateKey = null;
  myPublicKey = null;
  myUserId = null;
  conversationKeys.clear();
  peerKeys.clear();
  // Decrypted attachments are PLAINTEXT held in memory — do not leave them behind
  // for whoever uses this browser next.
  revokeObjectUrls();
  e2eeAccessors.setReady(false);
}

export function encryptionReady(): boolean {
  return privateKey !== null;
}

/** My identity public key (base64), for computing a safety number. Null until set up. */
export function getMyPublicKey(): string | null {
  return myPublicKey;
}

// ── per-conversation keys ────────────────────────────────────────────────────

async function keyForPeer(peerId: number): Promise<CryptoKey | null> {
  if (!privateKey || myUserId == null) return null;

  const cached = conversationKeys.get(peerId);
  if (cached) return cached;

  let peerPublic = peerKeys.get(peerId);
  if (peerPublic === undefined) {
    try {
      peerPublic = (await getPeerKey(peerId)).publicKey;
    } catch {
      peerPublic = null;
    }
    peerKeys.set(peerId, peerPublic);
  }
  // The other person has not set up encryption (an old account, or a browser that
  // cannot do it). We fall back to sending in the clear rather than sending them
  // something they can never read.
  if (!peerPublic) return null;

  const key = await deriveConversationKey(privateKey, peerPublic, myUserId, peerId);
  conversationKeys.set(peerId, key);
  return key;
}

/** Can this chat be encrypted right now? (Both sides have keys.) */
export async function canEncryptWith(peerId: number): Promise<boolean> {
  return (await keyForPeer(peerId)) !== null;
}

/** Encrypt for a direct chat. Returns null when encryption is not possible. */
export async function encryptFor(peerId: number, plaintext: string): Promise<string | null> {
  const key = await keyForPeer(peerId);
  if (!key) return null;
  return encryptMessage(plaintext, key);
}

/** Decrypt a message from a direct chat. Null when it cannot be read. */
export async function decryptFrom(peerId: number, envelope: string): Promise<string | null> {
  if (!isEnvelope(envelope)) return envelope; // not encrypted: pass through
  const key = await keyForPeer(peerId);
  if (!key) return null;
  return decryptMessage(envelope, key);
}

// ── attachments ──────────────────────────────────────────────────────────────

/**
 * Seal a file for a direct chat. What gets uploaded is `iv || ciphertext` — the
 * object store holds bytes that are indistinguishable from noise, and (because the
 * upload is flagged) it is stored under a random key with no filename in it and no
 * thumbnail derived from it.
 */
export async function encryptFileFor(peerId: number, file: File): Promise<File | null> {
  const key = await keyForPeer(peerId);
  if (!key) return null;
  const sealed = await encryptBytes(await file.arrayBuffer(), key);
  // The real name and type travel inside the ENCRYPTED message, not here.
  return new File([sealed], 'attachment.enc', { type: 'application/octet-stream' });
}

/**
 * Fetch an encrypted attachment and decrypt it into a blob: URL the browser can
 * render. Cached per URL — a photo in a thread would otherwise be downloaded and
 * decrypted again on every single render.
 */
const objectUrls = new Map<string, string>();

export async function decryptAttachment(
  peerId: number,
  url: string,
  mimeType?: string,
): Promise<string | null> {
  const cached = objectUrls.get(url);
  if (cached) return cached;

  const key = await keyForPeer(peerId);
  if (!key) return null;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const plain = await decryptBytes(await res.arrayBuffer(), key);
    if (!plain) return null;

    const objectUrl = URL.createObjectURL(
      new Blob([plain], { type: mimeType || 'application/octet-stream' }),
    );
    objectUrls.set(url, objectUrl);
    return objectUrl;
  } catch {
    return null;
  }
}

/** Release the decrypted blobs (on logout — they are plaintext in memory). */
function revokeObjectUrls(): void {
  for (const url of objectUrls.values()) URL.revokeObjectURL(url);
  objectUrls.clear();
}
