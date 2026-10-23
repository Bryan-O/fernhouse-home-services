import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { createServiceClient } from './supabase/admin';
import { decryptField } from './crypto';
import { changeTerms, guaranteeOpen } from './policy';
import { addDays, todayIso } from './booking';
import {
  ARRIVAL_WINDOWS,
  BOOKING,
  CLEAN_SERVICE_LABEL,
  dogsText,
  LINKS,
  PET_FREQ_LABEL,
  ROUTE_DAYS,
  type ArrivalWindowId,
} from './config';

// ───────── Manage links (/b/[token]) ─────────
// A random token is texted to the customer; only its SHA-256 hash is stored. No passwords.

const hash = (token: string) => createHash('sha256').update(token).digest('hex');

export async function createManageToken(customerId: string): Promise<string> {
  const token = randomBytes(24).toString('base64url');
  const expires = new Date(Date.now() + LINKS.manageLinkDays * 86400_000).toISOString();
  const { error } = await createServiceClient().from('manage_tokens').insert({ customer_id: customerId, token_hash: hash(token), expires_at: expires });
  if (error) throw new Error(`manage token insert failed: ${error.message}`);
  return token;
}

/** The customer a manage link belongs to, if it's well-formed, known and unexpired. */
export async function customerForToken(token: string): Promise<string | null> {
  if (!/^[A-Za-z0-9_-]{32}$/.test(token)) return null;
  const { data } = await createServiceClient()
    .from('manage_tokens')
    .select('customer_id')
    .eq('token_hash', hash(token))
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  return data?.customer_id ?? null;
}

// ───────── What the manage page shows ─────────

export interface VisitView {
  id: string;
  date: string;
  window: ArrivalWindowId | null;
  status: string;
  teamConfirmed: boolean;
  prepaid: boolean;
  feeCents: number;
  terms: { allowed: boolean; free: boolean; feeCents: number; deadlineLabel: string; hoursUntil: number };
}

export interface PlanView {
  id: string;
  ref: string;
  service: 'standard' | 'deep' | 'move' | 'pet';
  isPet: boolean;
  frequency: 'one_time' | 'weekly' | 'biweekly' | 'twice_weekly';
  status: 'active' | 'paused' | 'ended';
  serviceLine: string;
  planLine: string;
  freqPill: string;
  pricePerVisitCents: number;
  chargeLine: string;
  addressLine: string;
  access: string;
  gate: string;
  petsNote: string;
  requests: string;
  dogNames: string;
  dogsFriendly: boolean | null;
  routeDay: string | null;
  next: VisitView | null;
  upcoming: VisitView[];
  /** The soonest skipped visit that can still be brought back (no fee, not passed). */
  skipped: VisitView | null;
  lastDone: { id: string; date: string; completedAt: string; gatePhotoUrl: string | null; canRequest: boolean; requested: boolean; requestUntil: string | null } | null;
  lastCharge: { amountCents: number; date: string; receiptUrl: string | null } | null;
}

export interface ManageView {
  customerId: string;
  firstName: string;
  phone: string;
  email: string;
  card: { brand: string; last4: string } | null;
  plans: PlanView[];
}

const routeName = (rd: string | null) => ROUTE_DAYS.find((r) => r.id.toLowerCase() === rd)?.full ?? '';
const weekdayName = (iso: string) => ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date(`${iso}T12:00:00Z`).getUTCDay()];

function planLine(p: { service: string; frequency: string; route_day: string | null }, anchor: string | null): string {
  if (p.service === 'pet') {
    const day = routeName(p.route_day);
    if (p.frequency === 'one_time') return `One-time yard cleanup on ${day}.`;
    const how = p.frequency === 'biweekly' ? `every other ${day}` : p.frequency === 'twice_weekly' ? `twice a week, starting ${day}s` : `every ${day}`;
    return `${PET_FREQ_LABEL[p.frequency === 'twice_weekly' ? 'twice' : p.frequency === 'biweekly' ? 'biweekly' : 'weekly']} yard service, ${how}. No contract — pause or cancel anytime.`;
  }
  const day = anchor ? weekdayName(anchor) : '';
  if (p.frequency === 'one_time') return `One-time ${CLEAN_SERVICE_LABEL[p.service as 'standard'].toLowerCase()}${p.service === 'standard' ? ' clean' : ''}.`;
  return `${p.frequency === 'weekly' ? 'Weekly' : 'Biweekly'} standard clean, ${p.frequency === 'weekly' ? 'every' : 'every other'} ${day}. No contract — pause or cancel anytime.`;
}

