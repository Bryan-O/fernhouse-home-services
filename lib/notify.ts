import 'server-only';
import { after } from 'next/server';
import { createServiceClient } from './supabase/admin';
import { createManageToken } from './manage';
import { twilioConfigured, twilioSend, TwilioError, TWILIO_OPTED_OUT } from './twilio';
import { resendConfigured, resendSend } from './resend';
import { renderEmail } from './email-html';
import { EMAILS, FIRST_CLEAN_ROW, PLAN_NAME, TEXTS, VISIT_WORD, type EmailContent } from './messages';
import { AUTOMATIONS, BRAND, SITE_URL, dogsText, type ArrivalWindowId } from './config';
import { fmtLong, formatPhone, todayIso } from './booking';
import {
  adminBookingPath, cardEmail, cardText, cleanServiceText, dayDate, displayUrl, firstName, freeUntil, money, monthDay,
  ownerWhen, petFreqLabel, routeFull, shortName, untilText, visitWhen, windowShort, yardPlanText,
} from './format';

// Every text and email goes through here: it's logged in `messages` first (so the same event
// never sends twice — `dedupeKey`), consent is checked for texts, then Twilio or Resend sends it.
// Without keys (local preview) messages are logged as not sent and printed in development.

export type Audience = 'customer' | 'marketing' | 'pro' | 'owner';
const CONSENT_KIND = { customer: 'booking', marketing: 'marketing', pro: 'pro_jobs' } as const;

export type SendResult = { sent: true; id: string } | { sent: false; reason: 'duplicate' | 'no_consent' | 'opted_out' | 'not_configured' | 'no_recipient' | 'failed' };

/** The site's public address for links in messages (never a request's host). */
export function publicOrigin(): string {
  if (process.env.SITE_ORIGIN) return process.env.SITE_ORIGIN.replace(/\/$/, '');
  return process.env.NODE_ENV === 'production' ? SITE_URL : 'http://localhost:3000';
}

const devLog = (what: string, to: string, body: string) => {
  if (process.env.NODE_ENV !== 'production') console.info(`[dev ${what} → ${to}]\n${body}\n`);
};

/** Log the message; null if this dedupe key was already used. */
async function logMessage(row: Record<string, unknown>): Promise<string | null> {
  const db = createServiceClient();
  if (row.dedupe_key) {
    const { data, error } = await db.from('messages').upsert(row, { onConflict: 'dedupe_key', ignoreDuplicates: true }).select('id');
    if (error) throw new Error(`message log failed: ${error.message}`);
    return data?.[0]?.id ?? null;
  }
  const { data, error } = await db.from('messages').insert(row).select('id').single();
  if (error) throw new Error(`message log failed: ${error.message}`);
  return data.id;
}

const settle = (id: string, patch: Record<string, unknown>) => createServiceClient().from('messages').update(patch).eq('id', id);

export async function sendText(m: {
  to: string | null | undefined; body: string; template: string; audience: Audience;
  dedupeKey?: string; customerId?: string | null; proId?: string | null; mediaPath?: string | null;
}): Promise<SendResult> {
  if (!m.to) return { sent: false, reason: 'no_recipient' };
  const id = await logMessage({
    customer_id: m.customerId ?? null, pro_id: m.proId ?? null, to_address: m.to, channel: 'sms', template: m.template,
    body: m.body, status: 'queued', dedupe_key: m.dedupeKey ?? null, media_path: m.mediaPath ?? null,
  });
  if (!id) return { sent: false, reason: 'duplicate' };

  const db = createServiceClient();
  if (m.audience !== 'owner') {
    const { data: ok } = await db.rpc('sms_allowed', { p_phone: m.to, p_kind: CONSENT_KIND[m.audience] });
    if (!ok) {
      await settle(id, { status: 'failed', error: 'no_consent' });
      return { sent: false, reason: 'no_consent' };
    }
  }
  if (!twilioConfigured()) {
    await settle(id, { status: 'failed', error: 'not_configured' });
    devLog('text', m.to, m.body);
    return { sent: false, reason: 'not_configured' };
  }

  let mediaUrl: string | undefined;
  if (m.mediaPath) {
    const s = await db.storage.from('gate-photos').createSignedUrl(m.mediaPath, 86400);
    mediaUrl = s.data?.signedUrl;
  }
  const origin = publicOrigin();
  try {
    const r = await twilioSend({
      to: m.to, body: m.body, mediaUrl,
      // Twilio can only call back a public https address.
      statusCallback: origin.startsWith('https://') ? `${origin}/api/twilio/status` : undefined,
    });
    await settle(id, { status: 'sent', provider_id: r.sid, sent_at: new Date().toISOString() });
    return { sent: true, id };
  } catch (err) {
    const optedOut = err instanceof TwilioError && err.code === TWILIO_OPTED_OUT;
    const code = err instanceof TwilioError ? `twilio_${err.code ?? err.status}` : 'network';
    await settle(id, { status: 'failed', error: optedOut ? 'opted_out' : `${code}: ${(err as Error).message}`.slice(0, 300) });
    if (!optedOut) console.error('text failed', { template: m.template, message: (err as Error).message });
    return { sent: false, reason: optedOut ? 'opted_out' : 'failed' };
  }
}

