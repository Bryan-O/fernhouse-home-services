import 'server-only';
import Stripe from 'stripe';

// Stripe keys come from .env.local / Vercel env only. Use test keys (sk_test_…)
// until the owner switches to live mode.

export function stripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

let client: Stripe | null = null;

export function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('Stripe is not configured: set STRIPE_SECRET_KEY in .env.local');
  if (!client) {
    // STRIPE_API_BASE points the client at stripe-mock for local tests only.
    const base = process.env.STRIPE_API_BASE ? new URL(process.env.STRIPE_API_BASE) : null;
    client = new Stripe(key, {
      maxNetworkRetries: 2,
      appInfo: { name: 'Fernhouse' },
      ...(base ? { host: base.hostname, port: Number(base.port), protocol: base.protocol.replace(':', '') as 'http' | 'https' } : {}),
    });
  }
  return client;
}

/** Card brand and last four digits from an expanded payment method. */
export function cardDetails(pm: string | Stripe.PaymentMethod | null | undefined) {
  if (!pm || typeof pm === 'string') return { payment_method_id: typeof pm === 'string' ? pm : '', card_brand: '', card_last4: '' };
  return { payment_method_id: pm.id, card_brand: pm.card?.brand ?? '', card_last4: pm.card?.last4 ?? '' };
}
