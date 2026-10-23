'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { requireOwner } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/admin';
import { assignPlan } from '@/lib/visit-ops';
import { chargeVisit } from '@/lib/payments';
import { stripeConfigured } from '@/lib/stripe';
import { createProLink } from '@/lib/pro-links';
import { displayUrl, shortName } from '@/lib/format';
import { publicOrigin, sendText } from '@/lib/notify';
import { CONSENT, TEXTS } from '@/lib/messages';
import { toE164, todayIso } from '@/lib/booking';
import { ARRIVAL_WINDOWS, PRO_REQUIRED_DOCUMENTS, SERVICE_ZIPS } from '@/lib/config';

// Owner-only. Every action checks the signed-in owner first.

export type OwnerResult = { ok: true; message: string } | { ok: false; error: string };
const uuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s);

export async function assignPro(planId: string, proId: string): Promise<OwnerResult> {
  await requireOwner();
  if (!uuid(planId) || !uuid(proId)) return { ok: false, error: 'Pick a pro.' };
  const r = await assignPlan(planId, proId, todayIso());
  if (!r.ok) {
    return { ok: false, error: r.reason === 'cannot_take' ? 'That pro can’t take these visits (documents or day off).' : r.reason === 'wrong_service' ? 'That pro doesn’t do this service.' : 'Something went wrong. Please try again.' };
  }
  revalidatePath('/admin');
  return { ok: true, message: r.skipped ? `${r.assigned} visits assigned; ${r.skipped} still need a pro (day off or a document expiring first).` : 'assigned' };
}

export async function retryCharge(paymentId: string): Promise<OwnerResult> {
  await requireOwner();
  if (!stripeConfigured()) return { ok: false, error: 'Payments aren’t connected yet.' };
  const db = createServiceClient();
  const { data: f } = await db.from('payments').select('visit_id, kind, amount_cents, status').eq('id', paymentId).maybeSingle();
  if (!f || f.status !== 'failed') return { ok: false, error: 'That payment is no longer open.' };
  const r = await chargeVisit(f.visit_id, f.kind, f.kind === 'cleanup_upgrade' ? f.amount_cents : 0);
  revalidatePath('/admin');
  return r.ok ? { ok: true, message: 'Charged. The payment is settled.' } : { ok: false, error: r.reason === 'no_card' ? 'No card on file — the customer needs to add one.' : 'Still declined. The customer needs to update their card.' };
}

export async function markQuoted(quoteId: string): Promise<OwnerResult> {
  await requireOwner();
  if (!uuid(quoteId)) return { ok: false, error: 'Not found.' };
  await createServiceClient().from('quote_requests').update({ status: 'quoted' }).eq('id', quoteId);
  revalidatePath('/admin');
  return { ok: true, message: 'Marked as quoted.' };
}

// ───────── Capacity ─────────

export async function setCleanSlots(weekday: number, window: string, slots: number): Promise<OwnerResult> {
  await requireOwner();
  if (!(weekday >= 1 && weekday <= 6) || !ARRIVAL_WINDOWS.some((w) => w.id === window) || !(slots >= 0 && slots <= 50)) return { ok: false, error: 'Not saved.' };
  const { error } = await createServiceClient().from('capacity')
    .upsert({ kind: 'cleaning', weekday, date: null, window, slots, blocked: false, updated_at: new Date().toISOString() }, { onConflict: 'kind,weekday,date,window' });
  return error ? { ok: false, error: 'Not saved. Please try again.' } : { ok: true, message: 'Saved' };
}

export async function setYardSlots(weekday: number, slots: number): Promise<OwnerResult> {
  await requireOwner();
  if (!(weekday >= 1 && weekday <= 5) || !(slots >= 0 && slots <= 100)) return { ok: false, error: 'Not saved.' };
  const { error } = await createServiceClient().from('capacity')
    .upsert({ kind: 'yard', weekday, date: null, window: null, slots, blocked: false, updated_at: new Date().toISOString() }, { onConflict: 'kind,weekday,date,window' });
  return error ? { ok: false, error: 'Not saved. Please try again.' } : { ok: true, message: 'Saved' };
}