export async function sendEmail(m: {
  to: string | null | undefined; content: EmailContent; template: string;
  dedupeKey?: string; customerId?: string | null; proId?: string | null;
}): Promise<SendResult> {
  if (!m.to) return { sent: false, reason: 'no_recipient' };
  const { html, text } = renderEmail(m.content, publicOrigin());
  const id = await logMessage({
    customer_id: m.customerId ?? null, pro_id: m.proId ?? null, to_address: m.to, channel: 'email', template: m.template,
    subject: m.content.subject, body: text, status: 'queued', dedupe_key: m.dedupeKey ?? null,
  });
  if (!id) return { sent: false, reason: 'duplicate' };
  if (!resendConfigured()) {
    await settle(id, { status: 'failed', error: 'not_configured' });
    devLog(`email "${m.content.subject}"`, m.to, text);
    return { sent: false, reason: 'not_configured' };
  }
  try {
    const r = await resendSend({ to: m.to, subject: m.content.subject, html, text, idempotencyKey: m.dedupeKey ?? id });
    await settle(id, { status: 'sent', provider_id: r.id, sent_at: new Date().toISOString() });
    return { sent: true, id };
  } catch (err) {
    await settle(id, { status: 'failed', error: (err as Error).message.slice(0, 300) });
    console.error('email failed', { template: m.template, message: (err as Error).message });
    return { sent: false, reason: 'failed' };
  }
}

// The owner's own mobile and inbox for alerts (OWNER_ALERT_MOBILE is private, so it isn't in config).
const ownerMobile = () => process.env.OWNER_ALERT_MOBILE || null;
const ownerEmail = () => process.env.OWNER_ALERT_EMAIL || BRAND.email;

/** Run after the response is sent (pages and actions stay fast); immediately outside a request. */
export function inBackground(label: string, task: () => Promise<unknown>): void {
  const run = () => task().catch((err) => console.error(`${label} failed`, (err as Error).message));
  try {
    after(run);
  } catch {
    void run();
  }
}

/** A fresh 7-day manage link for a customer, as it reads in a text and as a full URL. */
export async function manageLink(customerId: string): Promise<{ url: string; text: string }> {
  const url = `${publicOrigin()}/b/${await createManageToken(customerId)}`;
  return { url, text: displayUrl(url) };
}

const adminLink = (path = '/admin') => displayUrl(`${publicOrigin()}${path}`);

// ───────── Loading what the messages need ─────────

interface PlanForMessage {
  id: string; ref: string; service: string; frequency: string; beds: number | null; baths: number | null; dogs: number | null;
  route_day: string | null; window: ArrivalWindowId | null; price_per_visit_cents: number; status: string;
  customer: { id: string; name: string; mobile: string; email: string; card_brand: string | null; card_last4: string | null };
  address: { street: string; unit: string | null; city: string; zip: string };
  visits: { id: string; date: string; window: ArrivalWindowId | null; status: string; price_cents: number; discount_cents: number; occurrence_date: string }[];
}

