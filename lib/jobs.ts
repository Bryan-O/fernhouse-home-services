import 'server-only';
import { createServiceClient } from './supabase/admin';
import { stripe, stripeConfigured } from './stripe';
import { chargeVisit } from './payments';
import { confirmCheckout } from './checkout';
import { EMAILS, PLAN_NAME, TEXTS, VISIT_WORD } from './messages';
import { AUTOMATIONS, BOOKING, type ArrivalWindowId } from './config';
import { addDays, todayIso } from './booking';
import { atlantaParts, cardText, cleanServiceText, displayUrl, money, monthDay, ownerWhen, petFreqLabel, shortName, untilText, windowShort } from './format';
import { manageLink, publicOrigin, sendEmail, sendText } from './notify';
import { createProLink } from './pro-links';

// Scheduled jobs (/api/cron, called every hour). Each job decides from the Atlanta
// clock whether it's due, and is safe to run again: charges use Stripe idempotency keys and
// messages use send-once keys. A missed hour is caught up on the next run.

export type JobResult = Record<string, number | string | undefined>;
type Job = (now: Date) => Promise<JobResult>;

const ownerMobile = () => process.env.OWNER_ALERT_MOBILE || null;
const adminLink = () => `${publicOrigin()}/admin`.replace(/^https:\/\//, '');
const FREQ: Record<string, string> = { weekly: 'Weekly', biweekly: 'Biweekly', one_time: 'One-time', twice_weekly: 'Twice weekly' };

/** Keep every recurring plan's visits filled in 60 days ahead. */
export const extendSchedules: Job = async (now) => {
  const db = createServiceClient();
  const { data: plans } = await db.from('plans').select('id').eq('status', 'active').neq('frequency', 'one_time');
  let added = 0;
  for (const p of plans ?? []) {
    const { data, error } = await db.rpc('generate_plan_visits', { p_plan_id: p.id, p_through: addDays(todayIso(now), BOOKING.windowDays) });
    if (error) throw new Error(`generate_plan_visits: ${error.message}`);
    added += Number(data ?? 0);
  }
  return { plans: plans?.length ?? 0, visitsAdded: added };
};

/** Checkout never finished: release the slot. If Stripe says it was paid after all, confirm it instead. */
export const releaseStaleBookings: Job = async (now) => {
  const db = createServiceClient();
  const cutoff = new Date(now.getTime() - AUTOMATIONS.pendingBookingCleanupHours * 3600_000).toISOString();
  const { data: stale } = await db.from('plans').select('id, stripe_checkout_session_id').eq('status', 'pending').lt('created_at', cutoff).limit(100);
  let released = 0, confirmed = 0;
  for (const p of stale ?? []) {
    if (p.stripe_checkout_session_id && stripeConfigured()) {
      const s = await stripe().checkout.sessions.retrieve(p.stripe_checkout_session_id).catch(() => null);
      if (s?.status === 'complete') {
        const r = await confirmCheckout(s.id);
        if (r.ok) { confirmed++; continue; }
      } else if (s?.status === 'open') {
        await stripe().checkout.sessions.expire(s.id).catch(() => undefined);
      }
    }
    const { error } = await db.rpc('abandon_booking', { p_plan_id: p.id });
    if (!error) released++;
  }
  return { released, confirmed };
};

/** Recurring cleans are charged to the saved card on the morning of the visit. */
export const chargeRecurringCleans: Job = async (now) => {
  if (atlantaParts(now).hour < AUTOMATIONS.recurringChargeHour) return { skipped: 'before charge hour' };
  if (!stripeConfigured()) return { skipped: 'stripe not configured' };
  const { data: due, error } = await createServiceClient().rpc('clean_charges_due', { p_today: todayIso(now), p_limit: 50 });
  if (error) throw new Error(`clean_charges_due: ${error.message}`);
  let charged = 0, declined = 0, failed = 0;
  for (const id of (due ?? []) as string[]) {
    const r = await chargeVisit(id, 'visit');
    if (r.ok) charged++;
    else if (r.reason === 'declined' || r.reason === 'authentication_required' || r.reason === 'no_card') declined++;
    else failed++;
  }
  return { due: (due ?? []).length, charged, declined, failed };
};

/** 6 PM the day before a clean: the evening-before reminder. */
export const eveningReminders: Job = async (now) => {
  if (atlantaParts(now).hour < AUTOMATIONS.eveningBeforeReminderHour) return { skipped: 'before 6 PM' };
  const tomorrow = addDays(todayIso(now), 1);
  const { data: visits } = await createServiceClient().from('visits')
    .select('id, date, window, plan:plans!inner(service, customer:customers(id, mobile))')
    .eq('date', tomorrow).in('status', ['scheduled', 'confirmed']).not('window', 'is', null)
    .returns<{ id: string; date: string; window: ArrivalWindowId; plan: { service: string; customer: { id: string; mobile: string } } }[]>();
  let sent = 0;
  for (const v of visits ?? []) {
    if (v.plan.service === 'pet') continue;
    const r = await sendText({
      to: v.plan.customer.mobile, customerId: v.plan.customer.id, audience: 'customer', template: 'eveningBefore',
      dedupeKey: `evening:${v.id}:${v.date}`, body: TEXTS.eveningBefore({ window: windowShort(v.window) }),
    });
    if (r.sent) sent++;
  }
  return { visits: visits?.length ?? 0, sent };
};

/** The owner: a booking still without a pro 12 hours later, then every morning at 8 until assigned. */
export const unassignedReminders: Job = async (now) => {
  const db = createServiceClient();
  const today = todayIso(now);
  const { data, error } = await db.rpc('unassigned_visits', { p_today: today, p_days: AUTOMATIONS.unassignedLookaheadDays });
  if (error) throw new Error(`unassigned_visits: ${error.message}`);
  const rows = (data ?? []) as { visit_id: string; date: string; window: ArrivalWindowId | null; city: string; plan_id: string; plan_created_at: string; unassigned_reminded_at: string | null }[];
  if (!rows.length) return { bookings: 0 };
  const plans = [...new Set(rows.map((r) => r.plan_id))];
  const next = rows[0];
  const body = TEXTS.ownerUnassigned({ count: plans.length, next: `${ownerWhen(next.date, next.window)} in ${next.city}`, link: adminLink() });

  // 12 hours after booking (once per booking).
  const cutoff = now.getTime() - AUTOMATIONS.unassignedFirstReminderHours * 3600_000;
  const due12 = [...new Set(rows.filter((r) => !r.unassigned_reminded_at && new Date(r.plan_created_at).getTime() <= cutoff).map((r) => r.plan_id))];
  let sent = 0;
  if (due12.length) {
    const r = await sendText({ to: ownerMobile(), audience: 'owner', template: 'ownerUnassigned', dedupeKey: `unassigned12:${[...due12].sort().join(',')}`, body });
    if (r.sent) sent++;
    await db.from('plans').update({ unassigned_reminded_at: now.toISOString() }).in('id', due12);
  }
  // Every morning at 8.
  if (atlantaParts(now).hour >= AUTOMATIONS.unassignedDailyReminderHour) {
    const r = await sendText({ to: ownerMobile(), audience: 'owner', template: 'ownerUnassigned', dedupeKey: `unassigned-daily:${today}`, body });
    if (r.sent) sent++;
  }
  return { bookings: plans.length, sent };
};

/** Declined charges: one reminder after 24 hours; after 48 hours a recurring plan pauses. */
export const followUpDeclines: Job = async (now) => {
  const db = createServiceClient();
  const since = new Date(now.getTime() - AUTOMATIONS.failedChargeFollowUpDays * 86400_000).toISOString();
  const { data, error } = await db.rpc('open_failed_charges', { p_since: since });
  if (error) throw new Error(`open_failed_charges: ${error.message}`);
  const rows = (data ?? []) as { payment_id: string; visit_id: string; plan_id: string; customer_id: string; kind: string; amount_cents: number; failed_at: string; dunning_paused_at: string | null }[];
  let reminded = 0, paused = 0;
  for (const f of rows) {
    if (f.kind === 'late_fee') continue; // the owner follows these up; the customer isn't chased by text
    const age = now.getTime() - new Date(f.failed_at).getTime();
    const deadline = new Date(new Date(f.failed_at).getTime() + AUTOMATIONS.cardUpdateDeadlineHours * 3600_000);
    const { data: v } = await db.from('visits')
      .select('date, plan:plans(id, service, frequency, status, customer:customers(id, name, mobile, email, card_brand, card_last4))')
      .eq('id', f.visit_id).single<{ date: string; plan: { id: string; service: string; frequency: string; status: string; customer: { id: string; name: string; mobile: string; email: string; card_brand: string | null; card_last4: string | null } } }>();
    if (!v) continue;
    const c = v.plan.customer;

    if (age >= AUTOMATIONS.paymentFailedReminderHours * 3600_000 && now < deadline) {
      const link = await manageLink(c.id);
      const r = await sendText({
        to: c.mobile, customerId: c.id, audience: 'customer', template: 'paymentFailedReminder', dedupeKey: `payfail-reminder:${f.payment_id}`,
        body: TEXTS.paymentFailedReminder({ card: cardText(c.card_brand, c.card_last4), date: monthDay(v.date), deadline: untilText(deadline, now), link: link.text }),
      });
      if (r.sent) reminded++;
    }

    if (now >= deadline && !f.dunning_paused_at) {
      // Mark first, so a resumed plan isn't paused again by the same decline.
      await db.from('payments').update({ dunning_paused_at: now.toISOString() }).eq('id', f.payment_id);
      if (v.plan.status !== 'active' || v.plan.frequency === 'one_time') continue;
      const { data: did } = await db.rpc('set_plan_paused', { p_plan_id: v.plan.id, p_paused: true, p_keep_days: 1 });
      if (!did) continue;
      paused++;
      const isPet = v.plan.service === 'pet';
      const link = await manageLink(c.id);
      await sendEmail({
        to: c.email, customerId: c.id, template: 'planPausedPayment', dedupeKey: `dunning-paused:${f.payment_id}`,
        content: EMAILS.planPausedPayment({ plan: PLAN_NAME(isPet, isPet ? petFreqLabel(v.plan.frequency) : FREQ[v.plan.frequency]), date: monthDay(v.date), link: link.url }),
      });
      await sendText({
        to: ownerMobile(), audience: 'owner', template: 'ownerPlanPaused', dedupeKey: `dunning-paused:${f.payment_id}:owner`,
        body: TEXTS.ownerPlanPaused({ name: shortName(c.name), amount: money(f.amount_cents), what: `${monthDay(v.date)} ${isPet ? VISIT_WORD.pet : 'clean'}`, link: adminLink() }),
      });
    }
  }
  return { open: rows.length, reminded, paused };
};

/** The day after a customer's first visit: one private 1–5 rating email. */
export const ratingEmails: Job = async (now) => {
  if (atlantaParts(now).hour < AUTOMATIONS.ratingEmailHour) return { skipped: 'before 10 AM' };
  const db = createServiceClient();
  const today = todayIso(now);
  const { data: done } = await db.from('visits')
    .select('id, date, completed_at, plan:plans!inner(service, customer_id, customer:customers(id, name, email))')
    .eq('status', 'done').gte('completed_at', new Date(now.getTime() - 4 * 86400_000).toISOString())
    .order('completed_at')
    .returns<{ id: string; date: string; completed_at: string; plan: { service: string; customer_id: string; customer: { id: string; name: string; email: string } } }[]>();
  let sent = 0;
  const seen = new Set<string>();
  for (const v of done ?? []) {
    const c = v.plan.customer;
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    // Only the customer's first visit ever, and only once its day has passed.
    if (todayIso(new Date(v.completed_at)) > addDays(today, -AUTOMATIONS.ratingEmailDaysAfterFirstVisit)) continue;
    const { count } = await db.from('visits').select('id, plans!inner(customer_id)', { count: 'exact', head: true })
      .eq('plans.customer_id', c.id).eq('status', 'done').lt('completed_at', v.completed_at);
    if (count) continue;
    const link = await manageLink(c.id);
    const r = await sendEmail({
      to: c.email, customerId: c.id, template: 'rating', dedupeKey: `rating:${c.id}`,
      content: EMAILS.rating({ firstName: c.name.trim().split(/\s+/)[0], isPet: v.plan.service === 'pet', links: [1, 2, 3, 4, 5].map((n) => `${link.url}?rate=${v.id}&score=${n}`) }),
    });
    if (r.sent) sent++;
  }
  return { sent };
};

/** Privacy and tidying: access codes after service ends, expired links and holds. */
export const cleanUp: Job = async (now) => {
  const db = createServiceClient();
  const { data: cleared, error } = await db.rpc('clear_ended_access');
  if (error) throw new Error(`clear_ended_access: ${error.message}`);
  const day = new Date(now.getTime() - 86400_000).toISOString();
  const { count: tokens } = await db.from('manage_tokens').delete({ count: 'exact' }).lt('expires_at', day);
  const { count: proLinks } = await db.from('pro_links').delete({ count: 'exact' }).lt('expires_at', day);
  const { count: holds } = await db.from('slot_holds').delete({ count: 'exact' }).lt('expires_at', new Date(now.getTime() - 3600_000).toISOString());
  return { accessCleared: Number(cleared ?? 0), tokensDeleted: (tokens ?? 0) + (proLinks ?? 0), holdsDeleted: holds ?? 0 };
};

/** 6 AM on the visit day: each cleaning pro gets their visit; each yard pro one text for the day's route. */
export const proDayOfTexts: Job = async (now) => {
  if (atlantaParts(now).hour < AUTOMATIONS.proDayOfReminderHour) return { skipped: 'before 6 AM' };
  const today = todayIso(now);
  const { data: visits } = await createServiceClient().from('visits')
    .select('id, window, pro:pros!inner(id, mobile), plan:plans!inner(service, address:addresses(street, city))')
    .eq('date', today).eq('status', 'confirmed').not('pro_id', 'is', null).order('window')
    .returns<{ id: string; window: ArrivalWindowId | null; pro: { id: string; mobile: string }; plan: { service: string; address: { street: string; city: string } } }[]>();
  const origin = publicOrigin();
  const routes = new Map<string, { mobile: string; cities: string[] }>();
  let sent = 0;
  for (const v of visits ?? []) {
    if (v.plan.service === 'pet') {
      const r = routes.get(v.pro.id) ?? { mobile: v.pro.mobile, cities: [] };
      r.cities.push(v.plan.address.city);
      routes.set(v.pro.id, r);
      continue;
    }
    const link = displayUrl(`${origin}/job/${await createProLink('visit', v.pro.id, { visitId: v.id })}`);
    const r = await sendText({
      to: v.pro.mobile, proId: v.pro.id, audience: 'pro', template: 'proDayOf', dedupeKey: `dayof:${v.id}`,
      body: TEXTS.proDayOf({ service: cleanServiceText(v.plan.service), window: windowShort(v.window), street: v.plan.address.street, city: v.plan.address.city, link }),
    });
    if (r.sent) sent++;
  }
  for (const [proId, r] of routes) {
    const link = displayUrl(`${origin}/job/${await createProLink('route', proId, { date: today })}`);
    const res = await sendText({
      to: r.mobile, proId, audience: 'pro', template: 'proDayOfRoute', dedupeKey: `route:${proId}:${today}`,
      body: TEXTS.proDayOfRoute({ count: r.cities.length, first: `in ${r.cities[0]}`, link }),
    });
    if (res.sent) sent++;
  }
  return { visits: visits?.length ?? 0, sent };
};

const DOC_NAME: Record<string, string> = { insurance: 'insurance certificate', bond: 'bond certificate', background_check: 'background check' };

/** 30 days before a pro's insurance or bond expires: tell the pro and the owner (once). */
export const docExpiryWarnings: Job = async (now) => {
  const db = createServiceClient();
  const today = todayIso(now);
  const { data: docs } = await db.from('pro_documents')
    .select('id, pro_id, kind, expires_on, pro:pros!inner(id, name, mobile, active)')
    .not('verified_at', 'is', null).gte('expires_on', today).lte('expires_on', addDays(today, AUTOMATIONS.proDocExpiryWarningDays))
    .returns<{ id: string; pro_id: string; kind: string; expires_on: string; pro: { id: string; name: string; mobile: string; active: boolean } }[]>();
  let sent = 0;
  for (const d of docs ?? []) {
    if (!d.pro.active) continue;
    // Skip it if a newer verified document of the same kind already runs longer.
    const { count } = await db.from('pro_documents').select('id', { count: 'exact', head: true })
      .eq('pro_id', d.pro_id).eq('kind', d.kind).not('verified_at', 'is', null).gt('expires_on', d.expires_on);
    if (count) continue;
    const link = displayUrl(`${publicOrigin()}/job/${await createProLink('docs', d.pro_id)}`);
    const body = TEXTS.docExpiring({ pro: shortName(d.pro.name), doc: DOC_NAME[d.kind], date: monthDay(d.expires_on), link });
    const a = await sendText({ to: d.pro.mobile, proId: d.pro_id, audience: 'pro', template: 'docExpiring', dedupeKey: `docexp:${d.id}`, body });
    const b = await sendText({ to: ownerMobile(), audience: 'owner', template: 'docExpiring', dedupeKey: `docexp:${d.id}:owner`, body });
    sent += Number(a.sent) + Number(b.sent);
  }
  return { expiring: docs?.length ?? 0, sent };
};

export const JOBS: Record<string, Job> = {
  extendSchedules, releaseStaleBookings, chargeRecurringCleans, proDayOfTexts, eveningReminders, unassignedReminders, followUpDeclines, ratingEmails, docExpiryWarnings, cleanUp,
};

/** Run every job (or the named ones). One job failing doesn't stop the rest. */
export async function runJobs(now = new Date(), only?: string[]): Promise<{ ok: boolean; results: Record<string, JobResult | { error: string }> }> {
  const results: Record<string, JobResult | { error: string }> = {};
  let ok = true;
  for (const [name, job] of Object.entries(JOBS)) {
    if (only?.length && !only.includes(name)) continue;
    try {
      results[name] = await job(now);
    } catch (err) {
      ok = false;
      results[name] = { error: (err as Error).message };
      console.error(`job ${name} failed`, (err as Error).message);
    }
  }
  return { ok, results };
}

/** After a customer saves a new card: retry their declined visit charges right away. */
export async function retryDeclinedCharges(customerId: string, now = new Date()): Promise<{ retried: number; charged: number }> {
  const since = new Date(now.getTime() - AUTOMATIONS.failedChargeFollowUpDays * 86400_000).toISOString();
  const { data } = await createServiceClient().rpc('open_failed_charges', { p_since: since });
  const mine = ((data ?? []) as { visit_id: string; customer_id: string; kind: 'visit' | 'late_fee' | 'cleanup_upgrade'; amount_cents: number }[]).filter((f) => f.customer_id === customerId);
  let charged = 0;
  for (const f of mine) {
    const r = await chargeVisit(f.visit_id, f.kind, f.kind === 'cleanup_upgrade' ? f.amount_cents : 0);
    if (r.ok) charged++;
  }
  return { retried: mine.length, charged };
}