export async function blockDays(from: string, to: string, note: string): Promise<OwnerResult> {
  await requireOwner();
  const end = to || from;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || end < from || from < todayIso()) return { ok: false, error: 'Pick a date from today on.' };
  const dates: string[] = [];
  for (let d = new Date(`${from}T12:00:00Z`); d.toISOString().slice(0, 10) <= end && dates.length < 31; d.setUTCDate(d.getUTCDate() + 1)) dates.push(d.toISOString().slice(0, 10));
  const { error } = await createServiceClient().from('capacity').upsert(
    dates.map((date) => ({ kind: 'cleaning', weekday: null, date, window: null, slots: 0, blocked: true, note: note.trim().slice(0, 60) || null, updated_at: new Date().toISOString() })),
    { onConflict: 'kind,weekday,date,window' },
  );
  revalidatePath('/admin/capacity');
  return error ? { ok: false, error: 'Not saved. Please try again.' } : { ok: true, message: dates.length === 1 ? 'Day blocked.' : `${dates.length} days blocked.` };
}

export async function unblockDays(dates: string[]): Promise<OwnerResult> {
  await requireOwner();
  const ok = dates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
  await createServiceClient().from('capacity').delete().eq('kind', 'cleaning').is('window', null).in('date', ok);
  revalidatePath('/admin/capacity');
  return { ok: true, message: 'Removed.' };
}

// ───────── Pros ─────────

export interface ProInput { name: string; mobile: string; services: string[]; cities: string[]; offWeekdays: number[]; consent: boolean; active?: boolean }

function cleanPro(i: ProInput) {
  const mobile = toE164(i.mobile);
  const services = i.services.filter((s) => s === 'cleaning' || s === 'pet');
  const zips = Object.entries(SERVICE_ZIPS).filter(([, city]) => i.cities.includes(city)).map(([z]) => z);
  const off = [...new Set(i.offWeekdays.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))];
  return { name: i.name.trim().slice(0, 120), mobile, services, zips, off };
}

export async function savePro(id: string | null, input: ProInput): Promise<OwnerResult & { id?: string }> {
  const owner = await requireOwner();
  const p = cleanPro(input);
  if (!p.name) return { ok: false, error: 'Enter their name.' };
  if (!p.mobile) return { ok: false, error: 'Enter a 10-digit mobile number.' };
  if (!p.services.length) return { ok: false, error: 'Pick at least one service.' };
  const db = createServiceClient();
  const row = { name: p.name, mobile: p.mobile, service_types: p.services, zips: p.zips, off_weekdays: p.off, ...(input.active === undefined ? {} : { active: input.active }) };
  const res = id ? await db.from('pros').update(row).eq('id', id).select('id').single() : await db.from('pros').insert(row).select('id').single();
  if (res.error) return { ok: false, error: res.error.code === '23505' ? 'Another pro already has that mobile number.' : 'Not saved. Please try again.' };
  // Job texts need the pro's agreement, logged like a customer's.
  if (input.consent) {
    const { data: has } = await db.rpc('sms_allowed', { p_phone: p.mobile, p_kind: 'pro_jobs' });
    if (!has) {
      const h = await headers();
      await db.from('sms_consent').insert({
        pro_id: res.data.id, phone: p.mobile, kind: 'pro_jobs', form: 'pro_signup', consent_text_version: CONSENT.pro.version,
        consent_text: `${CONSENT.pro.text} (recorded by the owner, ${owner.email})`, user_agent: (h.get('user-agent') ?? '').slice(0, 400) || null,
      });
    }
  }
  revalidatePath('/admin/pros');
  return { ok: true, message: id ? 'Saved.' : 'Pro added.', id: res.data.id };
}