async function loadPlan(planId: string): Promise<PlanForMessage | null> {
  const { data } = await createServiceClient().from('plans')
    .select(`id, ref, service, frequency, beds, baths, dogs, route_day, window, price_per_visit_cents, status,
      customer:customers(id, name, mobile, email, card_brand, card_last4), address:addresses(street, unit, city, zip),
      visits(id, date, window, status, price_cents, discount_cents, occurrence_date)`)
    .eq('id', planId).single<PlanForMessage>();
  if (data) data.visits.sort((a, b) => a.date.localeCompare(b.date));
  return data;
}

const addressLine = (a: PlanForMessage['address']) => `${a.street}${a.unit ? `, ${a.unit}` : ''}, ${a.city}, GA ${a.zip}`;
const card = (p: PlanForMessage) => cardText(p.customer.card_brand, p.customer.card_last4);
const nextOpen = (p: PlanForMessage, after?: string) =>
  p.visits.find((v) => ['scheduled', 'confirmed'].includes(v.status) && v.date >= todayIso() && (!after || v.date > after)) ?? null;
const PLAN_FREQ: Record<string, string> = { weekly: 'Weekly', biweekly: 'Biweekly', one_time: 'One-time', twice_weekly: 'Twice weekly' };
const planName = (p: PlanForMessage) => PLAN_NAME(p.service === 'pet', p.service === 'pet' ? petFreqLabel(p.frequency) : PLAN_FREQ[p.frequency]);

async function visitPlan(visitId: string) {
  const { data } = await createServiceClient().from('visits').select('plan_id').eq('id', visitId).single();
  return data ? loadPlan(data.plan_id) : null;
}

// ───────── Booking made ─────────

/** Confirmation text + email to the customer, alert text + email to the owner. Safe to call twice. */
export async function notifyBookingConfirmed(planId: string): Promise<void> {
  const p = await loadPlan(planId);
  if (!p || p.status !== 'active') return;
  const first = p.visits[0];
  const c = p.customer;
  const link = await manageLink(c.id);
  const isPet = p.service === 'pet';
  const key = `booking:${p.id}`;
  const firstCents = first.price_cents - first.discount_cents;

  if (isPet) {
    const once = p.frequency === 'one_time';
    // One-time: "One-time cleanup, Tue, Oct 27"; recurring: "Weekly on Tuesdays, first visit Oct 27".
    const plan = once ? petFreqLabel(p.frequency) : yardPlanText(p.frequency, p.route_day);
    await sendText({
      to: c.mobile, customerId: c.id, audience: 'customer', template: 'yardBooked', dedupeKey: `${key}:sms`,
      body: TEXTS.yardBooked({ plan, first: once ? dayDate(first.date) : monthDay(first.date), once, link: link.text }),
    });
    await sendEmail({
      to: c.email, customerId: c.id, template: 'yardBooked', dedupeKey: `${key}:email`,
      content: EMAILS.yardBooked({
        firstName: firstName(c.name), subjectPlan: `${routeFull(p.route_day)}s`, firstShort: monthDay(first.date), plan,
        dogs: dogsText(p.dogs ?? 1), first: fmtLong(first.date), firstPrice: money(first.price_cents),
        perVisit: `${money(p.price_per_visit_cents)} per visit`, address: addressLine(p.address), once, link: link.url,
      }),
    });
  } else {
    const service = cleanServiceText(p.service);
    const when = visitWhen(first.date, p.window);
    await sendText({
      to: c.mobile, customerId: c.id, audience: 'customer', template: 'bookingConfirmed', dedupeKey: `${key}:sms`,
      body: TEXTS.bookingConfirmed({ service, when, street: p.address.street, link: link.text }),
    });
    await sendEmail({
      to: c.email, customerId: c.id, template: 'bookingConfirmed', dedupeKey: `${key}:email`,
      content: EMAILS.bookingConfirmed({
        firstName: firstName(c.name), when: `${dayDate(first.date)} · ${windowShort(p.window)} arrival`, whenShort: when,
        service: `${service} · ${p.beds} bed, ${p.baths} bath`, serviceShort: service, street: p.address.street,
        plan: `${PLAN_FREQ[p.frequency]} · ${money(p.price_per_visit_cents)} per visit`,
        firstLabel: first.discount_cents > 0 ? FIRST_CLEAN_ROW : p.frequency === 'one_time' ? undefined : 'First clean',
        first: money(firstCents), address: addressLine(p.address), link: link.url,
      }),
    });
  }

  // Owner alert
  const summary = isPet
    ? `Pet waste ${dogsText(p.dogs ?? 1)}, ${petFreqLabel(p.frequency).toLowerCase()} ${routeFull(p.route_day)}s`
    : `${cleanServiceText(p.service)} ${p.beds}bd/${p.baths}ba`;
  const price = isPet
    ? `${money(first.price_cents)} first visit${p.frequency === 'one_time' ? '' : `, then ${money(p.price_per_visit_cents)}`}`
    : `${money(firstCents)}${first.discount_cents > 0 ? ' (first clean)' : ''}`;
  const adminPath = adminBookingPath(p.ref);
  await sendText({
    to: ownerMobile(), audience: 'owner', template: 'ownerNewBooking', dedupeKey: `${key}:owner_sms`,
    body: TEXTS.ownerNewBooking({ ref: p.ref, summary, when: ownerWhen(first.date, p.window), area: `${p.address.city} ${p.address.zip}`, price, link: adminLink(adminPath) }),
  });
  await sendEmail({
    to: ownerEmail(), template: 'ownerNewBooking', dedupeKey: `${key}:owner_email`,
    content: EMAILS.ownerNewBooking({
      ref: p.ref, summary, whenShort: ownerWhen(first.date, p.window), link: `${publicOrigin()}${adminPath}`,
      rows: [
        { label: 'Customer', value: c.name },
        { label: 'Mobile', value: c.mobile },
        { label: 'Email', value: c.email },
        { label: 'Service', value: summary },
        { label: isPet ? 'First visit' : 'When', value: isPet ? fmtLong(first.date) : `${dayDate(first.date)} · ${windowShort(p.window)}` },
        { label: 'Price', value: price },
        { label: 'Address', value: addressLine(p.address) },
      ],
    }),
  });
}

