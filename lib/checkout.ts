import 'server-only';
import { headers } from 'next/headers';
import type Stripe from 'stripe';
import { createServiceClient } from './supabase/admin';
import { cardDetails, stripe } from './stripe';
import { ARRIVAL_WINDOWS, BRAND, CLEAN_SERVICE_LABEL, OFFER, PET_FREQ_LABEL, ROUTE_DAYS, SITE_URL, dogsText } from './config';
import { fmtShort } from './booking';

// Stripe Checkout lets a session expire no sooner than 30 minutes after it's created.
const CHECKOUT_MINUTES = 31;

const FREQ_NAME: Record<string, string> = { one_time: 'One-time', weekly: 'Weekly', biweekly: 'Biweekly', twice_weekly: 'Twice weekly' };
const PET_FREQ: Record<string, keyof typeof PET_FREQ_LABEL> = { weekly: 'weekly', twice_weekly: 'twice', biweekly: 'biweekly', one_time: 'once' };

/** Where Stripe sends the visitor back: the site's own domain in production, this host in development. */
export async function siteOrigin(): Promise<string> {
  if (process.env.SITE_ORIGIN) return process.env.SITE_ORIGIN.replace(/\/$/, '');
  if (process.env.NODE_ENV === 'production' && !process.env.STRIPE_API_BASE) return SITE_URL;
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  return `${h.get('x-forwarded-proto') ?? 'http'}://${host}`;
}

interface PlanRow {
  id: string;
  ref: string;
  status: string;
  service: string;
  frequency: string;
  beds: number | null;
  baths: number | null;
  dogs: number | null;
  route_day: string | null;
  window: string | null;
  stripe_checkout_session_id: string | null;
  customer: { id: string; name: string; email: string; mobile: string; stripe_customer_id: string | null };
  visits: { id: string; date: string; price_cents: number; discount_cents: number }[];
}

/** The Stripe customer for one of our customers, created once (idempotent). */
export async function ensureStripeCustomer(c: PlanRow['customer']): Promise<string> {
  if (c.stripe_customer_id) return c.stripe_customer_id;
  const created = await stripe().customers.create(
    { name: c.name, email: c.email, phone: c.mobile, metadata: { customer_id: c.id } },
    { idempotencyKey: `customer-${c.id}` },
  );
  await createServiceClient().from('customers').update({ stripe_customer_id: created.id }).eq('id', c.id).is('stripe_customer_id', null);
  return created.id;
}

export type CheckoutResult = { ok: true; url: string } | { ok: false; reason: 'not_pending' | 'error' };

/**
 * Stripe Checkout for a pending booking.
 * Cleaning: charge the first visit now and save the card for later visits.
 * Pet waste: save the card only — nothing is charged at booking.
 */
