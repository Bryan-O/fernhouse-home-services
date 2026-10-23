'use server';

import { createServiceClient } from '@/lib/supabase/admin';
import { resolveProLink } from '@/lib/pro-links';
import { linkVisit } from '@/lib/job';
import { gatePhotoUpload, markVisitDone, onTheWay, saveGatePhoto } from '@/lib/visit-ops';
import { clockText } from '@/lib/format';
import { PRO_REQUIRED_DOCUMENTS } from '@/lib/config';
import { todayIso } from '@/lib/booking';

// Every action re-checks the link: it must be live and the visit still this pro's.

async function ownedVisit(token: string, visitId?: string) {
  const link = await resolveProLink(token);
  if (!link || link.kind === 'docs') return null;
  return linkVisit(link, visitId);
}

const CALL = 'Please call Fernhouse.';

export async function sayOnMyWay(token: string, visitId?: string): Promise<{ ok: true; eta: string } | { ok: false; error: string }> {
  const v = await ownedVisit(token, visitId);
  if (!v || v.status === 'done' || v.date !== todayIso()) return { ok: false, error: `That can only be sent on the visit day. ${CALL}` };
  const eta = await onTheWay(v.id);
  return { ok: true, eta: clockText(eta) };
}

export async function startGatePhoto(token: string, visitId?: string): Promise<{ ok: true; path: string; uploadToken: string } | { ok: false; error: string }> {
  const v = await ownedVisit(token, visitId);
  if (!v || v.status === 'done') return { ok: false, error: `This job can’t take a photo now. ${CALL}` };
  const u = await gatePhotoUpload(v.id);
  return u ? { ok: true, path: u.path, uploadToken: u.token } : { ok: false, error: 'The photo couldn’t be uploaded. Please try again.' };
}

export async function finishGatePhoto(token: string, path: string, visitId?: string): Promise<{ ok: boolean }> {
  const v = await ownedVisit(token, visitId);
  if (!v) return { ok: false };
  return { ok: await saveGatePhoto(v.id, path) };
}

export async function markDone(token: string, note: string, worse: boolean, visitId?: string): Promise<{ ok: true; doneAt: string; upgrade: boolean } | { ok: false; error: string }> {
  const v = await ownedVisit(token, visitId);
  if (!v) return { ok: false, error: `This link no longer works. ${CALL}` };
  const r = await markVisitDone(v.id, String(note ?? ''), !!worse);
  if (!r.ok) {
    const msg = { too_early: 'You can mark this done on the visit day.', no_photo: 'Add the gate photo to finish.', not_open: `This visit was cancelled or moved. ${CALL}` }[r.reason as string];
    return { ok: false, error: msg ?? `Something went wrong. Please try again, or ${CALL.toLowerCase()}` };
  }
  return { ok: true, doneAt: clockText(new Date(r.completedAt)), upgrade: r.upgrade };
}

// ───────── Documents (docs links) ─────────

type DocKind = (typeof PRO_REQUIRED_DOCUMENTS)[number];

export async function startDocUpload(token: string, kind: DocKind, ext: string): Promise<{ ok: true; path: string; uploadToken: string } | { ok: false; error: string }> {
  const link = await resolveProLink(token);
  if (!link || link.kind !== 'docs' || !PRO_REQUIRED_DOCUMENTS.includes(kind)) return { ok: false, error: 'This link no longer works. Ask Fernhouse for a new one.' };
  const safeExt = ['pdf', 'jpg', 'jpeg', 'png'].includes(ext.toLowerCase()) ? ext.toLowerCase() : 'pdf';
  const path = `${link.pro_id}/${kind}-${Date.now()}.${safeExt}`;
  const { data, error } = await createServiceClient().storage.from('pro-documents').createSignedUploadUrl(path);
  return error || !data ? { ok: false, error: 'The file couldn’t be uploaded. Please try again.' } : { ok: true, path, uploadToken: data.token };
}

export async function saveDoc(token: string, kind: DocKind, path: string, expiresOn: string): Promise<{ ok: boolean; error?: string }> {
  const link = await resolveProLink(token);
  if (!link || link.kind !== 'docs' || !path.startsWith(`${link.pro_id}/${kind}-`)) return { ok: false, error: 'This link no longer works.' };
  if (kind !== 'background_check' && !(/^\d{4}-\d{2}-\d{2}$/.test(expiresOn) && expiresOn >= todayIso())) return { ok: false, error: 'Enter the expiry date shown on the certificate.' };
  const db = createServiceClient();
  const { data: files } = await db.storage.from('pro-documents').list(link.pro_id, { search: path.split('/').pop() });
  if (!files?.length) return { ok: false, error: 'The file didn’t arrive. Please try again.' };
  const { error } = await db.from('pro_documents').insert({ pro_id: link.pro_id, kind, file_url: path, expires_on: kind === 'background_check' ? null : expiresOn });
  return error ? { ok: false, error: 'That couldn’t be saved. Please try again.' } : { ok: true };
}