// ───────── Find my booking ─────────

export async function notifyManageLink(customerId: string, mobile: string): Promise<SendResult> {
  const link = await manageLink(customerId);
  if (process.env.NODE_ENV !== 'production') console.info('[dev] manage link for', mobile, link.url);
  return sendText({ to: mobile, customerId, audience: 'customer', template: 'manageLink', body: TEXTS.manageLink(link.text) });
}

// ───────── Quote form ─────────

export async function notifyQuoteRequested(q: { id: string; phone: string; dogs: number; overHalfAcre: boolean }): Promise<void> {
  await sendText({ to: q.phone, audience: 'customer', template: 'quoteReceived', dedupeKey: `quote:${q.id}:sms`, body: TEXTS.quoteReceived() });
  await sendText({
    to: ownerMobile(), audience: 'owner', template: 'ownerQuote', dedupeKey: `quote:${q.id}:owner_sms`,
    body: TEXTS.ownerQuote({ dogs: q.dogs, overHalfAcre: q.overHalfAcre, phone: formatPhone(q.phone), link: adminLink() }),
  });
}

// ───────── Changes on the manage page ─────────

export async function notifyVisitMoved(visitId: string, from: { date: string; window: ArrivalWindowId | null }, feeCharged: number): Promise<void> {
  const p = await visitPlan(visitId);
  const v = p?.visits.find((x) => x.id === visitId);
  if (!p || !v) return;
  const c = p.customer;
  const link = await manageLink(c.id);
  const when = visitWhen(v.date, v.window);
  const fee = feeCharged > 0 ? { amount: money(feeCharged), card: card(p) } : undefined;
  const stamp = `${v.date}:${v.window}`;
  await sendText({
    to: c.mobile, customerId: c.id, audience: 'customer', template: 'visitMoved', dedupeKey: `moved:${v.id}:${stamp}:sms`,
    body: TEXTS.visitMoved({ when, fee, freeUntil: freeUntil(v.date, v.window), link: link.text }),
  });
  await sendEmail({
    to: c.email, customerId: c.id, template: 'visitMoved', dedupeKey: `moved:${v.id}:${stamp}:email`,
    content: EMAILS.visitMoved({
      when, was: visitWhen(from.date, from.window), fee: fee ? `${fee.amount} · ${cardEmail(c.card_brand, c.card_last4)}` : undefined,
      freeUntil: freeUntil(v.date, v.window), link: link.url,
    }),
  });
}

