// Integration test for the scheduled jobs against the local Supabase stack, run at chosen
// Atlanta times. Stripe is a stub; texts and emails are only logged (no Twilio/Resend keys),
// so the `messages` table shows exactly what each job would send.
// Run: npm run test:int (needs `npx supabase start`).
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import Stripe from 'stripe';
import { randomUUID } from 'node:crypto';

const RUN = !!process.env.SUPABASE_INT;
const OWNER = '+14045550198';

const create = vi.fn();
const retrieve = vi.fn();
vi.mock('./stripe', () => ({
  stripe: () => ({ paymentIntents: { create }, checkout: { sessions: { retrieve, expire: vi.fn(async () => ({})) } } }),
  stripeConfigured: () => true,
  cardDetails: () => ({ payment_method_id: '', card_brand: '', card_last4: '' }),
}));
vi.mock('./checkout', () => ({ ensureStripeCustomer: async () => 'cus_test', siteOrigin: async () => 'http://localhost', confirmCheckout: vi.fn(async () => ({ ok: false })) }));

type Db = ReturnType<typeof import('./supabase/admin').createServiceClient>;
let db: Db;
let jobs: typeof import('./jobs');
let at: (iso: string, hour: number, minute?: number) => Date;
let todayIso: (d?: Date) => string;
let addDays: (iso: string, n: number) => string;

const mobile = () => `+1404555${String(Math.floor(Math.random() * 9000) + 1000)}`;
const cardError = () => new Stripe.errors.StripeCardError({ type: 'card_error', code: 'card_declined', decline_code: 'insufficient_funds', message: 'Declined', payment_intent: { id: `pi_f_${randomUUID().slice(0, 8)}` } } as never);

/** A confirmed weekly clean with a saved card and texting consent; returns its plan and visits. */
async function weeklyClean(name = 'Avery Stone') {
  const phone = mobile();
  let plan: string | null = null;
  for (let day = 2; day <= 60 && !plan; day++) {
    for (const window of ['morning', 'midday', 'afternoon']) {
      const { data } = await db.rpc('start_booking', {
        p: {
          idempotency_key: randomUUID(), service: 'standard', frequency: 'weekly', beds: 2, baths: 1, date: addDays(todayIso(), day), window,
          price_per_visit_cents: 11500, first_visit_cents: 11500, discount_cents: 0,
          customer: { name, mobile: phone, email: `${phone.slice(-4)}@example.com` },
          address: { street: `${phone} Job St`, city: 'Atlanta', zip: '30303' },
          consents: [{ kind: 'booking', version: 'test', text: 'test' }],
        },
      });
      if ((data as { ok: boolean }).ok) { plan = (data as { plan_id: string }).plan_id; break; }
    }
  }
  if (!plan) throw new Error('no open slot');
  await db.rpc('confirm_booking', { p_plan_id: plan, p: { payment_intent: `pi_first_${plan.slice(0, 8)}`, amount_cents: 11500, stripe_customer_id: `cus_${plan.slice(0, 8)}`, payment_method_id: 'pm_test', card_brand: 'visa', card_last4: '4242' } });
  const { data: visits } = await db.from('visits').select('id, date').eq('plan_id', plan).order('date');
  const { data: p } = await db.from('plans').select('customer_id').eq('id', plan).single();
  return { plan, phone, customerId: p!.customer_id as string, visits: visits as { id: string; date: string }[] };
}

const messages = async (where: Record<string, string>) => {
  let q = db.from('messages').select('template, body, subject, to_address, dedupe_key, error');
  for (const [k, v] of Object.entries(where)) q = q.eq(k, v);
  return (await q).data ?? [];
};

