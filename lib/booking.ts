// Booking flow rules shared by the browser and the server: dates in Atlanta time,
// field validation and prices. The server re-runs all of it before saving anything.

import {
  ARRIVAL_WINDOWS,
  BOOKING,
  CLEAN_FREQ_LABEL,
  CLEAN_SERVICE_LABEL,
  cityForZip,
  cleanVisitPrice,
  dogsText,
  firstCleanDiscount,
  lookupHome,
  PET_FREQ_LABEL,
  PET_WASTE_PRICING,
  petInitial,
  petVisit,
  ROUTE_DAYS,
  TIMEZONE,
  YARD_CONDITIONS,
  type ArrivalWindowId,
  type RouteDayId,
} from './config';
import type { CleanStep1, PetStep1, ServiceTab } from './booking-store';

// ───────── Draft (what the visitor has entered so far) ─────────

export interface BookingDraft {
  svc: ServiceTab;
  clean: CleanStep1;
  pet: PetStep1;
  zip: string;
  date: string | null; // YYYY-MM-DD, cleaning only
  window: ArrivalWindowId | null; // cleaning only
  routeDay: RouteDayId | null; // pet only
  address: string;
  unit: string;
  name: string;
  phone: string;
  email: string;
  access: string; // cleaning: how the team gets in
  pets: boolean;
  petNote: string;
  requests: string;
  smsPromo: boolean; // separate, unchecked marketing opt-in
  gate: string; // pet: gate code or access notes
  dogNames: string;
  dogsFriendly: boolean;
}

// ───────── Dates (ISO strings, Atlanta calendar) ─────────

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const pad = (n: number) => (n < 10 ? '0' : '') + n;
const parts = (iso: string) => iso.split('-').map(Number) as [number, number, number];

