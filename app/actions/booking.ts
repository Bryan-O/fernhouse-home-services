'use server';

import { headers } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/admin';
import { supabaseConfigured } from '@/lib/supabase/env';
import { encryptField } from '@/lib/crypto';
import { CONSENT } from '@/lib/messages';
import { stripe, stripeConfigured } from '@/lib/stripe';
import { createCheckout } from '@/lib/checkout';
import {
  ARRIVAL_WINDOWS,
  BOOKING,
  CAPACITY_DEFAULTS,
  cityForZip,
  PET_WASTE_PRICING,
  ROUTE_DAYS,
  type ArrivalWindowId,
  type RouteDayId,
} from '@/lib/config';
import {
  addDays,
  firstRouteDate,
  quoteClean,
  quotePet,
  step2Errors,
  step3Errors,
  toE164,
  todayIso,
  weekday,
  type Availability,
  type BookingDraft,
} from '@/lib/booking';

const FREQUENCY = { oneTime: 'one_time', weekly: 'weekly', biweekly: 'biweekly' } as const;
const PET_FREQUENCY = { weekly: 'weekly', twice: 'twice_weekly', biweekly: 'biweekly', once: 'one_time' } as const;

const emptyWindows = (): Record<ArrivalWindowId, number> => ({ morning: 0, midday: 0, afternoon: 0 });

/** Open slots for the next 60 days (cleaning) and per route day (yards). */
export async function getAvailability(): Promise<Availability> {
  const today = todayIso();
  const to = addDays(today, BOOKING.windowDays);
  const clean: Availability['clean'] = {};
  const slots: Record<string, number> = {};
  const yard = {} as Record<RouteDayId, number>;

  if (!supabaseConfigured()) {
    // Not connected yet: show the starting capacity from lib/config.ts.
    for (let i = BOOKING.firstBookableOffsetDays; i <= BOOKING.windowDays; i++) {
      const d = addDays(today, i);
      const caps = CAPACITY_DEFAULTS.cleaningPerWindow[weekday(d)];
      clean[d] = { morning: caps[0], midday: caps[1], afternoon: caps[2] };
      slots[d] = caps[0] + caps[1] + caps[2];
    }
    for (const r of ROUTE_DAYS) yard[r.id] = CAPACITY_DEFAULTS.yardsPerRouteDay[r.id];
    return { today, clean, closed: closedDates(slots), yard };
  }

  const db = createServiceClient();
  const [c, y] = await Promise.all([
    db.rpc('clean_availability', { p_from: addDays(today, BOOKING.firstBookableOffsetDays), p_to: to }),
    db.rpc('yard_availability'),
  ]);
  if (c.error) throw new Error(`clean_availability failed: ${c.error.message}`);
  if (y.error) throw new Error(`yard_availability failed: ${y.error.message}`);
  for (const row of c.data as { date: string; window: ArrivalWindowId; slots: number; taken: number }[]) {
    (clean[row.date] ??= emptyWindows())[row.window] = Math.max(0, row.slots - row.taken);
    slots[row.date] = (slots[row.date] ?? 0) + row.slots;
  }
  for (const row of y.data as { route_day: string; slots: number; taken: number }[]) {
    const id = (row.route_day.charAt(0).toUpperCase() + row.route_day.slice(1)) as RouteDayId;
    yard[id] = Math.max(0, row.slots - row.taken);
  }
  return { today, clean, closed: closedDates(slots), yard };
}

const closedDates = (slots: Record<string, number>) => Object.keys(slots).filter((d) => slots[d] === 0);

export type StartBookingResult =
  | { ok: true; ref: string; holdExpiresAt: string; firstVisitCents: number; discountCents: number; replayed: boolean; checkoutUrl: string | null }
  | { ok: false; reason: 'invalid' | 'full' | 'offer_used' | 'date_out_of_range' | 'not_connected' | 'error' };

export interface StartBookingInput {
  draft: BookingDraft;
  idempotencyKey: string;
  acceptFullPrice?: boolean;
  utm?: Partial<Record<'utm_source' | 'utm_medium' | 'utm_campaign' | 'utm_content' | 'utm_term' | 'fbclid' | 'gclid', string>>;
}

async function requestMeta() {
  const h = await headers();
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || h.get('x-real-ip') || '';
  return { ip: /^[0-9a-f.:]+$/i.test(ip) ? ip : '', userAgent: (h.get('user-agent') ?? '').slice(0, 400) };
}

