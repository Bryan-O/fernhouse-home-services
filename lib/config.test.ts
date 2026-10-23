import { describe, expect, it } from 'vitest';
import {
  CAPACITY_DEFAULTS,
  cityForZip,
  firstCleanTotal,
  lookupHome,
  petInitial,
  petVisit,
  PRICING,
  SERVICE_ZIPS,
  standardFor,
} from './config';

describe('home cleaning prices', () => {
  it('matches the HANDOFF table', () => {
    const table = PRICING.rows.map((r) => [r.bd, r.ba, r.standard, r.deep, r.move]);
    expect(table).toEqual([
      [1, 1, 110, 230, 250],
      [2, 1, 125, 270, 290],
      [2, 2, 140, 300, 325],
      [3, 2, 165, 360, 390],
      [3, 3, 180, 395, 425],
      [4, 3, 200, 440, 475],
      [4, 4, 220, 480, 520],
      [5, 4, 245, 540, 580],
    ]);
  });

  it('prices weekly 10% below and one-time 15% above biweekly, to the nearest $5', () => {
    const home = lookupHome(3, 2)!;
    expect(standardFor(home, 'biweekly')).toBe(165);
    expect(standardFor(home, 'weekly')).toBe(150);
    expect(standardFor(home, 'oneTime')).toBe(190);
    for (const r of PRICING.rows) {
      expect(standardFor(r, 'weekly') % 5).toBe(0);
      expect(standardFor(r, 'oneTime') % 5).toBe(0);
    }
  });

  it('takes 20% off the first clean in whole dollars', () => {
    expect(firstCleanTotal(165)).toBe(132); // the owner-alert example in HANDOFF
  });

  it('sends homes over 5 beds or 4 baths to a custom quote', () => {
    expect(lookupHome(6, 2)).toBeNull();
    expect(lookupHome(3, 5)).toBeNull();
  });

  it('uses the next size up for combinations not in the table', () => {
    expect(lookupHome(1, 2)).toMatchObject({ bd: 2, ba: 2 });
  });
});

describe('pet waste prices', () => {
  it('matches the HANDOFF table', () => {
    const table = [1, 2, 3, 4].map((d) => [petVisit('weekly', d), petVisit('twice', d), petVisit('biweekly', d), petVisit('once', d)]);
    expect(table).toEqual([
      [24, 20, 32, 89],
      [27, 23, 35, 89],
      [30, 26, 38, 89],
      [33, 29, 41, 89],
    ]);
  });

  it('prices the initial cleanup by yard condition', () => {
    expect(petInitial('weekly', 'kept')).toBe(0);
    expect(petInitial('weekly', 'weeks')).toBe(39);
    expect(petInitial('twice', 'weeks')).toBe(39);
    expect(petInitial('biweekly', 'weeks')).toBe(75);
    expect(petInitial('weekly', 'month')).toBe(75);
    expect(petInitial('once', 'month')).toBe(0);
  });
});

describe('service area and capacity', () => {
  it('covers 41 ZIP codes', () => {
    expect(Object.keys(SERVICE_ZIPS)).toHaveLength(41);
    expect(cityForZip('30062')).toBe('Marietta');
    expect(cityForZip('90210')).toBeNull();
  });

  it('starts at 2/2/1 Mon–Fri, 1/1/0 Saturday, Sunday closed', () => {
    expect(CAPACITY_DEFAULTS.cleaningPerWindow[0]).toEqual([0, 0, 0]);
    expect(CAPACITY_DEFAULTS.cleaningPerWindow[2]).toEqual([2, 2, 1]);
    expect(CAPACITY_DEFAULTS.cleaningPerWindow[6]).toEqual([1, 1, 0]);
  });
});