export async function createCheckout(ref: string): Promise<CheckoutResult> {
  const db = createServiceClient();
  const { data, error } = await db
    .from('plans')
    .select('id, ref, status, service, frequency, beds, baths, dogs, route_day, window, stripe_checkout_session_id, customer:customers(id, name, email, mobile, stripe_customer_id), visits(id, date, price_cents, discount_cents)')
    .eq('ref', ref)
    .single<PlanRow>();
  if (error || !data) return { ok: false, reason: 'error' };
  if (data.status !== 'pending') return { ok: false, reason: 'not_pending' };

  // Same booking again (double-tap, back button): reuse the open session.
  if (data.stripe_checkout_session_id) {
    const existing = await stripe().checkout.sessions.retrieve(data.stripe_checkout_session_id);
    if (existing.status === 'open' && existing.url) return { ok: true, url: existing.url };
  }

  const visit = [...data.visits].sort((a, b) => a.date.localeCompare(b.date))[0];
  const origin = await siteOrigin();
  const customer = await ensureStripeCustomer(data.customer);
  const metadata = { kind: 'booking', plan_id: data.id, visit_id: visit.id, ref: data.ref };
  const common = {
    customer,
    client_reference_id: data.id,
    metadata,
    expires_at: Math.floor(Date.now() / 1000) + CHECKOUT_MINUTES * 60,
    success_url: `${origin}/book/confirmed?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/book?checkout=cancelled`,
  } satisfies Partial<Stripe.Checkout.SessionCreateParams>;

  let params: Stripe.Checkout.SessionCreateParams;
  if (data.service === 'pet') {
    const route = ROUTE_DAYS.find((r) => r.id.toLowerCase() === data.route_day)?.full ?? '';
    params = {
      ...common,
      mode: 'setup',
      currency: 'usd',
      setup_intent_data: { metadata, description: `${BRAND.name} ${data.ref} — pet waste removal, ${PET_FREQ_LABEL[PET_FREQ[data.frequency]].toLowerCase()} on ${route}s, ${dogsText(data.dogs ?? 1)}` },
      custom_text: { submit: { message: 'Nothing is charged today. Your card is charged after each visit.' } },
    };
  } else {
    const window = ARRIVAL_WINDOWS.find((w) => w.id === data.window);
    const name = `${CLEAN_SERVICE_LABEL[data.service as keyof typeof CLEAN_SERVICE_LABEL]} clean · ${data.beds} bd / ${data.baths} ba`;
    const when = `${fmtShort(visit.date)}, arrival ${window?.time ?? ''}`;
    params = {
      ...common,
      mode: 'payment',
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: visit.price_cents - visit.discount_cents,
          product_data: {
            name,
            description: `${FREQ_NAME[data.frequency]} · ${when}${visit.discount_cents > 0 ? ` · first clean ${OFFER.firstCleanPct}% off` : ''}`,
          },
        },
      }],
      payment_intent_data: {
        setup_future_usage: 'off_session', // later visits are charged to this card
        metadata: { ...metadata, charge: 'visit' },
        description: `${BRAND.name} ${data.ref} — ${name}, ${when}`,
      },
    };
  }

  const session = await stripe().checkout.sessions.create(params, { idempotencyKey: `checkout-${data.id}-${data.stripe_checkout_session_id ?? 'first'}` });
  await db.from('plans').update({ stripe_checkout_session_id: session.id }).eq('id', data.id);
  if (!session.url) return { ok: false, reason: 'error' };
  return { ok: true, url: session.url };
}

export type ConfirmResult =
  | { ok: true; ref: string; already: boolean }
  | { ok: false; reason: 'not_paid' | 'not_found' | 'slot_taken' | 'ended' | 'error'; ref?: string };

/**
 * Turn a completed Checkout session into a live booking. Called by the webhook and by the
 * confirmation page (whichever comes first); safe to run twice.
 * If the visitor paid after their hold ran out and the slot was taken, the payment is refunded.
 */
export async function confirmCheckout(sessionId: string): Promise<ConfirmResult> {
  const session = await stripe().checkout.sessions.retrieve(sessionId, {
    expand: ['payment_intent.payment_method', 'setup_intent.payment_method'],
  });
  return confirmSession(session);
}

/**
 * `session` is the source of truth for what happened (paid, amount, customer, metadata) — the signed
 * webhook event, or a fresh retrieve. `expanded` only supplies the saved card's details.
 */