const clip = (s: string, n: number) => String(s ?? '').trim().slice(0, n);

/**
 * Create a pending booking and hold its slot for 15 minutes. Prices are recomputed
 * here from lib/config.ts; nothing the browser sends about money is trusted.
 * Payment (Stripe) is connected in build step 5.
 */
export async function startBooking(input: StartBookingInput): Promise<StartBookingResult> {
  const d = input.draft;
  if (!/^[0-9a-f-]{36}$/i.test(input.idempotencyKey)) return { ok: false, reason: 'invalid' };
  if (Object.keys(step2Errors(d, null)).length || Object.keys(step3Errors(d)).length) return { ok: false, reason: 'invalid' };
  if (!supabaseConfigured()) return { ok: false, reason: 'not_connected' };

  const city = cityForZip(d.zip)!;
  const mobile = toE164(d.phone)!;
  const today = todayIso();
  const meta = await requestMeta();
  const consents: { kind: string; version: string; text: string }[] = [{ kind: 'booking', version: CONSENT.booking.version, text: CONSENT.booking.text }];
  if (d.smsPromo) consents.push({ kind: 'marketing', version: CONSENT.marketing.version, text: CONSENT.marketing.text });

  let service: Record<string, unknown>;
  if (d.svc === 'pet') {
    const q = quotePet(d.pet);
    if (!q || !d.routeDay) return { ok: false, reason: 'invalid' };
    service = {
      service: 'pet',
      frequency: PET_FREQUENCY[d.pet.petFreq],
      dogs: Math.min(d.pet.dogs, PET_WASTE_PRICING.maxDogs),
      yard_condition: d.pet.cond,
      route_day: d.routeDay.toLowerCase(),
      date: firstRouteDate(d.routeDay, today),
      price_per_visit_cents: q.visit * 100,
      first_visit_cents: q.firstTotal * 100,
      discount_cents: 0,
      dog_names: clip(d.dogNames, 200),
      dogs_friendly: d.dogsFriendly,
      requests: clip(d.requests, 1000),
      gate_code: encryptField(clip(d.gate, 500)),
    };
  } else {
    const q = quoteClean(d.clean);
    if (!q || !d.date || !d.window || !ARRIVAL_WINDOWS.some((w) => w.id === d.window)) return { ok: false, reason: 'invalid' };
    service = {
      service: d.clean.service,
      frequency: d.clean.service === 'standard' ? FREQUENCY[d.clean.freq] : 'one_time',
      beds: d.clean.beds,
      baths: d.clean.baths,
      window: d.window,
      date: d.date,
      price_per_visit_cents: q.base * 100,
      first_visit_cents: q.base * 100,
      discount_cents: q.discount * 100,
      pets_note: d.pets ? clip(d.petNote, 500) || 'Yes' : '',
      requests: clip(d.requests, 1000),
      access_notes: encryptField(clip(d.access, 1000)),
    };
  }

  const { gate_code, access_notes, ...plan } = service;
  const payload = {
    ...plan,
    idempotency_key: input.idempotencyKey,
    accept_full_price: !!input.acceptFullPrice,
    hold_minutes: BOOKING.holdMinutes,
    customer: { name: clip(d.name, 120), mobile, email: clip(d.email, 254).toLowerCase() },
    address: { street: clip(d.address, 200), unit: clip(d.unit, 40), city, zip: d.zip, access_notes: access_notes ?? null, gate_code: gate_code ?? null },
    consents,
    utm: input.utm ?? {},
    ip: meta.ip,
    user_agent: meta.userAgent,
  };

  const { data, error } = await createServiceClient().rpc('start_booking', { p: payload });
  if (error) {
    console.error('start_booking failed', { code: error.code, message: error.message });
    return { ok: false, reason: 'error' };
  }
  const r = data as { ok: boolean; reason?: string; ref?: string; hold_expires_at?: string; first_visit_cents?: number; discount_cents?: number; replayed?: boolean };
  if (!r.ok) return { ok: false, reason: (r.reason as 'full' | 'offer_used' | 'date_out_of_range') ?? 'error' };

  // Hand over to Stripe Checkout. Without Stripe keys (local preview) the booking just stays pending.
  let checkoutUrl: string | null = null;
  if (stripeConfigured()) {
    const c = await createCheckout(r.ref!).catch((err) => {
      console.error('createCheckout failed', { ref: r.ref, message: (err as Error).message });
      return { ok: false as const, reason: 'error' as const };
    });
    if (!c.ok) return { ok: false, reason: 'error' };
    checkoutUrl = c.url;
  }
  return {
    checkoutUrl,
    ok: true,
    ref: r.ref!,
    holdExpiresAt: r.hold_expires_at!,
    firstVisitCents: r.first_visit_cents!,
    discountCents: r.discount_cents!,
    replayed: !!r.replayed,
  };
}

