import { describe, expect, it } from 'vitest';
import { docStatus } from './job';

const row = (kind: string, expires_on: string | null, verified: boolean) => ({ kind, expires_on, verified_at: verified ? '2026-10-01T00:00:00Z' : null });
const T = '2026-10-23';

describe('pro document status', () => {
  it('missing, pending, verified, expiring, expired', () => {
    expect(docStatus('insurance', [], T).status).toBe('missing');
    expect(docStatus('insurance', [row('insurance', '2027-06-01', false)], T).status).toBe('pending');
    expect(docStatus('insurance', [row('insurance', '2027-06-01', true)], T)).toEqual({ kind: 'insurance', status: 'verified', expiresOn: '2027-06-01' });
    expect(docStatus('insurance', [row('insurance', '2026-11-14', true)], T).status).toBe('expiring');
    expect(docStatus('insurance', [row('insurance', '2026-10-01', true)], T).status).toBe('expired');
    expect(docStatus('background_check', [row('background_check', null, true)], T).status).toBe('verified');
  });
  it('a verified document still counts while its replacement waits for a check', () => {
    const rows = [row('bond', '2026-11-01', true), row('bond', '2027-11-01', false)];
    expect(docStatus('bond', rows, T)).toMatchObject({ status: 'verified', expiresOn: '2026-11-01' });
  });
  it('the longest-running verified document wins', () => {
    expect(docStatus('bond', [row('bond', '2026-11-01', true), row('bond', '2027-11-01', true)], T)).toMatchObject({ status: 'verified', expiresOn: '2027-11-01' });
  });
});
