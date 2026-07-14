#!/usr/bin/env node
/**
 * Generates a VAPID key pair for Web Push and prints the two lines to paste into
 * your .env. Uses only Node's built-in crypto — nothing to install.
 *
 *   node scripts/generate-vapid-keys.mjs
 *
 * The keys identify YOUR server to the browser push services. Generate them once
 * and keep them: changing them invalidates every existing subscription, so every
 * user would silently stop receiving notifications until they re-subscribed.
 */
import { generateKeyPairSync } from 'node:crypto';

const b64url = (buf) => buf.toString('base64url');

// Web Push requires ECDH on the P-256 curve (prime256v1).
const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });

// Public key: the uncompressed EC point (65 bytes, leading 0x04). It sits at the
// end of the DER SubjectPublicKeyInfo, so take the last 65 bytes.
const spki = publicKey.export({ type: 'spki', format: 'der' });
const point = spki.subarray(spki.length - 65);

// Private key: the 32-byte scalar `d` from the DER PKCS#8 wrapper.
const pkcs8 = privateKey.export({ type: 'pkcs8', format: 'der' });
const d = pkcs8.subarray(36, 36 + 32);

console.log('\nAdd these to your .env (and never commit them):\n');
console.log(`VAPID_PUBLIC_KEY=${b64url(point)}`);
console.log(`VAPID_PRIVATE_KEY=${b64url(d)}`);
console.log('\nThen rebuild so the frontend picks up the public key:');
console.log('  docker compose up -d --build backend frontend\n');
