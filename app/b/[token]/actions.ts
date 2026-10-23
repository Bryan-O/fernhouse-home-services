'use server';

import { createServiceClient } from '@/lib/supabase/admin';
import { customerForToken } from '@/lib/manage';
import { changeTerms, guaranteeOpen } from '@/lib/policy';
import { chargeVisit, createCardUpdateSession, refundVisit } from '@/lib/payments';
import { encryptField } from '@/lib/crypto';
import { stripeConfigured } from '@/lib/stripe';
import { firstRouteDate, fmtLong, fmtShort, todayIso } from '@/lib/booking';
import { ARRIVAL_WINDOWS, POLICIES, ROUTE_DAYS, type ArrivalWindowId, type RouteDayId } from '@/lib/config';

// Every action re-checks the manage link and that the visit or plan belongs to its customer.
// Customer texts and emails for each change are sent from build step 7.

export type ActionResult =
  | { ok: true; toast: string; feeCents?: number; feeCharged?: boolean; refundedCents?: number }
  | { ok: false; error: string };

const fail = (error: string): ActionResult => ({ ok: false, error });
const CALL = 'Please text or call us and we’ll sort it out.';

interface OwnedVisit {
  id: string; date: string; window: ArrivalWindowId | null; status: string; fee_cents: number;
  plan: { id: string; customer_id: string; service: string; frequency: string; status: string };
}

async function ownedVisit(token: string, visitId: string): Promise<OwnedVisit | null> {
  const customerId = await customerForToken(token);
  if (!customerId || !/^[0-9a-f-]{36}$/i.test(visitId)) return null;
  const { data } = await createServiceClient().from('visits')
    .select('id, date, window, status, fee_cents, plan:plans!inner(id, customer_id, service, frequency, status)')
    .eq('id', visitId).single<OwnedVisit>();
  return data && data.plan.customer_id === customerId ? data : null;
}

async function ownedPlan(token: string, planId: string) {
  const customerId = await customerForToken(token);
  if (!customerId || !/^[0-9a-f-]{36}$/i.test(planId)) return null;
  const { data } = await createServiceClient().from('plans')
    .select('id, customer_id, service, frequency, status, route_day, address_id').eq('id', planId).single();
  return data && data.customer_id === customerId ? data : null;
}

async function nextOpenVisit(planId: string) {
  const { data } = await createServiceClient().from('visits').select('date, window')
    .eq('plan_id', planId).in('status', ['scheduled', 'confirmed']).gte('date', todayIso())
    .order('date').limit(1).maybeSingle();
  return data;
}

const windowShort = (w: ArrivalWindowId | null) => ARRIVAL_WINDOWS.find((x) => x.id === w)?.short ?? '';

/** Charge the late fee (once per visit) to the saved card. */
async function lateFee(visitId: string) {
  const r = await chargeVisit(visitId, 'late_fee');
  return r.ok;
}

