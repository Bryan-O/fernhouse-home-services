import 'server-only';
import { createHash } from 'node:crypto';
import { createServiceClient } from './supabase/admin';
import { SITE_URL, TRACKING } from './config';

// Meta Conversions API: tells Meta about a booking or quote from our server, so ad results
// count even when the Pixel is blocked or (on the confirmation page) not loaded. The event_id
// matches the browser event, so Meta counts each once. Only a hashed email is sent — never a
// phone number (the Privacy Policy promises mobile numbers aren't shared for marketing).
// Skipped when the visitor's browser sent Global Privacy Control.

const GRAPH_VERSION = 'v21.0';

export function capiConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_META_PIXEL_ID && process.env.META_CAPI_TOKEN);
}

const sha = (s: string) => createHash('sha256').update(s.trim().toLowerCase()).digest('hex');

export interface CapiEvent {
  name: 'Purchase' | 'Lead';
  id: string;
  time: Date;
  url: string;
  value?: number;
  email?: string | null;
  externalId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  fbc?: string | null;
  fbp?: string | null;
}

/** The body Meta expects (exported for tests). */
export function capiPayload(e: CapiEvent) {
  return {
    data: [{
      event_name: e.name,
      event_time: Math.floor(e.time.getTime() / 1000),
      event_id: e.id,
      action_source: 'website',
      event_source_url: e.url,
      user_data: {
        ...(e.email ? { em: [sha(e.email)] } : {}),
        ...(e.externalId ? { external_id: [sha(e.externalId)] } : {}),
        ...(e.ip ? { client_ip_address: e.ip } : {}),
        ...(e.userAgent ? { client_user_agent: e.userAgent } : {}),
        ...(e.fbc ? { fbc: e.fbc } : {}),
        ...(e.fbp ? { fbp: e.fbp } : {}),
      },
      ...(e.value !== undefined ? { custom_data: { currency: TRACKING.currency, value: e.value } } : {}),
    }],
    ...(process.env.META_CAPI_TEST_CODE ? { test_event_code: process.env.META_CAPI_TEST_CODE } : {}),
  };
}

export async function sendCapi(e: CapiEvent): Promise<boolean> {
  if (!capiConfigured()) return false;
  const base = (process.env.META_GRAPH_BASE ?? 'https://graph.facebook.com').replace(/\/$/, '');
  const res = await fetch(`${base}/${GRAPH_VERSION}/${process.env.NEXT_PUBLIC_META_PIXEL_ID}/events?access_token=${encodeURIComponent(process.env.META_CAPI_TOKEN!)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(capiPayload(e)),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!res?.ok) console.error('meta capi failed', { event: e.name, status: res?.status });
  return !!res?.ok;
}

/** Meta's click id cookie value, rebuilt from the fbclid saved with the booking. */
export const fbcFrom = (fbclid: string | null, at: string) => (fbclid ? `fb.1.${new Date(at).getTime()}.${fbclid}` : null);

/** A confirmed booking. event_id is the booking reference (the confirmation page uses it too). */
export async function capiPurchase(planId: string): Promise<boolean> {
  if (!capiConfigured()) return false;
  const db = createServiceClient();
  const { data: p } = await db.from('plans')
    .select('id, ref, service, ads_ok, fbclid, fbp, created_at, customer_id, customer:customers(email), visits(price_cents, discount_cents, occurrence_date)')
    .eq('id', planId).single<{ id: string; ref: string; service: string; ads_ok: boolean; fbclid: string | null; fbp: string | null; created_at: string; customer_id: string;
      customer: { email: string }; visits: { price_cents: number; discount_cents: number; occurrence_date: string }[] }>();
  if (!p || !p.ads_ok) return false;
  const first = [...p.visits].sort((a, b) => a.occurrence_date.localeCompare(b.occurrence_date))[0];
  const { data: c } = await db.from('sms_consent').select('ip, user_agent').eq('customer_id', p.customer_id).eq('form', 'booking').order('given_at', { ascending: false }).limit(1).maybeSingle();
  return sendCapi({
    name: 'Purchase', id: p.ref, time: new Date(), url: `${SITE_URL}/book`,
    value: first ? (first.price_cents - first.discount_cents) / 100 : 0,
    email: p.customer.email, externalId: p.customer_id, ip: c?.ip ?? null, userAgent: c?.user_agent ?? null,
    fbc: fbcFrom(p.fbclid, p.created_at), fbp: p.fbp,
  });
}

/** A quote request. event_id matches the browser's Lead event. */
export async function capiLead(quoteId: string, ip: string | null, userAgent: string | null): Promise<boolean> {
  if (!capiConfigured()) return false;
  const { data: q } = await createServiceClient().from('quote_requests').select('id, ads_ok, fbclid, fbp, created_at').eq('id', quoteId).single();
  if (!q || !q.ads_ok) return false;
  return sendCapi({ name: 'Lead', id: `quote-${q.id}`, time: new Date(q.created_at), url: SITE_URL, ip, userAgent, fbc: fbcFrom(q.fbclid, q.created_at), fbp: q.fbp });
}
