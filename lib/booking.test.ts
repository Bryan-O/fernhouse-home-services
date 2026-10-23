import { describe, expect, it } from 'vitest';
import {
  addDays, firstRouteDate, fmtLong, isBookableDate, isFullDate, openDatesAfter, quoteClean, quotePet,
  routeLong, step2Errors, step3Errors, toE164, todayIso, weekday, type Availability, type BookingDraft,
} from './booking';
import { DEFAULT_CLEAN, DEFAULT_PET_STEP1 } from './booking-store';

const draft = (patch: Partial<BookingDraft> = {}): BookingDraft => ({
  svc: 'clean', clean: DEFAULT_CLEAN, pet: DEFAULT_PET_STEP1, zip: '30062', date: '2026-10-27', window: 'morning',
  routeDay: null, address: '482 Maple Ridge Dr', unit: '', name: 'Jordan Ellis', phone: '(404) 555-0187',
  email: 'jordan@example.com', access: '', pets: false, petNote: '', requests: '', smsPromo: false, gate: '',
  dogNames: '', dogsFriendly: true, ...patch,
});

const av = (patch: Partial<Availability> = {}): Availability => ({
  today: '2026-10-23',
  clean: { '2026-10-27': { morning: 1, midday: 0, afternoon: 0 }, '2026-10-28': { morning: 0, midday: 0, afternoon: 0 }, '2026-10-29': { morning: 2, midday: 2, afternoon: 1 } },
  closed: ['2026-11-01'],
  yard: { Mon: 12, Tue: 0, Wed: 10, Thu: 12, Fri: 8 },
  ...patch,
});

describe('dates', () => {
  it('works on Atlanta calendar dates', () => {
    expect(todayIso(new Date('2026-10-23T03:30:00Z'))).toBe('2026-10-22'); // 11:30 PM in Atlanta
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
    expect(weekday('2026-10-27')).toBe(2);
    expect(fmtLong('2026-10-27')).toBe('Tuesday, October 27');
  });

  it('books from tomorrow to 60 days out', () => {
    expect(isBookableDate('2026-10-23', '2026-10-23')).toBe(false);
    expect(isBookableDate('2026-10-24', '2026-10-23')).toBe(true);
    expect(isBookableDate(addDays('2026-10-23', 60), '2026-10-23')).toBe(true);
    expect(isBookableDate(addDays('2026-10-23', 61), '2026-10-23')).toBe(false);
  });

  it('puts the first yard visit on the route day at least 2 days out', () => {
    expect(firstRouteDate('Tue', '2026-10-23')).toBe('2026-10-27');
  });
});

describe('availability', () => {
  it('finds full dates and the next open ones', () => {
    expect(isFullDate(av(), '2026-10-28')).toBe(true);
    expect(isFullDate(av(), '2026-10-27')).toBe(false);
    expect(openDatesAfter(av(), '2026-10-27', 3)).toEqual(['2026-10-29']);
  });
});

describe('validation', () => {
  it('accepts a complete step 2 and step 3', () => {
    expect(step2Errors(draft(), av())).toEqual({});
    expect(step3Errors(draft())).toEqual({});
  });

  it('flags ZIP problems', () => {
    expect(step2Errors(draft({ zip: '3006' }), null)).toMatchObject({ zip: true });
    expect(step2Errors(draft({ zip: '30901' }), null)).toMatchObject({ zipOut: true });
  });

  it('treats closed days as unavailable, not full', () => {
    expect(step2Errors(draft({ date: '2026-11-01' }), av())).toMatchObject({ date: true });
  });

  it('flags full dates and full windows', () => {
    expect(step2Errors(draft({ date: '2026-10-28' }), av())).toMatchObject({ full: true });
    expect(step2Errors(draft({ window: 'midday' }), av())).toMatchObject({ windowFull: true });
  });

  it('flags a full route day for yards', () => {
    expect(step2Errors(draft({ svc: 'pet', routeDay: 'Tue', date: null, window: null }), av())).toMatchObject({ dayFull: true });
    expect(step2Errors(draft({ svc: 'pet', routeDay: null, date: null, window: null }), av())).toMatchObject({ day: true });
  });

  it('checks name, phone and email', () => {
    expect(step3Errors(draft({ name: ' ', phone: '(404) 555-01', email: 'jordan@' }))).toEqual({ name: true, phone: true, email: true });
  });

  it('normalises US mobiles', () => {
    expect(toE164('(404) 555-0187')).toBe('+14045550187');
    expect(toE164('1-404-555-0187')).toBe('+14045550187');
    expect(toE164('(104) 555-0187')).toBeNull();
  });
});

describe('prices', () => {
  it('prices a 3 bd / 2 ba biweekly first clean at $132', () => {
    expect(quoteClean(DEFAULT_CLEAN)).toMatchObject({ base: 165, discount: 33, total: 132, recurring: true });
    expect(quoteClean(DEFAULT_CLEAN, false)).toMatchObject({ discount: 0, total: 165 });
  });

  it('prices deep cleans as one-time', () => {
    expect(quoteClean({ ...DEFAULT_CLEAN, service: 'deep', freq: 'weekly' })).toMatchObject({ base: 360, recurring: false, line: 'Deep clean · One-time · 3 bd / 2 ba' });
  });

  it('prices yards and their first visit', () => {
    expect(quotePet({ ...DEFAULT_PET_STEP1, dogs: 2 })).toMatchObject({ visit: 27, initial: 39, firstTotal: 39 });
    expect(quotePet({ ...DEFAULT_PET_STEP1, cond: 'kept' })).toMatchObject({ visit: 24, initial: 0, firstTotal: 24 });
    expect(quotePet({ ...DEFAULT_PET_STEP1, dogs: 5 })).toBeNull();
    expect(quotePet({ ...DEFAULT_PET_STEP1, yard: 'large' })).toBeNull();
    expect(routeLong({ ...DEFAULT_PET_STEP1, petFreq: 'biweekly' }, 'Tue')).toBe('Every Tuesday, every other week');
  });
});