export async function rescheduleVisit(token: string, visitId: string, date: string, window: ArrivalWindowId): Promise<ActionResult> {
  const v = await ownedVisit(token, visitId);
  if (!v || v.plan.service === 'pet' || !ARRIVAL_WINDOWS.some((w) => w.id === window) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail('That visit can’t be moved here.');
  const t = changeTerms(v);
  if (!t.allowed) return fail(`Your visit has already started. ${CALL}`);
  const fee = t.free || v.fee_cents > 0 ? 0 : t.feeCents;
  const { data, error } = await createServiceClient().rpc('reschedule_visit', { p_visit_id: v.id, p_date: date, p_window: window, p_fee_cents: fee });
  if (error) return fail('We couldn’t move your visit just now. Please try again.');
  const r = data as { ok: boolean; reason?: string };
  if (!r.ok) return fail(r.reason === 'full' ? 'That time just filled up — please pick another.' : r.reason === 'clash' ? 'You already have a visit that day — please pick another.' : 'That visit can’t be moved here.');
  const feeCharged = fee > 0 && stripeConfigured() ? await lateFee(v.id) : false;
  return { ok: true, toast: `Moved to ${fmtShort(date)}, ${windowShort(window)}. We’ve texted you a confirmation.`, feeCents: fee, feeCharged };
}

export async function skipVisit(token: string, visitId: string): Promise<ActionResult> {
  const v = await ownedVisit(token, visitId);
  if (!v || v.plan.frequency === 'one_time') return fail('That visit can’t be skipped here.');
  const t = changeTerms(v);
  if (!t.allowed) return fail(v.window ? `Your visit has already started. ${CALL}` : `Skips close at ${t.deadlineLabel}. ${CALL}`);
  const fee = t.free || v.fee_cents > 0 ? 0 : t.feeCents;
  const { data, error } = await createServiceClient().rpc('drop_visit', { p_visit_id: v.id, p_status: 'skipped', p_fee_cents: fee });
  if (error || !(data as { ok: boolean }).ok) return fail('We couldn’t skip that visit. Please try again.');
  const feeCharged = fee > 0 && stripeConfigured() ? await lateFee(v.id) : false;
  const next = await nextOpenVisit(v.plan.id);
  const day = fmtShort(v.date).split(', ')[1];
  return { ok: true, toast: `${day} skipped.${next ? ` Your next visit is ${fmtLong(next.date)}.` : ''}`, feeCents: fee, feeCharged };
}

export async function undoSkip(token: string, visitId: string): Promise<ActionResult> {
  const v = await ownedVisit(token, visitId);
  if (!v || v.status !== 'skipped') return fail('That visit can’t be brought back.');
  if (!changeTerms(v).allowed) return fail(CALL);
  const { data } = await createServiceClient().rpc('restore_visit', { p_visit_id: v.id });
  if (!data) return fail('That visit can’t be brought back.');
  return { ok: true, toast: `${fmtShort(v.date).split(', ')[1]} is back on.` };
}

export async function cancelVisit(token: string, visitId: string, reason: string): Promise<ActionResult> {
  const v = await ownedVisit(token, visitId);
  if (!v || !['scheduled', 'confirmed'].includes(v.status)) return fail('That visit is already cancelled.');
  const t = changeTerms(v);
  if (!t.allowed) return fail(v.window ? `Your visit has already started. ${CALL}` : `Changes close at ${t.deadlineLabel}. ${CALL}`);
  const fee = t.free || v.fee_cents > 0 ? 0 : t.feeCents;
  const db = createServiceClient();
  const { data, error } = await db.rpc('drop_visit', { p_visit_id: v.id, p_status: 'cancelled', p_fee_cents: fee });
  if (error || !(data as { ok: boolean }).ok) return fail('We couldn’t cancel that visit. Please try again.');
  await db.from('visits').update({ cancel_reason: reason.slice(0, 100) || null }).eq('id', v.id);

  // A prepaid visit is refunded (minus the late fee); otherwise the late fee is charged.
  const { data: paid } = await db.from('payments').select('id').eq('visit_id', v.id).eq('kind', 'visit').eq('status', 'succeeded').maybeSingle();
  let feeCharged = false;
  let refundedCents = 0;
  if (stripeConfigured()) {
    if (paid) {
      const r = await refundVisit(v.id, fee + v.fee_cents);
      refundedCents = r.refundedCents;
      feeCharged = fee > 0;
    } else if (fee > 0) {
      feeCharged = await lateFee(v.id);
    }
  }
  return { ok: true, toast: 'Visit cancelled.', feeCents: fee, feeCharged, refundedCents };
}

export async function setPlanPaused(token: string, planId: string, paused: boolean): Promise<ActionResult> {
  const p = await ownedPlan(token, planId);
  if (!p || p.frequency === 'one_time') return fail('That plan can’t be paused.');
  const { data } = await createServiceClient().rpc('set_plan_paused', { p_plan_id: p.id, p_paused: paused, p_keep_days: 1 });
  if (!data) return fail('Nothing changed — please refresh the page.');
  return { ok: true, toast: paused ? 'Plan paused. No visits are scheduled until you resume.' : 'Plan resumed.' };
}

export async function cancelPlan(token: string, planId: string): Promise<ActionResult> {
  const p = await ownedPlan(token, planId);
  if (!p) return fail('That plan can’t be cancelled here.');
  const db = createServiceClient();
  const { data } = await db.rpc('end_plan', { p_plan_id: p.id, p_keep_days: 1 });
  if (!data) return fail('That plan has already ended.');
  // Refund any prepaid visit that was just cancelled (free: more than a day out).
  const { data: prepaid } = await db.from('visits').select('id, payments!inner(kind, status)')
    .eq('plan_id', p.id).eq('status', 'cancelled').eq('payments.kind', 'visit').eq('payments.status', 'succeeded');
  if (stripeConfigured()) for (const v of prepaid ?? []) await refundVisit(v.id, 0);
  const kept = await nextOpenVisit(p.id);
  return {
    ok: true,
    toast: kept
      ? `Plan cancelled. Your visit on ${fmtLong(kept.date)} is less than ${POLICIES.freeChangeHours} hours away and stays booked — you can cancel it below.`
      : 'Plan cancelled. No more visits are scheduled.',
  };
}

export async function changeRouteDay(token: string, planId: string, routeDay: RouteDayId): Promise<ActionResult> {
  const p = await ownedPlan(token, planId);
  if (!p || p.service !== 'pet' || !ROUTE_DAYS.some((r) => r.id === routeDay)) return fail('That plan can’t change route day here.');
  const next = await nextOpenVisit(p.id);
  if (next && !changeTerms({ date: next.date, window: null }).allowed) return fail(`Route-day changes for this week have closed. ${CALL}`);
  const first = firstRouteDate(routeDay, todayIso());
  const { data, error } = await createServiceClient().rpc('change_route_day', { p_plan_id: p.id, p_route: routeDay.toLowerCase(), p_first: first });
  if (error) return fail('We couldn’t change your route day just now. Please try again.');
  const r = data as { ok: boolean; reason?: string };
  if (!r.ok) return fail(r.reason === 'full' ? 'That route day is full — please pick another.' : 'That plan can’t change route day here.');
  const full = ROUTE_DAYS.find((x) => x.id === routeDay)!.full;
  return { ok: true, toast: `Route day changed to ${full}s. First visit ${fmtLong(first)}.` };
}

export interface NotesInput {
  access?: string; gate?: string; petsNote?: string; requests?: string; dogNames?: string; dogsFriendly?: boolean;
}

export async function updateNotes(token: string, planId: string, input: NotesInput): Promise<ActionResult> {
  const p = await ownedPlan(token, planId);
  if (!p) return fail('Those notes can’t be changed here.');
  const db = createServiceClient();
  const clip = (s: string | undefined, n: number) => (s ?? '').trim().slice(0, n) || null;
  if (p.service === 'pet') {
    await db.from('addresses').update({ gate_code: encryptField(clip(input.gate, 500)) }).eq('id', p.address_id);
    await db.from('plans').update({ dog_names: clip(input.dogNames, 200), dogs_friendly: input.dogsFriendly ?? null, requests: clip(input.requests, 1000) }).eq('id', p.id);
  } else {
    await db.from('addresses').update({ access_notes: encryptField(clip(input.access, 1000)) }).eq('id', p.address_id);
    await db.from('plans').update({ pets_note: clip(input.petsNote, 500), requests: clip(input.requests, 1000) }).eq('id', p.id);
  }
  return { ok: true, toast: 'Saved. Your team will see the update.' };
}

export async function requestRedo(token: string, visitId: string, note: string): Promise<ActionResult> {
  const v = await ownedVisit(token, visitId);
  if (!v || v.status !== 'done') return fail('That visit can’t take a request.');
  const { data: done } = await createServiceClient().from('visits').select('completed_at').eq('id', v.id).single();
  if (!guaranteeOpen(done?.completed_at ?? null).open) return fail(`The ${POLICIES.guaranteeWindow} window for this visit has closed. ${CALL}`);
  const kind = v.plan.service === 'pet' ? 'rescoop' : 'reclean';
  const { error } = await createServiceClient().from('service_requests').insert({ visit_id: v.id, kind, note: note.trim().slice(0, 1000) || null });
  if (error) return fail(error.code === '23505' ? 'You’ve already asked about this visit — we’re on it.' : 'We couldn’t send that just now. Please try again.');
  // TODO (build step 7/9): alert the owner and text the customer when the return visit is set.
  return { ok: true, toast: kind === 'rescoop' ? 'Got it — we’ll be back to re-scoop, free. We’ll text you when.' : 'Got it — we’ll send a team back to re-clean, free. We’ll text you the time.' };
}

export async function startCardUpdate(token: string): Promise<{ url: string } | { error: string }> {
  const customerId = await customerForToken(token);
  if (!customerId) return { error: 'This link has expired.' };
  if (!stripeConfigured()) return { error: 'Card updates aren’t connected yet.' };
  const url = await createCardUpdateSession(customerId, `/b/${token}`).catch(() => null);
  return url ? { url } : { error: 'We couldn’t open the card page just now. Please try again.' };
}
