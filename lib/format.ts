// How values read inside texts and emails ("Tue, Oct 27, 8–11 AM", "$165", "Visa 4242").
// Pure functions so the wording can be unit-tested.

import { ARRIVAL_WINDOWS, BRAND, CLEAN_SERVICE_LABEL, PET_FREQ_LABEL, ROUTE_DAYS, TIMEZONE, type ArrivalWindowId } from './config';
import { DAY_NAMES, MONTH_NAMES, addDays, todayIso, weekday } from './booking';
import { changeTerms } from './policy';

/** "$165" for whole dollars, "$27.50" otherwise. */
export const money = (cents: number) => `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
export const moneyExact = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/** "Visa 4242" (texts) — falls back to "your card". */
export function cardText(brand: string | null, last4: string | null): string {
  if (!last4) return 'your card';
  const b = (brand ?? 'Card').toLowerCase();
  const name = b === 'amex' ? 'Amex' : b === 'mastercard' ? 'Mastercard' : b.charAt(0).toUpperCase() + b.slice(1);
  return `${name} ${last4}`;
}

/** "Visa •••• 4242" (emails). */
export const cardEmail = (brand: string | null, last4: string | null) => (last4 ? cardText(brand, last4).replace(/ (\d{4})$/, ' •••• $1') : 'your card');


const parts = (iso: string) => iso.split('-').map(Number) as [number, number, number];
/** "Oct 27" */
export const monthDay = (iso: string) => `${MONTH_NAMES[parts(iso)[1] - 1].slice(0, 3)} ${parts(iso)[2]}`;
/** "Tue, Oct 27" */
export const dayDate = (iso: string) => `${DAY_NAMES[weekday(iso)].slice(0, 3)}, ${monthDay(iso)}`;
export const windowShort = (w: ArrivalWindowId | string | null) => ARRIVAL_WINDOWS.find((x) => x.id === w)?.short ?? '';
/** "Tue, Oct 27, 8–11 AM" */
export const visitWhen = (iso: string, w: ArrivalWindowId | string | null) => (w ? `${dayDate(iso)}, ${windowShort(w)}` : dayDate(iso));
/** Owner texts: "Tue Oct 27 8–11 AM" */
export const ownerWhen = (iso: string, w: ArrivalWindowId | string | null) => `${DAY_NAMES[weekday(iso)].slice(0, 3)} ${monthDay(iso)}${w ? ` ${windowShort(w)}` : ''}`;

const hourText = (h: number, m = 0) => `${h % 12 === 0 ? 12 : h % 12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'AM' : 'PM'}`;

/** "Mon 8 AM" — the last free-change time for a cleaning visit, or "Mon 8 PM" for a yard visit. */
export function freeUntil(iso: string, w: ArrivalWindowId | string | null): string {
  const t = changeTerms({ date: iso, window: (w as ArrivalWindowId) ?? null });
  const atl = atlantaParts(t.deadline);
  return `${DAY_NAMES[weekday(atl.iso)].slice(0, 3)} ${hourText(atl.hour, atl.minute)}`;
}

function atlantaParts(d: Date): { iso: string; hour: number; minute: number } {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: TIMEZONE, hourCycle: 'h23', hour: 'numeric', minute: 'numeric' }).formatToParts(d);
  const get = (t: string) => Number(p.find((x) => x.type === t)?.value ?? 0);
  return { iso: todayIso(d), hour: get('hour'), minute: get('minute') };
}

/** "11 AM tomorrow" / "11:42 AM tomorrow" / "Wed 9 AM" — when a guarantee window closes, seen from `now`. */
export function untilText(until: Date, now: Date = new Date()): string {
  const a = atlantaParts(until);
  const t = hourText(a.hour, a.minute);
  const today = todayIso(now);
  if (a.iso === today) return `${t} today`;
  if (a.iso === addDays(today, 1)) return `${t} tomorrow`;
  return `${DAY_NAMES[weekday(a.iso)].slice(0, 3)} ${t}`;
}

/** "9:40 AM" */
export const clockText = (d: Date) => {
  const a = atlantaParts(d);
  return hourText(a.hour, a.minute);
};

/** "Taylor M." — owner alerts never need a full name. */
export function shortName(name: string): string {
  const [first, ...rest] = name.trim().split(/\s+/);
  const last = rest.pop();
  return last ? `${first} ${last.charAt(0).toUpperCase()}.` : first;
}

export const firstName = (name: string) => name.trim().split(/\s+/)[0];

/** "Standard clean", "Deep clean", "Move-In/Out clean" */
export const cleanServiceText = (s: string) => (s === 'standard' ? 'Standard clean' : s === 'move' ? `${CLEAN_SERVICE_LABEL.move} clean` : CLEAN_SERVICE_LABEL.deep);

export const routeFull = (rd: string | null) => ROUTE_DAYS.find((r) => r.id.toLowerCase() === rd?.toLowerCase())?.full ?? '';

const PET_FREQ_KEY: Record<string, keyof typeof PET_FREQ_LABEL> = { weekly: 'weekly', twice_weekly: 'twice', biweekly: 'biweekly', one_time: 'once' };
export const petFreqLabel = (f: string) => PET_FREQ_LABEL[PET_FREQ_KEY[f] ?? 'weekly'];

// Twice-weekly second visit day (same mapping as the database's second_route_day).
const SECOND: Record<string, string> = { mon: 'thu', tue: 'fri', wed: 'fri', thu: 'mon', fri: 'tue' };

/** "Weekly on Tuesdays", "Every other Tuesday", "Twice a week, Tuesdays and Fridays", "One-time cleanup on Tuesday" */
export function yardPlanText(freq: string, routeDay: string | null): string {
  const day = routeFull(routeDay);
  if (freq === 'one_time') return `One-time cleanup on ${day}`;
  if (freq === 'biweekly') return `Every other ${day}`;
  if (freq === 'twice_weekly') return `Twice a week, ${day}s and ${routeFull(SECOND[routeDay ?? ''] ?? '')}s`;
  return `Weekly on ${day}s`;
}

/** Links in texts drop "https://" on our own domain, as designed (fernhouseclean.com/b/…). */
export function displayUrl(url: string): string {
  return url.startsWith(`https://${BRAND.domain}/`) ? url.slice('https://'.length) : url;
}

/** Owner dashboard link for a booking: /admin/b/04817 from FH-26-04817. */
export const adminBookingPath = (ref: string) => `/admin/b/${ref.split('-').pop()}`;
