import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { decryptPii, encryptPii, hashEmailForLookup } from './pii';

const ORIGINAL_KEY = process.env.PII_ENCRYPTION_KEY;

beforeAll(() => {
  // 48 base64 bytes — matches our generation guidance.
  process.env.PII_ENCRYPTION_KEY =
    'JZGfOoyh9MZvIRYWNXLPyzaIvX9zXFsoEM9X3KOTrlmlbiF3qV1J6/iEcoQ5Pqsj';
});

afterAll(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.PII_ENCRYPTION_KEY;
  else process.env.PII_ENCRYPTION_KEY = ORIGINAL_KEY;
});

describe('PII encryption', () => {
  it('round-trips arbitrary unicode plaintext', () => {
    const samples = ['alice@example.com', '', 'Pushkar Dangi', 'मनी', '🦄 mutual funds'];
    for (const s of samples) {
      const enc = encryptPii(s);
      expect(decryptPii(enc)).toBe(s);
    }
  });

  it('produces a different ciphertext for the same plaintext each call', () => {
    const a = encryptPii('alice@example.com');
    const b = encryptPii('alice@example.com');
    expect(Buffer.compare(a, b)).not.toBe(0);
  });

  it('rejects tampered ciphertext', () => {
    const enc = encryptPii('alice@example.com');
    const tampered = Buffer.from(enc);
    tampered[tampered.length - 1] ^= 0x01;
    expect(() => decryptPii(tampered)).toThrow();
  });

  it('rejects truncated ciphertext', () => {
    const enc = encryptPii('alice@example.com');
    expect(() => decryptPii(enc.subarray(0, 8))).toThrow();
  });

  it('lookup hash is deterministic + case-insensitive', () => {
    const a = hashEmailForLookup('alice@example.com');
    const b = hashEmailForLookup('ALICE@Example.com  ');
    expect(a).toBe(b);
  });

  it('lookup hash differs across different emails', () => {
    const a = hashEmailForLookup('alice@example.com');
    const b = hashEmailForLookup('bob@example.com');
    expect(a).not.toBe(b);
  });
});