/** Today's date in Atlanta, as YYYY-MM-DD. */
export function todayIso(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function addDays(iso: string, n: number): string {
  const [y, m, d] = parts(iso);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

export function weekday(iso: string): number {
  const [y, m, d] = parts(iso);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function daysBetween(fromIso: string, toIso: string): number {
  const [a, b, c] = parts(fromIso);
  const [x, y, z] = parts(toIso);
  return Math.round((Date.UTC(x, y - 1, z) - Date.UTC(a, b - 1, c)) / 86400000);
}

export function fmtLong(iso: string): string {
  const [, m, d] = parts(iso);
  return `${DAY_NAMES[weekday(iso)]}, ${MONTH_NAMES[m - 1]} ${d}`;
}

export function fmtShort(iso: string): string {
  const [, m, d] = parts(iso);
  return `${DAY_NAMES[weekday(iso)].slice(0, 3)}, ${MONTH_NAMES[m - 1].slice(0, 3)} ${d}`;
}

/** Cleaning dates can be booked from tomorrow up to 60 days out. */
export function isBookableDate(iso: string, today: string): boolean {
  const off = daysBetween(today, iso);
  return off >= BOOKING.firstBookableOffsetDays && off <= BOOKING.windowDays;
}

/** First yard visit: the chosen weekday, at least 2 days out. */
export function firstRouteDate(routeDay: RouteDayId, today: string): string {
  const day = ROUTE_DAYS.find((r) => r.id === routeDay)!.day;
  for (let i = BOOKING.firstRouteOffsetDays; i < BOOKING.firstRouteOffsetDays + 7; i++) {
    const iso = addDays(today, i);
    if (weekday(iso) === day) return iso;
  }
  throw new Error('unreachable');
}

// ───────── Availability ─────────

/** Slots left per date and window (cleaning) and per route day (yards). */
export interface Availability {
  today: string;
  clean: Record<string, Record<ArrivalWindowId, number>>;
  /** Dates with no capacity set at all (Sundays, blocked days): unavailable, not "Full". */
  closed: string[];
  yard: Record<RouteDayId, number>;
}

export function isClosedDate(av: Availability, iso: string): boolean {
  return av.closed.includes(iso);
}

export function windowsLeft(av: Availability, iso: string): Record<ArrivalWindowId, number> {
  return av.clean[iso] ?? { morning: 0, midday: 0, afternoon: 0 };
}

export function isFullDate(av: Availability, iso: string): boolean {
  const w = windowsLeft(av, iso);
  return ARRIVAL_WINDOWS.every((x) => w[x.id] <= 0);
}

/** The next `count` open dates after `iso`, for the "fully booked" suggestions. */
export function openDatesAfter(av: Availability, iso: string, count: number): string[] {
  const out: string[] = [];
  for (let i = 1; out.length < count && i <= BOOKING.windowDays; i++) {
    const d = addDays(iso, i);
    if (!isBookableDate(d, av.today)) break;
    if (!isClosedDate(av, d) && !isFullDate(av, d)) out.push(d);
  }
  return out;
}

// ───────── Validation ─────────

export const digits = (s: string) => String(s || '').replace(/\D/g, '');

/** US mobile in E.164 (+1XXXXXXXXXX), or null if it isn't a valid 10-digit number. */
export function toE164(phone: string): string | null {
  let d = digits(phone);
  if (d.length === 11 && d.startsWith('1')) d = d.slice(1);
  return /^[2-9]\d{9}$/.test(d) ? `+1${d}` : null;
}

/** (404) 555-0187 */
export function formatPhone(phone: string): string {
  const e = toE164(phone);
  if (!e) return phone;
  const d = e.slice(2);
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s).trim());

export type Step2Errors = Partial<Record<'zip' | 'zipOut' | 'date' | 'full' | 'window' | 'windowFull' | 'address' | 'day' | 'dayFull', true>>;
export type Step3Errors = Partial<Record<'name' | 'phone' | 'email', true>>;

export function step2Errors(d: BookingDraft, av: Availability | null): Step2Errors {
  const e: Step2Errors = {};
  if (!/^\d{5}$/.test(d.zip)) e.zip = true;
  else if (!cityForZip(d.zip)) e.zipOut = true;
  if (!String(d.address).trim()) e.address = true;
  if (d.svc === 'pet') {
    if (!d.routeDay) e.day = true;
    else if (av && av.yard[d.routeDay] <= 0) e.dayFull = true;
    return e;
  }
  if (!d.date || (av && (!isBookableDate(d.date, av.today) || isClosedDate(av, d.date)))) e.date = true;
  else if (av && isFullDate(av, d.date)) e.full = true;
  if (!d.window) e.window = true;
  else if (av && d.date && windowsLeft(av, d.date)[d.window] <= 0) e.windowFull = true;
  return e;
}

export function step3Errors(d: BookingDraft): Step3Errors {
  const e: Step3Errors = {};
  if (!String(d.name).trim()) e.name = true;
  if (!toE164(d.phone)) e.phone = true;
  if (!isEmail(d.email)) e.email = true;
  return e;
}

// ───────── Prices and labels ─────────

export interface CleanQuote {
  base: number;
  discount: number;
  total: number;
  recurring: boolean;
  freqName: string;
  sizeLabel: string;
  line: string; // Standard · Biweekly · 3 bd / 2 ba
  afterLine: string;
}

/** Price for a home-cleaning Step 1 choice, or null when it needs a custom quote. */
export function quoteClean(c: CleanStep1, withOffer = true): CleanQuote | null {
  const row = lookupHome(c.beds, c.baths);
  if (!row) return null;
  const freq = c.service === 'standard' ? c.freq : 'oneTime';
  const base = cleanVisitPrice(row, c.service, freq);
  const discount = withOffer ? firstCleanDiscount(base) : 0;
  const recurring = c.service === 'standard' && c.freq !== 'oneTime';
  const freqName = c.service === 'standard' ? CLEAN_FREQ_LABEL[c.freq] : 'One-time';
  const sizeLabel = `${c.beds} bd / ${c.baths} ba`;
  return {
    base,
    discount,
    total: base - discount,
    recurring,
    freqName,
    sizeLabel,
    line: `${CLEAN_SERVICE_LABEL[c.service]} · ${freqName} · ${sizeLabel}`,
    afterLine: recurring ? `Then $${base} per visit, ${CLEAN_FREQ_LABEL[c.freq].toLowerCase()}. No contracts.` : 'One-time visit.',
  };
}

export interface PetQuote {
  visit: number;
  initial: number;
  firstTotal: number;
  once: boolean;
  line: string; // Pet waste removal · Weekly · 2 dogs
  condLabel: string;
  afterLine: string;
}

/** Price for a pet-waste Step 1 choice, or null when it needs a quote (5+ dogs, over ½ acre). */
export function quotePet(p: PetStep1): PetQuote | null {
  if (p.dogs > PET_WASTE_PRICING.maxDogs || p.yard === 'large') return null;
  const visit = petVisit(p.petFreq, p.dogs);
  const initial = petInitial(p.petFreq, p.cond);
  const once = p.petFreq === 'once';
  return {
    visit,
    initial,
    firstTotal: once ? visit : initial || visit,
    once,
    line: `Pet waste removal · ${PET_FREQ_LABEL[p.petFreq]} · ${dogsText(p.dogs)}`,
    condLabel: YARD_CONDITIONS.find((c) => c.id === p.cond)?.lower ?? '',
    afterLine: once
      ? 'Charged after the visit.'
      : `Then $${visit} per visit, ${PET_FREQ_LABEL[p.petFreq].toLowerCase()}. Charged after each visit, no contracts.`,
  };
}

/** How the route day reads in the review (e.g. "Every Tuesday, every other week"). */
export function routeLong(p: PetStep1, routeDay: RouteDayId): string {
  const r = ROUTE_DAYS.find((x) => x.id === routeDay)!;
  if (p.petFreq === 'once') return r.full;
  return `Every ${r.full}${p.petFreq === 'biweekly' ? ', every other week' : p.petFreq === 'twice' ? ' + a second weekly visit' : ''}`;
}

export function routeShort(p: PetStep1, routeDay: RouteDayId | null): string {
  if (!routeDay) return 'Pick a day';
  const r = ROUTE_DAYS.find((x) => x.id === routeDay)!;
  return p.petFreq === 'once' ? r.full : `${r.full}s`;
}