interface PlanRow {
  id: string; ref: string; service: PlanView['service']; frequency: PlanView['frequency']; status: string;
  beds: number | null; baths: number | null; dogs: number | null; route_day: string | null; window: ArrivalWindowId | null;
  price_per_visit_cents: number; pets_note: string | null; requests: string | null; dog_names: string | null; dogs_friendly: boolean | null;
  cadence_anchor: string | null; created_at: string;
  address: { street: string; unit: string | null; city: string; zip: string; access_notes: string | null; gate_code: string | null };
  visits: { id: string; date: string; window: ArrivalWindowId | null; status: string; pro_id: string | null; fee_cents: number; completed_at: string | null; gate_photo_url: string | null; occurrence_date: string;
    payments: { kind: string; status: string; amount_cents: number; refunded_cents: number; created_at: string; receipt_url: string | null }[];
    // One request per visit (unique), so Supabase returns an object or null here, not a list.
    service_requests: { id: string } | { id: string }[] | null }[];
}

export async function loadManage(customerId: string): Promise<ManageView | null> {
  const db = createServiceClient();
  const { data: c } = await db.from('customers').select('id, name, mobile, email, card_brand, card_last4').eq('id', customerId).single();
  if (!c) return null;

  // Keep recurring schedules filled 60 days ahead (build step 8's daily job does this too).
  const { data: live } = await db.from('plans').select('id').eq('customer_id', customerId).eq('status', 'active').neq('frequency', 'one_time');
  for (const p of live ?? []) await db.rpc('generate_plan_visits', { p_plan_id: p.id, p_through: addDays(todayIso(), BOOKING.windowDays) });

  const { data: rows } = await db
    .from('plans')
    .select(`id, ref, service, frequency, status, beds, baths, dogs, route_day, window, price_per_visit_cents, pets_note, requests, dog_names, dogs_friendly, cadence_anchor, created_at,
      address:addresses(street, unit, city, zip, access_notes, gate_code),
      visits(id, date, window, status, pro_id, fee_cents, completed_at, gate_photo_url, occurrence_date,
        payments(kind, status, amount_cents, refunded_cents, created_at, receipt_url), service_requests(id))`)
    .eq('customer_id', customerId)
    .in('status', ['active', 'paused', 'ended'])
    .order('created_at', { ascending: false })
    .returns<PlanRow[]>();

  const today = todayIso();
  const plans: PlanView[] = [];
  for (const p of rows ?? []) {
    const visits = [...p.visits].sort((a, b) => a.date.localeCompare(b.date));
    const open = visits.filter((v) => (v.status === 'scheduled' || v.status === 'confirmed') && v.date >= today);
    // Ended plans only show while they still have something to see (e.g. a visit kept after cancelling).
    if (p.status === 'ended' && !open.length && plans.length) continue;
    const toView = (v: PlanRow['visits'][number]): VisitView => {
      const t = changeTerms({ date: v.date, window: v.window });
      return {
        id: v.id, date: v.date, window: v.window, status: v.status, teamConfirmed: v.status === 'confirmed',
        prepaid: v.payments.some((x) => x.kind === 'visit' && x.status === 'succeeded'), feeCents: v.fee_cents,
        terms: { allowed: t.allowed, free: t.free, feeCents: t.feeCents, deadlineLabel: t.deadlineLabel, hoursUntil: t.hoursUntil },
      };
    };
    const done = visits.filter((v) => v.status === 'done' && v.completed_at).pop() ?? null;
    const requested = !!done && (Array.isArray(done.service_requests) ? done.service_requests.length > 0 : !!done.service_requests);
    let lastDone: PlanView['lastDone'] = null;
    if (done) {
      const g = guaranteeOpen(done.completed_at);
      let photo: string | null = null;
      if (done.gate_photo_url) {
        const s = await db.storage.from('gate-photos').createSignedUrl(done.gate_photo_url, 3600);
        photo = s.data?.signedUrl ?? null;
      }
      lastDone = { id: done.id, date: done.date, completedAt: done.completed_at!, gatePhotoUrl: photo, canRequest: g.open && !requested, requested, requestUntil: g.until?.toISOString() ?? null };
    }
    const charges = visits.flatMap((v) => v.payments.filter((x) => x.status === 'succeeded').map((x) => ({ ...x, date: x.created_at })))
      .sort((a, b) => b.date.localeCompare(a.date));
    const isPet = p.service === 'pet';
    const window = ARRIVAL_WINDOWS.find((w) => w.id === p.window);
    plans.push({
      id: p.id, ref: p.ref, service: p.service, isPet, frequency: p.frequency, status: p.status as PlanView['status'],
      serviceLine: isPet ? `Pet waste removal · ${dogsText(p.dogs ?? 1)}` : `${CLEAN_SERVICE_LABEL[p.service as 'standard']}${p.service === 'standard' ? ' clean' : ''} · ${p.beds} bed, ${p.baths} bath`,
      planLine: planLine(p, p.cadence_anchor ?? visits[0]?.occurrence_date ?? null),
      freqPill: isPet ? `${PET_FREQ_LABEL[p.frequency === 'twice_weekly' ? 'twice' : p.frequency === 'biweekly' ? 'biweekly' : p.frequency === 'one_time' ? 'once' : 'weekly']} · ${routeName(p.route_day)}s` : window?.short ?? '',
      pricePerVisitCents: p.price_per_visit_cents,
      chargeLine: isPet ? 'charged after each visit' : p.frequency === 'one_time' ? 'paid at booking' : 'charged the morning of your visit',
      addressLine: `${p.address.street}${p.address.unit ? `, ${p.address.unit}` : ''}, ${p.address.city}, GA ${p.address.zip}`,
      access: decryptField(p.address.access_notes) ?? '',
      gate: decryptField(p.address.gate_code) ?? '',
      petsNote: p.pets_note ?? '', requests: p.requests ?? '', dogNames: p.dog_names ?? '', dogsFriendly: p.dogs_friendly,
      routeDay: p.route_day,
      next: open[0] ? toView(open[0]) : null,
      upcoming: open.slice(0, 3).map(toView),
      skipped: (() => {
        const v = visits.find((x) => x.status === 'skipped' && x.fee_cents === 0 && x.date > today);
        return v && changeTerms({ date: v.date, window: v.window }).allowed ? toView(v) : null;
      })(),
      lastDone,
      lastCharge: charges[0] ? { amountCents: charges[0].amount_cents - charges[0].refunded_cents, date: charges[0].date, receiptUrl: charges[0].receipt_url } : null,
    });
  }

  return {
    customerId: c.id,
    firstName: c.name.trim().split(/\s+/)[0],
    phone: c.mobile,
    email: c.email,
    card: c.card_last4 ? { brand: c.card_brand ?? 'Card', last4: c.card_last4 } : null,
    plans,
  };
}

// ───────── Private rating (from the rating email) ─────────

export interface RatingPrompt { visitId: string; what: string; score: number | null; already: boolean }

/** The rating card for a done visit of this customer, with the score tapped in the email. */
export async function loadRatingPrompt(customerId: string, visitId: string | undefined, score: string | undefined): Promise<RatingPrompt | null> {
  if (!visitId || !/^[0-9a-f-]{36}$/i.test(visitId)) return null;
  const db = createServiceClient();
  const { data: v } = await db.from('visits').select('id, date, status, plan:plans!inner(customer_id, service)').eq('id', visitId)
    .single<{ id: string; date: string; status: string; plan: { customer_id: string; service: string } }>();
  if (!v || v.plan.customer_id !== customerId || v.status !== 'done') return null;
  const { data: r } = await db.from('ratings').select('id').eq('visit_id', v.id).maybeSingle();
  const n = Number(score);
  const [, m, d] = v.date.split('-').map(Number);
  const what = `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]} ${d} ${v.plan.service === 'pet' ? 'yard visit' : 'clean'}`;
  return { visitId: v.id, what, score: Number.isInteger(n) && n >= 1 && n <= 5 ? n : null, already: !!r };
}
