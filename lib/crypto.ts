import 'server-only';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// Access notes and gate codes are encrypted before they reach the database
// (AES-256-GCM). The key lives only in FIELD_ENCRYPTION_KEY (32 bytes, base64).
// Make one with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

const PREFIX = 'v1:';

function key(): Buffer {
  const k = Buffer.from(process.env.FIELD_ENCRYPTION_KEY ?? '', 'base64');
  if (k.length !== 32) throw new Error('FIELD_ENCRYPTION_KEY must be 32 bytes, base64-encoded (see .env.example)');
  return k;
}

/** Encrypt a short text; empty input stays null so nothing is stored. */
export function encryptField(plain: string | null | undefined): string | null {
  const text = (plain ?? '').trim();
  if (!text) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const body = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64');
}

export function decryptField(stored: string | null | undefined): string | null {
  if (!stored) return null;
  if (!stored.startsWith(PREFIX)) throw new Error('Unknown encrypted field format');
  const raw = Buffer.from(stored.slice(PREFIX.length), 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key(), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
}
