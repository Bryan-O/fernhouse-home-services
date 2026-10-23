import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { stripe, stripeConfigured, cardDetails } from '@/lib/stripe';
import { confirmSession } from '@/lib/checkout';
import { createServiceClient } from '@/lib/supabase/admin';
import { inBackground, notifyPaymentFailed } from '@/lib/notify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Stripe → Fernhouse. Every event is signature-checked, handled idempotently and
// recorded in stripe_events so a retried delivery does nothing twice.
// Returning a non-2xx makes Stripe retry, so only do that when a retry could help.
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeConfigured() || !secret) return NextResponse.json({ error: 'not configured' }, { status: 503 });

  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(body, request.headers.get('stripe-signature') ?? '', secret);
  } catch {
    return NextResponse.json({ error: 'bad signature' }, { status: 400 });
  }

  const db = createServiceClient();
  const { data: seen } = await db.from('stripe_events').select('id').eq('id', event.id).maybeSingle();
  if (seen) return NextResponse.json({ received: true, duplicate: true });

  try {
    await handle(event);
  } catch (err) {
    console.error('stripe webhook failed', { id: event.id, type: event.type, message: (err as Error).message });
    return NextResponse.json({ error: 'handler failed' }, { status: 500 });
  }

  await db.from('stripe_events').upsert({ id: event.id, type: event.type }, { onConflict: 'id', ignoreDuplicates: true });
  return NextResponse.json({ received: true });
}

async function handle(event: Stripe.Event) {
  const db = createServiceClient();
  switch (event.type) {
    case 'checkout.session.completed': {
      const s = event.data.object;
      if (s.metadata?.kind === 'booking') {
        const full = await stripe().checkout.sessions.retrieve(s.id, { expand: ['payment_intent.payment_method', 'setup_intent.payment_method'] });
        const r = await confirmSession(s, full);
        if (!r.ok && r.reason === 'error') throw new Error('confirm failed');
      } else if (s.metadata?.kind === 'card_update' && s.metadata.customer_id) {
        const full = await stripe().checkout.sessions.retrieve(s.id, { expand: ['setup_intent.payment_method'] });
        const si = typeof full.setup_intent === 'object' ? full.setup_intent : null;
        const card = cardDetails(si?.payment_method);
        if (!card.payment_method_id) throw new Error('no payment method on setup intent');
        await db.from('customers').update({
          stripe_payment_method_id: card.payment_method_id,
          card_brand: card.card_brand || null,
          card_last4: card.card_last4 || null,
        }).eq('id', s.metadata.customer_id);
        const stripeCustomer = typeof full.customer === 'string' ? full.customer : full.customer?.id;
        if (stripeCustomer) await stripe().customers.update(stripeCustomer, { invoice_settings: { default_payment_method: card.payment_method_id } });
        // TODO (build step 8): retry the customer's failed visit charges with the new card.
      }
      return;
    }
    case 'checkout.session.expired': {
      const s = event.data.object;
      if (s.metadata?.kind === 'booking' && s.metadata.plan_id) {
        const { error } = await db.rpc('abandon_booking', { p_plan_id: s.metadata.plan_id });
        if (error) throw new Error(error.message);
      }
      return;
    }
    case 'payment_intent.succeeded':
    case 'payment_intent.payment_failed': {
      // Off-session charges: settle the payment row created when the charge was made.
      const pi = event.data.object;
      const failed = event.type === 'payment_intent.payment_failed';
      const { data: changed } = await db.from('payments')
        .update({
          status: failed ? 'failed' : 'succeeded',
          failure_reason: failed ? pi.last_payment_error?.decline_code ?? pi.last_payment_error?.code ?? 'payment_failed' : null,
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_payment_intent', pi.id)
        .not('status', 'in', failed ? '(refunded,failed)' : '(refunded)')
        .select('id');
      // A charge that failed after it was made (not at the time): tell the customer and the owner.
      if (failed) for (const p of changed ?? []) inBackground('payment failed messages', () => notifyPaymentFailed(p.id));
      return;
    }
    case 'charge.succeeded': {
      // Keep the Stripe receipt link for the manage page.
      const ch = event.data.object;
      const piId = typeof ch.payment_intent === 'string' ? ch.payment_intent : ch.payment_intent?.id;
      if (piId && ch.receipt_url) await db.from('payments').update({ receipt_url: ch.receipt_url }).eq('stripe_payment_intent', piId);
      return;
    }
    case 'charge.refunded': {
      const ch = event.data.object;
      const piId = typeof ch.payment_intent === 'string' ? ch.payment_intent : ch.payment_intent?.id;
      if (piId) {
        await db.from('payments').update({
          refunded_cents: ch.amount_refunded,
          ...(ch.refunded ? { status: 'refunded' } : {}),
          updated_at: new Date().toISOString(),
        }).eq('stripe_payment_intent', piId);
      }
      return;
    }
    default:
      return;
  }
}
