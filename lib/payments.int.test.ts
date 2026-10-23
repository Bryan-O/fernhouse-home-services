// Integration test for off-session charges against the local Supabase stack.
// Stripe's client is replaced by a stub that succeeds or throws Stripe's own card errors.
// Run: npm run test:int (needs `npx supabase start`).
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import Stripe from 'stripe';
import { randomUUID } from 'node:crypto';

const RUN = !!process.env.SUPABASE_INT;

const create = vi.fn();
vi.mock('./stripe', () => ({
  stripe: () => ({ paymentIntents: { create } }),
  stripeConfigured: () => true,
  cardDetails: () => ({ payment_method_id: '', card_brand: '', card_last4: '' }),
}));
vi.mock('./checkout', () => ({ ensureStripeCustomer: async () => 'cus_test', siteOrigin: async () => 'http://localhost' }));

type Db = ReturnType<typeof import('./supabase/admin').createServiceClient>;
let db: Db;
let chargeVisit: typeof import('./payments').chargeVisit;

async function bookedVisit(withCard: boolean): Promise<string> {
  const mobile = `+1404555${String(Math.floor(Math.random() * 9000) + 1000)}`;
  // Find any open slot, so the test can rerun without a database reset.
  type Booked = { ok: boolean; plan_id: string; reason?: string };
  let booked = null as Booked | null;
  for (let day = 2; day <= 60 && !booked?.ok; day++) {
    for (const window of ['morning', 'midday', 'afternoon']) {
      const { data } = await db.rpc('start_booking', {
        p: {
          idempotency_key: randomUUID(), service: 'standard', frequency: 'weekly', beds: 2, baths: 1,
          date: new Date(Date.now() + day * 86400000).toISOString().slice(0, 10), window,
          price_per_visit_cents: 11500, first_visit_cents: 11500, discount_cents: 0,
          customer: { name: 'Charge Test', mobile, email: 'c@example.com' },
          address: { street: `${mobile} Charge St`, city: 'Atlanta', zip: '30303' },
        },
      });
      booked = data as Booked;
      if (booked?.ok) break;
    }
  }
  if (!booked?.ok) throw new Error(`test booking failed: ${booked?.reason}`);
  const planId = booked.plan_id;
  const confirmed = await db.rpc('confirm_booking', {
    p_plan_id: planId,
    p: withCard ? { stripe_customer_id: `cus_${planId.slice(0, 8)}`, payment_method_id: 'pm_test', card_brand: 'visa', card_last4: '4242' } : {},
  });
  if (confirmed.error || !(confirmed.data as { ok: boolean }).ok) throw new Error(`test confirm failed: ${confirmed.error?.message}`);
  // Confirming a recurring plan also creates its later visits; charges here use the first.
  const { data: v } = await db.from('visits').select('id').eq('plan_id', planId).order('date').limit(1).single();
  return v!.id;
}

const cardError = (code: string, decline?: string) =>
  new Stripe.errors.StripeCardError({ type: 'card_error', code, decline_code: decline, message: `Card error: ${code}`, payment_intent: { id: `pi_fail_${randomUUID().slice(0, 8)}` } } as never);

describe.skipIf(!RUN)('chargeVisit (off-session)', () => {
  beforeAll(async () => {
    db = (await import('./supabase/admin')).createServiceClient();
    chargeVisit = (await import('./payments')).chargeVisit;
  });
  beforeEach(() => create.mockReset());

  it('charges the visit price once, then reports the earlier charge', async () => {
    const visitId = await bookedVisit(true);
    create.mockResolvedValueOnce({ id: `pi_ok_${visitId.slice(0, 8)}`, status: 'succeeded' });
    const first = await chargeVisit(visitId, 'visit');
    expect(first).toMatchObject({ ok: true, amountCents: 11500, already: false });
    expect(create.mock.calls[0][0]).toMatchObject({ amount: 11500, off_session: true, confirm: true, payment_method: 'pm_test' });
    expect(create.mock.calls[0][0].customer).toMatch(/^cus_/);
    const again = await chargeVisit(visitId, 'visit');
    expect(again).toMatchObject({ ok: true, already: true });
    expect(create).toHaveBeenCalledTimes(1);
    const { data } = await db.from('payments').select('status, amount_cents').eq('visit_id', visitId);
    expect(data).toEqual([{ status: 'succeeded', amount_cents: 11500 }]);
  });

  it('records a decline, and a retry uses a fresh idempotency key', async () => {
    const visitId = await bookedVisit(true);
    create.mockRejectedValueOnce(cardError('card_declined', 'insufficient_funds'));
    expect(await chargeVisit(visitId, 'visit')).toMatchObject({ ok: false, reason: 'declined' });
    const { data } = await db.from('payments').select('status, failure_reason').eq('visit_id', visitId);
    expect(data).toEqual([{ status: 'failed', failure_reason: 'insufficient_funds' }]);

    create.mockResolvedValueOnce({ id: `pi_retry_${visitId.slice(0, 8)}`, status: 'succeeded' });
    expect(await chargeVisit(visitId, 'visit')).toMatchObject({ ok: true });
    expect(create.mock.calls[0][1].idempotencyKey).not.toBe(create.mock.calls[1][1].idempotencyKey);
  });

  it('reports when the bank asks for authentication', async () => {
    const visitId = await bookedVisit(true);
    create.mockRejectedValueOnce(cardError('authentication_required'));
    expect(await chargeVisit(visitId, 'visit')).toMatchObject({ ok: false, reason: 'authentication_required' });
  });

  it('never charges without a saved card', async () => {
    const visitId = await bookedVisit(false);
    expect(await chargeVisit(visitId, 'visit')).toMatchObject({ ok: false, reason: 'no_card' });
    expect(create).not.toHaveBeenCalled();
  });

  it('charges a late fee only when one is set', async () => {
    const visitId = await bookedVisit(true);
    expect(await chargeVisit(visitId, 'late_fee')).toMatchObject({ ok: false, reason: 'nothing_to_charge' });
    await db.from('visits').update({ fee_cents: 5000 }).eq('id', visitId);
    create.mockResolvedValueOnce({ id: `pi_fee_${visitId.slice(0, 8)}`, status: 'succeeded' });
    expect(await chargeVisit(visitId, 'late_fee')).toMatchObject({ ok: true, amountCents: 5000 });
  });
});