export async function notifyVisitSkipped(visitId: string, restored: boolean): Promise<void> {
  const p = await visitPlan(visitId);
  const v = p?.visits.find((x) => x.id === visitId);
  if (!p || !v) return;
  const c = p.customer;
  const link = await manageLink(c.id);
  const next = nextOpen(p, restored ? undefined : v.date);
  const isPet = p.service === 'pet';
  const what = isPet ? VISIT_WORD.pet : VISIT_WORD.clean;
  const base = { what, date: monthDay(v.date), when: visitWhen(v.date, v.window), link: link.url };
  await sendEmail({
    to: c.email, customerId: c.id, template: restored ? 'visitRestored' : 'visitSkipped',
    content: restored ? EMAILS.visitRestored(base) : EMAILS.visitSkipped({ ...base, isPet, next: next ? visitWhen(next.date, next.window) : undefined }),
  });
}

export async function notifyVisitCancelled(visitId: string, o: { feeCents: number; refundedCents: number }): Promise<void> {
  const p = await visitPlan(visitId);
  const v = p?.visits.find((x) => x.id === visitId);
  if (!p || !v) return;
  const c = p.customer;
  const next = nextOpen(p, v.date);
  const t = card(p);
  const fee = o.feeCents > 0 ? { amount: money(o.feeCents), card: t } : undefined;
  const refund = o.refundedCents > 0 ? { amount: money(o.refundedCents), card: t } : undefined;
  await sendText({
    to: c.mobile, customerId: c.id, audience: 'customer', template: 'cancelled', dedupeKey: `cancel:${v.id}:sms`,
    body: TEXTS.cancelled({ date: monthDay(v.date), fee, refund, next: next && p.frequency !== 'one_time' ? dayDate(next.date) : undefined }),
  });
  await sendEmail({
    to: c.email, customerId: c.id, template: 'cancelled', dedupeKey: `cancel:${v.id}:email`,
    content: EMAILS.cancelled({
      date: monthDay(v.date), fee: fee?.amount, card: cardEmail(c.card_brand, c.card_last4), refund: refund?.amount,
      next: next ? visitWhen(next.date, next.window) : undefined, rebook: `${publicOrigin()}${p.service === 'pet' ? '/pet-waste-removal' : '/book'}`,
    }),
  });
}

export async function notifyPlanPaused(planId: string, paused: boolean): Promise<void> {
  const p = await loadPlan(planId);
  if (!p) return;
  const c = p.customer;
  const link = await manageLink(c.id);
  const plan = planName(p);
  const next = nextOpen(p);
  await sendEmail({
    to: c.email, customerId: c.id, template: paused ? 'planPaused' : 'planResumed',
    content: paused ? EMAILS.planPaused({ plan, link: link.url }) : EMAILS.planResumed({ plan, next: next ? visitWhen(next.date, next.window) : undefined, link: link.url }),
  });
}

export async function notifyPlanEnded(planId: string): Promise<void> {
  const p = await loadPlan(planId);
  if (!p) return;
  const c = p.customer;
  const kept = nextOpen(p);
  const plan = planName(p);
  await sendEmail({
    to: c.email, customerId: c.id, template: 'planEnded', dedupeKey: `ended:${p.id}`,
    content: EMAILS.planEnded({ plan, kept: kept ? fmtLong(kept.date) : undefined, rebook: `${publicOrigin()}${p.service === 'pet' ? '/pet-waste-removal' : '/book'}` }),
  });
}

