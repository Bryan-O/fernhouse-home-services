'use server';

import { createServiceClient } from '@/lib/supabase/admin';
import { stripe, stripeConfigured } from '@/lib/stripe';
import { lookupHome, standardFor } from '@/lib/config';

/**
 * Confirmation-page upsell: turn a paid one-time Standard clean into a biweekly plan at the
 * biweekly price. Only the visitor holding the Checkout session (from Stripe's return link) can.
 */
export async function makeRecurring(sessionId: string): Promise<{ ok: true; priceCents: number } | { ok: false }> {
  if (!stripeConfigured() || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return { ok: false };
  const session = await stripe().checkout.sessions.retrieve(sessionId).catch(() => null);
  const planId = session?.metadata?.plan_id;
  if (!planId || session?.metadata?.kind !== 'booking') return { ok: false };
  const db = createServiceClient();
  const { data: plan } = await db.from('plans').select('id, service, frequency, beds, baths').eq('id', planId).single();
  if (!plan || plan.service !== 'standard' || plan.frequency !== 'one_time') return { ok: false };
  const row = lookupHome(plan.beds, plan.baths);
  if (!row) return { ok: false };
  const priceCents = standardFor(row, 'biweekly') * 100;
  const { data } = await db.rpc('make_plan_recurring', { p_plan_id: plan.id, p_price_cents: priceCents });
  return data ? { ok: true, priceCents } : { ok: false };
}