describe.skipIf(!RUN)('scheduled jobs', () => {
  beforeAll(async () => {
    process.env.OWNER_ALERT_MOBILE = OWNER;
    db = (await import('./supabase/admin')).createServiceClient();
    jobs = await import('./jobs');
    at = (await import('./policy')).atlantaTime;
    ({ todayIso, addDays } = await import('./booking'));
  });
  beforeEach(() => { create.mockReset(); retrieve.mockReset(); });

  it('charges a recurring clean on the morning of the visit, once, and not before 7 AM', async () => {
    const c = await weeklyClean();
    const today = todayIso();
    await db.from('visits').update({ date: today }).eq('id', c.visits[1].id); // the second visit is today
    create.mockImplementation(async (params: { metadata: { visit_id: string } }) => ({ id: `pi_${params.metadata.visit_id.slice(0, 12)}_${randomUUID().slice(0, 4)}`, status: 'succeeded' }));

    expect(await jobs.chargeRecurringCleans(at(today, 6, 30))).toEqual({ skipped: 'before charge hour' });
    await jobs.chargeRecurringCleans(at(today, 7, 5));
    const mine = create.mock.calls.filter((call) => call[0].metadata.visit_id === c.visits[1].id);
    expect(mine).toHaveLength(1);
    expect(mine[0][0]).toMatchObject({ amount: 11500, off_session: true });
    expect(create.mock.calls.some((call) => call[0].metadata.visit_id === c.visits[0].id)).toBe(false); // prepaid at booking

    await jobs.chargeRecurringCleans(at(today, 8, 5)); // the next hour: nothing new for this visit
    expect(create.mock.calls.filter((call) => call[0].metadata.visit_id === c.visits[1].id)).toHaveLength(1);
  });

  it('a declined morning charge texts the customer, then reminds after 24 hours and pauses after 48', async () => {
    const c = await weeklyClean('Taylor Morgan');
    const today = todayIso();
    await db.from('visits').update({ date: today }).eq('id', c.visits[1].id);
    create.mockImplementation(async (params: { metadata: { visit_id: string } }) => {
      if (params.metadata.visit_id === c.visits[1].id) throw cardError();
      return { id: `pi_${randomUUID()}`, status: 'succeeded' };
    });
    const t0 = at(today, 7, 5);
    await jobs.chargeRecurringCleans(t0);
    await vi.waitFor(async () => expect((await messages({ to_address: c.phone, template: 'paymentFailed' })).length).toBe(1));
    const { data: pay } = await db.from('payments').select('id, created_at').eq('visit_id', c.visits[1].id).eq('status', 'failed').single();

    // 25 hours later: one reminder, with the deadline 48 hours after the decline.
    const t25 = new Date(new Date(pay!.created_at).getTime() + 25 * 3600_000);
    await jobs.followUpDeclines(t25);
    await jobs.followUpDeclines(new Date(t25.getTime() + 3600_000));
    const reminders = await messages({ to_address: c.phone, template: 'paymentFailedReminder' });
    expect(reminders).toHaveLength(1);
    expect(reminders[0].body).toMatch(/^Fernhouse: Reminder — we still couldn’t charge Visa 4242 for your \w{3} \d+ visit\. Please update your card by \d+(:\d\d)? (AM|PM) (today|tomorrow) to keep your plan: /);
    expect((await db.from('plans').select('status').eq('id', c.plan).single()).data!.status).toBe('active');

    // 49 hours: the plan pauses once; the customer and owner are told.
    const t49 = new Date(new Date(pay!.created_at).getTime() + 49 * 3600_000);
    expect(await jobs.followUpDeclines(t49)).toMatchObject({ paused: expect.any(Number) });
    expect((await db.from('plans').select('status').eq('id', c.plan).single()).data!.status).toBe('paused');
    expect(await messages({ customer_id: c.customerId, template: 'planPausedPayment' })).toHaveLength(1);
    const owner = (await messages({ to_address: OWNER, template: 'ownerPlanPaused' })).filter((m) => m.body.includes('Taylor M.'));
    expect(owner[0].body).toMatch(/^Plan paused: Taylor M\. hasn’t updated their card in 48 hours \(\$115 for the \w{3} \d+ clean\)\./);

    // Resumed without a new card: not paused again by the same decline.
    await db.rpc('set_plan_paused', { p_plan_id: c.plan, p_paused: false, p_keep_days: 1 });
    await jobs.followUpDeclines(new Date(t49.getTime() + 3600_000));
    expect((await db.from('plans').select('status').eq('id', c.plan).single()).data!.status).toBe('active');

    // A new card: the declined visit is charged again right away.
    create.mockReset();
    create.mockResolvedValue({ id: `pi_retry_${randomUUID()}`, status: 'succeeded' });
    expect(await jobs.retryDeclinedCharges(c.customerId)).toEqual({ retried: 1, charged: 1 });
    expect((await db.from('payments').select('status').eq('visit_id', c.visits[1].id).eq('status', 'succeeded')).data).toHaveLength(1);
  });

  it('sends the evening-before reminder from 6 PM, once per visit', async () => {
    const c = await weeklyClean();
    const today = todayIso();
    await db.from('visits').update({ date: addDays(today, 1), window: 'midday' }).eq('id', c.visits[1].id);
    expect(await jobs.eveningReminders(at(today, 17, 50))).toEqual({ skipped: 'before 6 PM' });
    await jobs.eveningReminders(at(today, 18, 5));
    await jobs.eveningReminders(at(today, 19, 5));
    const sent = await messages({ to_address: c.phone, template: 'eveningBefore' });
    expect(sent).toHaveLength(1);
    expect(sent[0].body).toBe('Fernhouse: Reminder — your clean is tomorrow, 11 AM–2 PM. Please secure pets and have access ready. Questions? Just reply.');
  });

  it('reminds the owner about bookings without a pro: 12 hours after booking, then each morning at 8', async () => {
    const c = await weeklyClean();
    const today = todayIso();
    const t3 = at(today, 3);
    await db.from('plans').update({ created_at: new Date(t3.getTime() - 11 * 3600_000).toISOString() }).eq('id', c.plan);
    await jobs.unassignedReminders(t3); // booked 11 hours ago: not yet
    expect((await db.from('plans').select('unassigned_reminded_at').eq('id', c.plan).single()).data!.unassigned_reminded_at).toBeNull();
    await db.from('plans').update({ created_at: new Date(t3.getTime() - 13 * 3600_000).toISOString() }).eq('id', c.plan);
    await jobs.unassignedReminders(t3); // 13 hours: the 12-hour reminder (3 AM, so not the daily one)
    expect((await db.from('plans').select('unassigned_reminded_at').eq('id', c.plan).single()).data!.unassigned_reminded_at).not.toBeNull();
    const first = await messages({ to_address: OWNER, template: 'ownerUnassigned' });
    expect(first.some((m) => m.dedupe_key?.includes(c.plan))).toBe(true);
    expect(first.find((m) => m.dedupe_key?.includes(c.plan))!.body).toMatch(/^Reminder: \d+ bookings? still needs? a pro\. The next is \w{3} \w{3} \d+ .+ in \w+/);

    await jobs.unassignedReminders(at(today, 8, 5));
    await jobs.unassignedReminders(at(today, 9, 5));
    expect((await messages({ to_address: OWNER, dedupe_key: `unassigned-daily:${today}` }))).toHaveLength(1);
  });

  it('emails a private rating the day after a customer’s first visit, from 10 AM, once', async () => {
    const c = await weeklyClean('Jamie Rivera');
    const today = todayIso();
    const { data: pro } = await db.from('pros').insert({ name: 'Rating Pro', mobile: mobile(), service_types: ['cleaning'] }).select('id').single();
    const owner = (await db.from('admin_users').select('user_id').limit(1).maybeSingle()).data?.user_id;
    if (!owner) {
      const { data: u } = await db.auth.admin.createUser({ email: `o${randomUUID().slice(0, 6)}@example.com`, password: `Aa1${randomUUID()}` });
      await db.from('admin_users').insert({ user_id: u.user!.id });
    }
    const verifier = (await db.from('admin_users').select('user_id').limit(1).single()).data!.user_id;
    await db.from('pro_documents').insert(['insurance', 'bond', 'background_check'].map((kind) => ({
      pro_id: pro!.id, kind, file_url: 'x', expires_on: kind === 'background_check' ? null : addDays(today, 365), verified_by: verifier, verified_at: new Date().toISOString(),
    })));
    const yesterday = at(addDays(today, -1), 12);
    const { error } = await db.from('visits').update({ pro_id: pro!.id, assigned_at: yesterday.toISOString(), status: 'done', completed_at: yesterday.toISOString() }).eq('id', c.visits[0].id);
    expect(error).toBeNull();

    expect(await jobs.ratingEmails(at(today, 9))).toEqual({ skipped: 'before 10 AM' });
    await jobs.ratingEmails(at(today, 10, 5));
    await jobs.ratingEmails(at(today, 11, 5));
    const sent = await messages({ customer_id: c.customerId, template: 'rating' });
    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toBe('How did your first clean go?');
    expect(sent[0].body).toMatch(new RegExp(`5: http\\S+/b/[A-Za-z0-9_-]{32}\\?rate=${c.visits[0].id}&score=5`));
  });

  it('releases a booking whose checkout never finished, and cleans up', async () => {
    const phone = mobile();
    let plan: string | null = null;
    for (let day = 2; day <= 60 && !plan; day++) {
      const { data } = await db.rpc('start_booking', {
        p: {
          idempotency_key: randomUUID(), service: 'standard', frequency: 'one_time', beds: 2, baths: 1, date: addDays(todayIso(), day), window: 'afternoon',
          price_per_visit_cents: 15000, first_visit_cents: 15000, discount_cents: 0,
          customer: { name: 'Stale', mobile: phone, email: 's@example.com' }, address: { street: `${phone} Stale St`, city: 'Atlanta', zip: '30303' },
        },
      });
      if ((data as { ok: boolean }).ok) plan = (data as { plan_id: string }).plan_id;
    }
    await db.from('plans').update({ created_at: new Date(Date.now() - 3 * 3600_000).toISOString(), stripe_checkout_session_id: `cs_test_${plan!.slice(0, 8)}` }).eq('id', plan!);
    retrieve.mockResolvedValue({ id: `cs_test_${plan!.slice(0, 8)}`, status: 'expired' });
    await jobs.releaseStaleBookings(new Date());
    expect((await db.from('plans').select('status').eq('id', plan!).single()).data!.status).toBe('ended');

    const r = await jobs.cleanUp(new Date());
    expect(r).toMatchObject({ accessCleared: expect.any(Number), tokensDeleted: expect.any(Number), holdsDeleted: expect.any(Number) });
  });

  it('one failing job doesn’t stop the others', async () => {
    const r = await jobs.runJobs(at(todayIso(), 2), ['extendSchedules', 'cleanUp']);
    expect(r.ok).toBe(true);
    expect(Object.keys(r.results)).toEqual(['extendSchedules', 'cleanUp']);
  });
});