export async function notifyRouteDayChanged(planId: string): Promise<void> {
  const p = await loadPlan(planId);
  if (!p) return;
  const c = p.customer;
  const link = await manageLink(c.id);
  const next = nextOpen(p);
  await sendEmail({
    to: c.email, customerId: c.id, template: 'routeDayChanged',
    content: EMAILS.routeDayChanged({ day: routeFull(p.route_day), plan: yardPlanText(p.frequency, p.route_day), first: next ? fmtLong(next.date) : undefined, link: link.url }),
  });
}

// ───────── Charge declined ─────────

/** After an off-session charge fails: text + email the customer (visit charges), alert the owner. */
export async function notifyPaymentFailed(paymentId: string): Promise<void> {
  const db = createServiceClient();
  const { data: pay } = await db.from('payments').select('id, visit_id, kind, amount_cents, status').eq('id', paymentId).single();
  if (!pay || pay.status !== 'failed') return;
  const p = await visitPlan(pay.visit_id);
  const v = p?.visits.find((x) => x.id === pay.visit_id);
  if (!p || !v) return;
  const c = p.customer;
  const key = `payfail:${pay.id}`;
  let texted = false;
  if (pay.kind !== 'late_fee') {
    const link = await manageLink(c.id);
    const r = await sendText({
      to: c.mobile, customerId: c.id, audience: 'customer', template: 'paymentFailed', dedupeKey: `${key}:sms`,
      body: TEXTS.paymentFailed({ card: card(p), date: monthDay(v.date), link: link.text }),
    });
    texted = r.sent;
    const deadline = new Date(Date.now() + AUTOMATIONS.cardUpdateDeadlineHours * 3600_000);
    await sendEmail({
      to: c.email, customerId: c.id, template: 'cardDeclined', dedupeKey: `${key}:email`,
      content: EMAILS.cardDeclined({
        card: cardEmail(c.card_brand, c.card_last4), date: monthDay(v.date), amount: money(pay.amount_cents),
        deadline: untilText(deadline), link: link.url,
      }),
    });
  }
  const what = pay.kind === 'late_fee' ? `late fee on ${monthDay(v.date)}` : `${monthDay(v.date)} ${p.service === 'pet' ? VISIT_WORD.pet : 'clean'}`;
  await sendText({
    to: ownerMobile(), audience: 'owner', template: 'ownerCardDeclined', dedupeKey: `${key}:owner_sms`,
    body: TEXTS.ownerCardDeclined({ name: shortName(c.name), amount: money(pay.amount_cents), what, texted: pay.kind !== 'late_fee' && texted, link: adminLink() }),
  });
}

// ───────── Re-clean / re-scoop request ─────────

export async function notifyRedoRequested(visitId: string, note: string): Promise<void> {
  const p = await visitPlan(visitId);
  const v = p?.visits.find((x) => x.id === visitId);
  if (!p || !v) return;
  const pet = p.service === 'pet';
  await sendText({
    to: ownerMobile(), audience: 'owner', template: 'ownerRedo', dedupeKey: `redo:${v.id}:owner_sms`,
    body: TEXTS.ownerRedo({
      kind: pet ? 're-scoop' : 're-clean', name: shortName(p.customer.name), what: `${monthDay(v.date)} ${pet ? VISIT_WORD.pet : 'clean'}`,
      note: note.trim().slice(0, 120), link: adminLink(adminBookingPath(p.ref)),
    }),
  });
}

// ───────── Replies to our number ─────────

/** A customer's (non-keyword) reply: forward it to the owner's inbox. */
export async function notifyInbound(m: { id: string; from: string; body: string }): Promise<void> {
  const db = createServiceClient();
  const [{ data: cust }, { data: pro }] = await Promise.all([
    db.from('customers').select('name').eq('mobile', m.from).maybeSingle(),
    db.from('pros').select('name').eq('mobile', m.from).maybeSingle(),
  ]);
  const who = cust ? shortName(cust.name) : pro ? `${shortName(pro.name)} (pro)` : m.from;
  await sendEmail({
    to: ownerEmail(), template: 'ownerInbound', dedupeKey: `inbound:${m.id}:owner_email`,
    content: EMAILS.ownerInbound({ from: m.from, who, body: m.body || '(photo or empty message)', link: `${publicOrigin()}/admin` }),
  });
}