/**
 * The visitor changed their booking after starting checkout: drop that pending attempt so its
 * hold doesn't block a slot and its Stripe session can't be paid. Knowing the attempt's key
 * proves it's theirs; paid bookings are never touched.
 */
export async function releaseAttempt(idempotencyKey: string): Promise<void> {
  if (!/^[0-9a-f-]{36}$/i.test(idempotencyKey) || !supabaseConfigured()) return;
  const db = createServiceClient();
  const { data: plan } = await db.from('plans').select('id, stripe_checkout_session_id')
    .eq('idempotency_key', idempotencyKey).eq('status', 'pending').maybeSingle();
  if (!plan) return;
  if (plan.stripe_checkout_session_id && stripeConfigured()) {
    await stripe().checkout.sessions.expire(plan.stripe_checkout_session_id).catch(() => {
      // Already expired or completed — confirmCheckout refunds a payment on an ended booking.
    });
  }
  await db.rpc('abandon_booking', { p_plan_id: plan.id });
}

export type LeadResult = { ok: true } | { ok: false; reason: 'invalid' | 'not_connected' | 'error' };

/** "Join the waitlist" when a ZIP is outside the area. */
export async function joinWaitlist(phone: string, zip: string): Promise<LeadResult> {
  const mobile = toE164(phone);
  if (!mobile || !/^\d{5}$/.test(zip)) return { ok: false, reason: 'invalid' };
  if (!supabaseConfigured()) return { ok: false, reason: 'not_connected' };
  const db = createServiceClient();
  const meta = await requestMeta();
  const w = await db.from('waitlist').upsert({ phone: mobile, zip }, { onConflict: 'phone,zip', ignoreDuplicates: true });
  const c = await db.from('sms_consent').insert({
    phone: mobile, kind: 'booking', form: 'waitlist', consent_text_version: CONSENT.waitlist.version,
    consent_text: CONSENT.waitlist.text, ip: meta.ip || null, user_agent: meta.userAgent || null,
  });
  if (w.error || c.error) {
    console.error('waitlist insert failed', w.error?.message ?? c.error?.message);
    return { ok: false, reason: 'error' };
  }
  return { ok: true };
}

/** "Text me a quote" for 5+ dogs or a yard over ½ acre. The price is texted by a person. */
export async function requestQuote(input: { phone: string; dogs: number; overHalfAcre: boolean; utm?: StartBookingInput['utm'] }): Promise<LeadResult> {
  const mobile = toE164(input.phone);
  const dogs = Math.trunc(Number(input.dogs));
  if (!mobile || !(dogs >= 1 && dogs <= 50)) return { ok: false, reason: 'invalid' };
  if (!supabaseConfigured()) return { ok: false, reason: 'not_connected' };
  const db = createServiceClient();
  const meta = await requestMeta();
  const u = input.utm ?? {};
  const q = await db.from('quote_requests').insert({
    phone: mobile, service: 'pet', dogs, over_half_acre: !!input.overHalfAcre,
    utm_source: u.utm_source, utm_medium: u.utm_medium, utm_campaign: u.utm_campaign,
    utm_content: u.utm_content, utm_term: u.utm_term, fbclid: u.fbclid, gclid: u.gclid,
  });
  const c = await db.from('sms_consent').insert({
    phone: mobile, kind: 'booking', form: 'quote', consent_text_version: CONSENT.quote.version,
    consent_text: CONSENT.quote.text, ip: meta.ip || null, user_agent: meta.userAgent || null,
  });
  if (q.error || c.error) {
    console.error('quote insert failed', q.error?.message ?? c.error?.message);
    return { ok: false, reason: 'error' };
  }
  return { ok: true };
}
