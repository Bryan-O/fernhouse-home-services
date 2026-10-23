import { describe, expect, it } from 'vitest';
import { atlantaTime, changeTerms, guaranteeOpen } from './policy';

describe('Atlanta time', () => {
  it('handles daylight saving', () => {
    expect(atlantaTime('2026-10-27', 8).toISOString()).toBe('2026-10-27T12:00:00.000Z'); // EDT, UTC−4
    expect(atlantaTime('2026-11-10', 8).toISOString()).toBe('2026-11-10T13:00:00.000Z'); // EST, UTC−5
  });
});

describe('cleaning change rule', () => {
  const visit = { date: '2026-10-27', window: 'morning' as const }; // arrives 8 AM Tue

  it('is free more than 24 hours out', () => {
    const t = changeTerms(visit, new Date('2026-10-26T11:59:00Z')); // Mon 7:59 AM
    expect(t).toMatchObject({ allowed: true, free: true, feeCents: 0, deadlineLabel: 'Mon, Oct 26 at 8 AM' });
  });

  it('carries the $50 fee inside 24 hours', () => {
    const t = changeTerms(visit, new Date('2026-10-26T18:00:00Z')); // Mon 2 PM
    expect(t).toMatchObject({ allowed: true, free: false, feeCents: 5000, hoursUntil: 18 });
  });

  it('is closed once the window starts', () => {
    expect(changeTerms(visit, new Date('2026-10-27T12:30:00Z')).allowed).toBe(false);
  });
});

describe('yard change rule', () => {
  const visit = { date: '2026-10-27', window: null };
  it('is free until 8 PM the night before, then closed online', () => {
    expect(changeTerms(visit, new Date('2026-10-26T23:59:00Z'))).toMatchObject({ allowed: true, free: true, deadlineLabel: 'Mon, Oct 26 at 8 PM' }); // 7:59 PM
    expect(changeTerms(visit, new Date('2026-10-27T00:01:00Z')).allowed).toBe(false); // 8:01 PM
  });
});

describe('guarantee window', () => {
  it('is open for 24 hours after the visit is done', () => {
    expect(guaranteeOpen('2026-10-20T15:42:00Z', new Date('2026-10-21T15:41:00Z')).open).toBe(true);
    expect(guaranteeOpen('2026-10-20T15:42:00Z', new Date('2026-10-21T15:43:00Z')).open).toBe(false);
    expect(guaranteeOpen(null).open).toBe(false);
  });
});
