// The change and cancellation rules (lib/config.ts → POLICIES), as plain functions so the
// manage page and the server apply exactly the same rule.

import { ARRIVAL_WINDOWS, POLICIES, TIMEZONE, type ArrivalWindowId } from './config';
import { addDays, DAY_NAMES, MONTH_NAMES, weekday } from './booking';

/** The UTC instant of an Atlanta wall-clock time (handles daylight saving). */
export function atlantaTime(iso: string, hour: number, minute = 0): Date {
  const [y, m, d] = iso.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d, hour, minute);
  // How far Atlanta is behind UTC at that moment.
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: TIMEZONE, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' })
    .formatToParts(new Date(guess))
    .reduce<Record<string, number>>((acc, p) => (p.type === 'literal' ? acc : { ...acc, [p.type]: Number(p.value) }), {});
  const shown = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  return new Date(guess + (guess - shown));
}

const hour12 = (h: number) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'AM' : 'PM'}`;

/** "Mon, Oct 26 at 8 AM" (Atlanta time). */
export function fmtDeadline(iso: string, hour: number): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${DAY_NAMES[weekday(iso)].slice(0, 3)}, ${MONTH_NAMES[m - 1].slice(0, 3)} ${d} at ${hour12(hour)}`;
}

export interface ChangeTerms {
  allowed: boolean; // can the customer change it online now?
  free: boolean; // no fee
  feeCents: number;
  deadline: Date; // free (cleaning) or last (yards) change time
  deadlineLabel: string;
  hoursUntil: number;
}

/**
 * Cleaning visits: free until 24 hours before the arrival window starts, then the late fee,
 * until the window starts. Yard visits: free until 8 PM the night before; after that,
 * changes go through a text or call.
 */
export function changeTerms(visit: { date: string; window: ArrivalWindowId | null }, now: Date = new Date()): ChangeTerms {
  if (visit.window) {
    const w = ARRIVAL_WINDOWS.find((x) => x.id === visit.window)!;
    const start = atlantaTime(visit.date, w.startHour);
    const deadline = new Date(start.getTime() - POLICIES.freeChangeHours * 3600_000);
    const free = now < deadline;
    const deadlineDay = addDays(visit.date, -Math.floor(POLICIES.freeChangeHours / 24));
    return {
      allowed: now < start,
      free,
      feeCents: free ? 0 : POLICIES.lateCancelFee * 100,
      deadline,
      deadlineLabel: fmtDeadline(deadlineDay, w.startHour),
      hoursUntil: Math.max(0, Math.round((start.getTime() - now.getTime()) / 3600_000)),
    };
  }
  const cutoffDay = addDays(visit.date, -1);
  const deadline = atlantaTime(cutoffDay, POLICIES.petChangeCutoffHour);
  return {
    allowed: now < deadline,
    free: true,
    feeCents: 0,
    deadline,
    deadlineLabel: fmtDeadline(cutoffDay, POLICIES.petChangeCutoffHour),
    hoursUntil: Math.max(0, Math.round((atlantaTime(visit.date, 0).getTime() - now.getTime()) / 3600_000)),
  };
}

/** Re-clean / re-scoop can be requested until 24 hours after the visit was marked done. */
export function guaranteeOpen(completedAt: string | null, now: Date = new Date()): { open: boolean; until: Date | null } {
  if (!completedAt) return { open: false, until: null };
  const until = new Date(new Date(completedAt).getTime() + POLICIES.guaranteeHours * 3600_000);
  return { open: now < until, until };
}
