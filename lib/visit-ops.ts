import 'server-only';
import { createServiceClient } from './supabase/admin';
import { chargeVisit } from './payments';
import { stripeConfigured } from './stripe';
import { AUTOMATIONS, PET_WASTE_PRICING } from './config';
import {
  inBackground, notifyAssigned, notifyOnTheWay, notifyUpgradeAsked, notifyUpgradeDeclined, notifyVisitDone,
} from './notify';

// What happens to a visit after booking: a pro is assigned, goes on the way, marks it done
// (which charges the customer and sends the receipt), and the yard cleanup-upgrade answer.

export type AssignResult = { ok: true; assigned: number; skipped: number } | { ok: false; reason: 'not_found' | 'wrong_service' | 'cannot_take' | 'error' };

/** Assign a pro to a booking's upcoming visits; notify the pro and the customer. */
export async function assignPlan(planId: string, proId: string, from: string): Promise<AssignResult> {
  const { data, error } = await createServiceClient().rpc('assign_plan', { p_plan_id: planId, p_pro_id: proId, p_from: from });
  if (error) {
    console.error('assign_plan failed', error.message);
    return { ok: false, reason: 'error' };
  }
  const r = data as { ok: boolean; reason?: string; assigned?: number; skipped?: number; first_visit_id?: string };
  if (!r.ok) return { ok: false, reason: (r.reason as 'cannot_take') ?? 'error' };
  inBackground('assigned messages', () => notifyAssigned(r.first_visit_id!, proId));
  return { ok: true, assigned: r.assigned ?? 0, skipped: r.skipped ?? 0 };
}

/** "I'm on my way": tell the customer the arrival time (now + 30 minutes, rounded up to 5). */
export async function onTheWay(visitId: string, now = new Date()): Promise<Date> {
  const step = 5 * 60_000;
  const eta = new Date(Math.ceil((now.getTime() + AUTOMATIONS.onTheWayEtaMinutes * 60_000) / step) * step);
  const { data } = await createServiceClient().from('visits').update({ on_way_at: now.toISOString() })
    .eq('id', visitId).is('on_way_at', null).in('status', ['scheduled', 'confirmed']).select('id');
  if (data?.length) inBackground('on the way text', () => notifyOnTheWay(visitId, eta));
  return eta;
}

export type DoneResult = { ok: true; completedAt: string; upgrade: boolean } | { ok: false; reason: 'too_early' | 'not_open' | 'no_pro' | 'no_photo' | 'not_found' | 'error' };

/**
 * The pro marks the visit done. Yards worse than booked wait for the customer's YES before the
 * higher price is charged; otherwise the visit is charged now (yards) or its morning charge is
 * confirmed (cleans), then the customer gets the "done" text and the receipt.
 */
export async function markVisitDone(visitId: string, note: string, worse: boolean): Promise<DoneResult> {
  const db = createServiceClient();
  const { data: v } = await db.from('visits').select('id, price_cents, discount_cents, plan:plans!inner(service)')
    .eq('id', visitId).single<{ id: string; price_cents: number; discount_cents: number; plan: { service: string } }>();
  if (!v) return { ok: false, reason: 'not_found' };
  // The higher price is the initial yard cleanup; only ask when it's more than this visit costs.
  const upgradeCents = v.plan.service === 'pet' && worse && PET_WASTE_PRICING.initialCleanup * 100 > v.price_cents - v.discount_cents
    ? PET_WASTE_PRICING.initialCleanup * 100 : 0;
  const { data, error } = await db.rpc('mark_visit_done', { p_visit_id: visitId, p_note: note.slice(0, 1000), p_upgrade_cents: upgradeCents });
  if (error) {
    if (error.code === '23514' && /gate photo/.test(error.message)) return { ok: false, reason: 'no_photo' };
    console.error('mark_visit_done failed', error.message);
    return { ok: false, reason: 'error' };
  }
  const r = data as { ok: boolean; reason?: string; already?: boolean; completed_at?: string };
  if (!r.ok) return { ok: false, reason: (r.reason as 'too_early') ?? 'error' };
  if (!r.already) {
    if (upgradeCents) inBackground('upgrade question', () => notifyUpgradeAsked(visitId));
    else inBackground('visit done charge', () => chargeAndNotify(visitId));
  }
  return { ok: true, completedAt: r.completed_at!, upgrade: upgradeCents > 0 };
}

/** Charge a finished visit (no-op if already paid) and send the done text and receipt. */
export async function chargeAndNotify(visitId: string): Promise<void> {
  if (!stripeConfigured()) return;
  const r = await chargeVisit(visitId, 'visit');
  // A decline sends its own texts (lib/payments.ts → notifyPaymentFailed).
  if (r.ok) await notifyVisitDone(visitId, { amountCents: r.amountCents });
}

/** The customer's YES / NO to the cleanup-upgrade question. Returns the reply to text back, if any. */
export async function answerUpgrade(customerId: string, yes: boolean): Promise<{ handled: boolean; reply: string | null }> {
  const db = createServiceClient();
  const { data: v } = await db.from('visits').select('id, plans!inner(customer_id)')
    .eq('plans.customer_id', customerId).eq('upgrade_status', 'pending').order('completed_at', { ascending: false }).limit(1).maybeSingle();
  if (!v) return { handled: false, reply: null };
  const { data: changed } = await db.rpc('answer_upgrade', { p_visit_id: v.id, p_yes: yes });
  if (!changed) return { handled: false, reply: null };
  if (yes) {
    inBackground('upgrade charge', () => chargeAndNotify(v.id));
    return { handled: true, reply: null }; // the "done" text with the charge is the answer
  }
  inBackground('upgrade declined alert', () => notifyUpgradeDeclined(v.id));
  return { handled: true, reply: 'declined' };
}

/** A short-lived upload address for a visit's gate photo (the browser uploads straight to storage). */
export async function gatePhotoUpload(visitId: string): Promise<{ path: string; token: string } | null> {
  const path = `visits/${visitId}/${Date.now()}.jpg`;
  const { data, error } = await createServiceClient().storage.from('gate-photos').createSignedUploadUrl(path);
  if (error || !data) return null;
  return { path, token: data.token };
}

/** Save the uploaded gate photo on the visit, once storage confirms the file exists. */
export async function saveGatePhoto(visitId: string, path: string): Promise<boolean> {
  if (!path.startsWith(`visits/${visitId}/`)) return false;
  const db = createServiceClient();
  const { data } = await db.storage.from('gate-photos').list(`visits/${visitId}`, { search: path.split('/').pop() });
  if (!data?.length) return false;
  const { error } = await db.from('visits').update({ gate_photo_url: path }).eq('id', visitId).in('status', ['scheduled', 'confirmed']);
  return !error;
}