export async function confirmSession(session: Stripe.Checkout.Session, expanded: Stripe.Checkout.Session = session): Promise<ConfirmResult> {
  const planId = session.metadata?.plan_id;
  if (session.metadata?.kind !== 'booking' || !planId) return { ok: false, reason: 'not_found' };
  const paid = session.mode === 'setup' ? session.status === 'complete' : session.payment_status === 'paid';
  if (!paid) return { ok: false, reason: 'not_paid' };

  const pi = expanded.payment_intent && typeof expanded.payment_intent === 'object' ? expanded.payment_intent : null;
  const si = expanded.setup_intent && typeof expanded.setup_intent === 'object' ? expanded.setup_intent : null;
  const piId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? '';
  const card = cardDetails(pi?.payment_method ?? si?.payment_method);
  const stripeCustomer = typeof session.customer === 'string' ? session.customer : session.customer?.id ?? '';

  const { data, error } = await createServiceClient().rpc('confirm_booking', {
    p_plan_id: planId,
    p: { payment_intent: piId, amount_cents: session.amount_total ?? 0, stripe_customer_id: stripeCustomer, ...card },
  });
  if (error) {
    console.error('confirm_booking failed', { planId, message: error.message });
    return { ok: false, reason: 'error' };
  }
  const r = data as { ok: boolean; reason?: string; ref: string; already?: boolean };

  if (!r.ok && (r.reason === 'slot_taken' || r.reason === 'ended') && piId) {
    // Paid too late for a slot someone else booked, or for an attempt the visitor replaced:
    // give the money back in full.
    await stripe().refunds.create({ payment_intent: piId, reason: 'requested_by_customer', metadata: { plan_id: planId, why: r.reason } }, { idempotencyKey: `refund-${r.reason}-${planId}` });
    return { ok: false, reason: r.reason, ref: r.ref };
  }
  if (!r.ok) return { ok: false, reason: (r.reason as 'ended') ?? 'error', ref: r.ref };

  // Make the saved card the default for later off-session charges.
  if (stripeCustomer && card.payment_method_id) {
    await stripe().customers.update(stripeCustomer, { invoice_settings: { default_payment_method: card.payment_method_id } });
  }
  return { ok: true, ref: r.ref, already: !!r.already };
}

export interface ConfirmationView {
  ref: string;
  isPet: boolean;
  service: 'standard' | 'deep' | 'move' | 'pet';
  frequency: 'one_time' | 'weekly' | 'biweekly' | 'twice_weekly';
  phone: string;
  email: string;
  beds: number | null;
  baths: number | null;
  dogs: number | null;
  petFreq: keyof typeof PET_FREQ_LABEL;
  cond: 'kept' | 'weeks' | 'month';
  routeDay: string | null;
  date: string;
  window: string | null;
  address: string;
  pricePerVisitCents: number;
  firstVisitCents: number;
  discountCents: number;
}

/** What the confirmation page shows for a booking (by its reference). */
export async function loadConfirmation(ref: string): Promise<ConfirmationView | null> {
  const { data: p } = await createServiceClient()
    .from('plans')
    .select('ref, service, frequency, beds, baths, dogs, yard_condition, route_day, window, price_per_visit_cents, customer:customers(mobile, email), address:addresses(street, unit, city, zip), visits(date, occurrence_date, price_cents, discount_cents)')
    .eq('ref', ref)
    .single<{
      ref: string; service: ConfirmationView['service']; frequency: ConfirmationView['frequency']; beds: number | null; baths: number | null;
      dogs: number | null; yard_condition: ConfirmationView['cond'] | null; route_day: string | null; window: string | null; price_per_visit_cents: number;
      customer: { mobile: string; email: string }; address: { street: string; unit: string | null; city: string; zip: string };
      visits: { date: string; occurrence_date: string; price_cents: number; discount_cents: number }[];
    }>();
  if (!p) return null;
  const first = [...p.visits].sort((a, b) => a.occurrence_date.localeCompare(b.occurrence_date))[0];
  return {
    ref: p.ref,
    isPet: p.service === 'pet',
    service: p.service,
    frequency: p.frequency,
    phone: p.customer.mobile,
    email: p.customer.email,
    beds: p.beds,
    baths: p.baths,
    dogs: p.dogs,
    petFreq: PET_FREQ[p.frequency],
    cond: p.yard_condition ?? 'kept',
    routeDay: p.route_day,
    date: first.date,
    window: p.window,
    address: `${p.address.street}${p.address.unit ? `, ${p.address.unit}` : ''}, ${p.address.city}, GA ${p.address.zip}`,
    pricePerVisitCents: p.price_per_visit_cents,
    firstVisitCents: first.price_cents,
    discountCents: first.discount_cents,
  };
}
