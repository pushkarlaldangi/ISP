/**
 * Application-layer PII encryption.
 *
 * Why: Supabase free tier doesn't give us guaranteed column-level encryption
 * via pgcrypto, and we want PII unreadable to anyone with raw DB access
 * (e.g. a leaked DATABASE_URL). We encrypt before insert, decrypt on read,
 * and a separate salted hash column is used for equality lookups.
 *
 * Algorithm: AES-256-GCM with a fresh 96-bit IV per message. The on-disk
 * shape is [12-byte IV | 16-byte auth tag | ciphertext]. GCM gives us
 * authenticated encryption — tampering breaks decrypt with an exception.
 *
 * Lookup: HMAC-SHA256(email, PII_LOOKUP_SALT). Deterministic so we can
 * find a user by email, but the hash alone doesn't reveal the email and
 * the salt makes precomputation attacks impractical.
 *
 * Keys come from environment variables, not from the DB. Rotating them
 * means re-encrypting existing rows — there's an operational runbook for
 * that, not in scope here.
 */

import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;

function getEncryptionKey(): Buffer {
  const raw = process.env.PII_ENCRYPTION_KEY;
  if (!raw) throw new Error('PII_ENCRYPTION_KEY is not set');
  // Accept either 32-byte hex or any base64 input — derive 32 bytes.
  let key: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    key = Buffer.from(raw, 'hex');
  } else {
    key = Buffer.from(raw, 'base64');
  }
  if (key.length < 32) {
    throw new Error(
      `PII_ENCRYPTION_KEY must decode to at least 32 bytes (got ${key.length}). ` +
        'Generate with: openssl rand -base64 48',
    );
  }
  return key.subarray(0, 32);
}

function getLookupSalt(): string {
  // We allow the salt to default to the encryption key for single-secret
  // deployments — separate envs can rotate them independently.
  return process.env.PII_LOOKUP_SALT ?? process.env.PII_ENCRYPTION_KEY ?? '';
}

/** Encrypt a UTF-8 string into a single binary blob. */
export function encryptPii(plaintext: string): Buffer {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]);
}

/** Decrypt a blob produced by `encryptPii`. Throws on tampering. */
export function decryptPii(blob: Buffer | Uint8Array): string {
  const buf = Buffer.isBuffer(blob) ? blob : Buffer.from(blob);
  // Empty-plaintext encryption yields IV + tag with zero ciphertext bytes,
  // so the minimum valid size is exactly IV_BYTES + TAG_BYTES.
  if (buf.length < IV_BYTES + TAG_BYTES) {
    throw new Error('encrypted blob is too short');
  }
  const key = getEncryptionKey();
  const iv = buf.subarray(0, IV_BYTES);
  const tag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const enc = buf.subarray(IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString('utf8');
}

/**
 * Deterministic, salted hash used to look up users by email without
 * exposing the email itself in the DB. Email is lower-cased first so
 * `Alice@x` and `alice@x` collide as intended.
 */
export function hashEmailForLookup(email: string): string {
  const salt = getLookupSalt();
  if (!salt) throw new Error('PII_LOOKUP_SALT (or PII_ENCRYPTION_KEY) is not set');
  return createHmac('sha256', salt).update(email.trim().toLowerCase()).digest('hex');
}