export async function verifyDoc(docId: string): Promise<OwnerResult> {
  const owner = await requireOwner();
  if (!uuid(docId)) return { ok: false, error: 'Not found.' };
  const { error } = await createServiceClient().from('pro_documents').update({ verified_by: owner.id, verified_at: new Date().toISOString() }).eq('id', docId).is('verified_at', null);
  revalidatePath('/admin/pros');
  return error ? { ok: false, error: 'Not saved.' } : { ok: true, message: 'Verified.' };
}

export async function deleteDoc(docId: string): Promise<OwnerResult> {
  await requireOwner();
  const db = createServiceClient();
  const { data: d } = await db.from('pro_documents').select('file_url').eq('id', docId).maybeSingle();
  if (!d) return { ok: false, error: 'Not found.' };
  await db.from('pro_documents').delete().eq('id', docId);
  await db.storage.from('pro-documents').remove([d.file_url]);
  revalidatePath('/admin/pros');
  return { ok: true, message: 'Removed.' };
}

/** Text the pro their own documents link (/job/[token]) to upload a new certificate. */
export async function sendDocsLink(proId: string): Promise<OwnerResult> {
  await requireOwner();
  const { data: p } = await createServiceClient().from('pros').select('id, name, mobile, active').eq('id', proId).maybeSingle();
  if (!p?.active) return { ok: false, error: 'That pro isn’t active.' };
  const link = displayUrl(`${publicOrigin()}/job/${await createProLink('docs', p.id)}`);
  const r = await sendText({ to: p.mobile, proId: p.id, audience: 'pro', template: 'proDocsLink', body: TEXTS.proDocsLink({ link }) });
  if (r.sent) return { ok: true, message: `Upload link texted to ${shortName(p.name)}.` };
  return { ok: false, error: r.reason === 'no_consent' || r.reason === 'opted_out' ? 'They haven’t agreed to job texts (or texted STOP).' : r.reason === 'not_configured' ? `Texts aren’t connected yet. The link: ${link}` : 'The text didn’t send. Please try again.' };
}

/** The owner uploads a document for a pro (already checked, so it's verified at once). */
export async function startOwnerDocUpload(proId: string, kind: string, ext: string): Promise<{ ok: true; path: string; uploadToken: string } | { ok: false; error: string }> {
  await requireOwner();
  if (!uuid(proId) || !PRO_REQUIRED_DOCUMENTS.includes(kind as never)) return { ok: false, error: 'Not found.' };
  const safeExt = ['pdf', 'jpg', 'jpeg', 'png'].includes(ext.toLowerCase()) ? ext.toLowerCase() : 'pdf';
  const path = `${proId}/${kind}-${Date.now()}.${safeExt}`;
  const { data, error } = await createServiceClient().storage.from('pro-documents').createSignedUploadUrl(path);
  return error || !data ? { ok: false, error: 'The file couldn’t be uploaded.' } : { ok: true, path, uploadToken: data.token };
}

export async function saveOwnerDoc(proId: string, kind: string, path: string, expiresOn: string): Promise<OwnerResult> {
  const owner = await requireOwner();
  if (!path.startsWith(`${proId}/${kind}-`)) return { ok: false, error: 'Not saved.' };
  if (kind !== 'background_check' && !/^\d{4}-\d{2}-\d{2}$/.test(expiresOn)) return { ok: false, error: 'Enter the expiry date.' };
  const { error } = await createServiceClient().from('pro_documents').insert({
    pro_id: proId, kind, file_url: path, expires_on: kind === 'background_check' ? null : expiresOn, verified_by: owner.id, verified_at: new Date().toISOString(),
  });
  revalidatePath('/admin/pros');
  return error ? { ok: false, error: 'Not saved. Please try again.' } : { ok: true, message: 'Uploaded and verified.' };
}
