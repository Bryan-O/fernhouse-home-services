import { PRO_PAY } from './config';
import { addDays, weekday } from './booking';

// What Fernhouse owes pros: a share of each completed visit (lib/config.ts → PRO_PAY).

export interface PayableVisit {
  price_cents: number;
  upgrade_cents: number | null;
  upgrade_status: string | null;
}

/** The pro's pay for one completed visit, in cents. */
export function proPayCents(v: PayableVisit): number {
  const base = v.upgrade_status === 'approved' && v.upgrade_cents ? v.upgrade_cents : v.price_cents;
  return Math.round((base * PRO_PAY.pctOfVisit) / 100);
}

/** Monday of the pay week that contains this date (YYYY-MM-DD). */
export function payWeekStart(iso: string): string {
  return addDays(iso, -((weekday(iso) + 6) % 7));
}
