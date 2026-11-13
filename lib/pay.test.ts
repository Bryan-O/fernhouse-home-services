import { describe, expect, it } from 'vitest';
import { payWeekStart, proPayCents } from './pay';
import { PRO_PAY } from './config';

describe('pro pay', () => {
  it('is the set share of the full visit price', () => {
    expect(PRO_PAY.pctOfVisit).toBe(60);
    expect(proPayCents({ price_cents: 16500, upgrade_cents: null, upgrade_status: null })).toBe(9900);
    expect(proPayCents({ price_cents: 11000, upgrade_cents: null, upgrade_status: null })).toBe(6600);
  });
  it('counts an approved yard cleanup upgrade at its upgraded price, not a declined one', () => {
    expect(proPayCents({ price_cents: 2400, upgrade_cents: 7500, upgrade_status: 'approved' })).toBe(4500);
    expect(proPayCents({ price_cents: 2400, upgrade_cents: 7500, upgrade_status: 'declined' })).toBe(1440);
  });
  it('rounds to the cent', () => {
    expect(proPayCents({ price_cents: 2399, upgrade_cents: null, upgrade_status: null })).toBe(1439);
  });
  it('pay weeks run Monday to Sunday', () => {
    expect(payWeekStart('2026-11-16')).toBe('2026-11-16'); // Monday
    expect(payWeekStart('2026-11-18')).toBe('2026-11-16'); // Wednesday
    expect(payWeekStart('2026-11-22')).toBe('2026-11-16'); // Sunday
    expect(payWeekStart('2026-11-23')).toBe('2026-11-23'); // next Monday
  });
});
