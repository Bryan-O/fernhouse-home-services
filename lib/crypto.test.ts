import { beforeAll, describe, expect, it } from 'vitest';
import { decryptField, encryptField } from './crypto';

beforeAll(() => {
  process.env.FIELD_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
});

describe('field encryption', () => {
  it('round-trips and never stores the plain text', () => {
    const enc = encryptField('Garage code 4417')!;
    expect(enc.startsWith('v1:')).toBe(true);
    expect(enc).not.toContain('4417');
    expect(decryptField(enc)).toBe('Garage code 4417');
    expect(encryptField('Garage code 4417')).not.toBe(enc); // fresh IV each time
  });

  it('stores nothing for empty notes', () => {
    expect(encryptField('   ')).toBeNull();
    expect(decryptField(null)).toBeNull();
  });

  it('rejects tampered data', () => {
    const enc = encryptField('Side gate 2580')!;
    const bad = enc.slice(0, -4) + (enc.endsWith('AAAA') ? 'BBBB' : 'AAAA');
    expect(() => decryptField(bad)).toThrow();
  });
});
