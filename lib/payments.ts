import 'server-only';
import Stripe from 'stripe';
import { createServiceClient } from './supabase/admin';
import { stripe } from './stripe';
import { ensureStripeCustomer, siteOrigin } from './checkout';
import { BRAND } from './config';
import { fmtShort } from './booking';

export type ChargeKind = 'visit' | 'late_fee' | 'cleanup_upgrade';

export type ChargeResult =
  | { ok: true; paymentIntent: string; amountCents: number; already: boolean }
  | { ok: false; reason: 'no_card' | 'declined' | 'authentication_required' | 'nothing_to_charge' | 'not_found' | 'error'; message?: string };

interface VisitRow {
  id: string;
  date: string;
  price_cents: number;
  discount_cents: number;
  fee_cents: number;
  plan: { ref: string; customer: { id: string; stripe_customer_id: string | null; stripe_payment_method_id: string | null } };
}

const LABEL: Record<ChargeKind, string> = { visit: 'visit', late_fee: 'late-cancellation fee', cleanup_upgrade: 'yard cleanup upgrade' };

/**
 * Charge a visit to the customer's saved card without them present (off-session):
 * recurring cleans on the morning of the visit, yard visits when marked done,
 * late fees and cleanup upgrades. One live charge per visit and kind — retrying
 * after a success returns the earlier charge instead of charging twice.
 */
export async function chargeVisit(visitId: string, kind: ChargeKind, upgradeCents = 0): Promise<ChargeResult> {
  const db = createServiceClient();
  const { data: v } = await db
    .from('visits')
    .select('id, date, price_cents, discount_cents, fee_cents, plan:plans(ref, customer:customers(id, stripe_customer_id, stripe_payment_method_id))')
    .eq('id', visitId)
    .single<VisitRow>();
  if (!v) return { ok: false, reason: 'not_found' };

  const amount = kind === 'visit' ? v.price_cents - v.discount_cents : kind === 'late_fee' ? v.fee_cents : upgradeCents;
  if (amount <= 0) return { ok: false, reason: 'nothing_to_charge' };

  const { data: done } = await db.from('payments').select('stripe_payment_intent, amount_cents')
    .eq('visit_id', visitId).eq('kind', kind).eq('status', 'succeeded').maybeSingle();
  if (done) return { ok: true, paymentIntent: done.stripe_payment_intent, amountCents: done.amount_cents, already: true };

  const c = v.plan.customer;
  if (!c.stripe_customer_id || !c.stripe_payment_method_id) return { ok: false, reason: 'no_card' };

  // A new key per attempt after a failure (e.g. card updated); the same key for a plain retry.
  const { count: failures } = await db.from('payments').select('id', { count: 'exact', head: true })
    .eq('visit_id', visitId).eq('kind', kind).eq('status', 'failed');
  const idempotencyKey = `charge-${kind}-${visitId}-${failures ?? 0}`;

  try {
    const pi = await stripe().paymentIntents.create(
      {
        amount,
        currency: 'usd',
        customer: c.stripe_customer_id,
        payment_method: c.stripe_payment_method_id,
        off_session: true,
        confirm: true,
        description: `${BRAND.name} ${v.plan.ref} — ${LABEL[kind]}, ${fmtShort(v.date)}`,
        metadata: { visit_id: visitId, ref: v.plan.ref, charge: kind },
      },
      { idempotencyKey },
    );
    await db.from('payments').upsert(
      { visit_id: visitId, stripe_payment_intent: pi.id, amount_cents: amount, kind, status: pi.status === 'succeeded' ? 'succeeded' : 'pending' },
      { onConflict: 'stripe_payment_intent' },
    );
    return { ok: true, paymentIntent: pi.id, amountCents: amount, already: false };
  } catch (err) {
    if (err instanceof Stripe.errors.StripeCardError) {
      const piId = (err.raw as { payment_intent?: { id?: string } })?.payment_intent?.id ?? null;
      const auth = err.code === 'authentication_required';
      await db.from('payments').insert({
        visit_id: visitId, stripe_payment_intent: piId, amount_cents: amount, kind, status: 'failed',
        failure_reason: err.decline_code ?? err.code ?? 'card_error',
      });
      // TODO (build step 7): text the customer ("Payment failed") and alert the owner.
      return { ok: false, reason: auth ? 'authentication_required' : 'declined', message: err.message };
    }
    console.error('chargeVisit failed', { visitId, kind, message: (err as Error).message });
    return { ok: false, reason: 'error' };
  }
}

/** Stripe-hosted page where a customer saves a new card (after a decline, or from their manage link). */
export async function createCardUpdateSession(customerId: string, returnPath: string): Promise<string | null> {
  const db = createServiceClient();
  const { data: c } = await db.from('customers').select('id, name, email, mobile, stripe_customer_id').eq('id', customerId).single();
  if (!c) return null;
  const origin = await siteOrigin();
  const path = returnPath.startsWith('/') && !returnPath.startsWith('//') ? returnPath : '/';
  const session = await stripe().checkout.sessions.create({
    mode: 'setup',
    currency: 'usd',
    customer: await ensureStripeCustomer(c),
    metadata: { kind: 'card_update', customer_id: c.id },
    setup_intent_data: { metadata: { kind: 'card_update', customer_id: c.id } },
    success_url: `${origin}${path}${path.includes('?') ? '&' : '?'}card=updated`,
    cancel_url: `${origin}${path}`,
  });
  return session.url;
}
