import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { createServiceClient } from './supabase/admin';
import { atlantaTime } from './policy';
import { addDays } from './booking';
import { LINKS } from './config';

// Links texted to pros (/job/[token]): no login, one random token each, only its hash stored.

export type ProLinkKind = 'visit' | 'route' | 'docs';
export interface ProLink { id: string; kind: ProLinkKind; pro_id: string; visit_id: string | null; route_date: string | null }

const hash = (t: string) => createHash('sha256').update(t).digest('hex');

/** A job or route link lasts until 24 hours after the visit day ends; a documents link 14 days. */
function expiry(kind: ProLinkKind, date: string | null): string {
  if (kind === 'docs') return new Date(Date.now() + LINKS.proDocsLinkDays * 86400_000).toISOString();
  return atlantaTime(addDays(date!, 1 + Math.ceil(LINKS.jobLinkHoursAfterVisit / 24)), 0).toISOString();
}

export async function createProLink(kind: ProLinkKind, proId: string, o: { visitId?: string; date?: string } = {}): Promise<string> {
  const db = createServiceClient();
  let date = o.date ?? null;
  if (kind === 'visit') {
    const { data: v } = await db.from('visits').select('date').eq('id', o.visitId!).single();
    if (!v) throw new Error('pro link: visit not found');
    date = v.date;
  }
  if (kind !== 'docs' && !date) throw new Error('pro link: a date is needed');
  const token = randomBytes(24).toString('base64url');
  const { error } = await db.from('pro_links').insert({
    kind, pro_id: proId, visit_id: kind === 'visit' ? o.visitId : null, route_date: kind === 'route' ? date : null,
    token_hash: hash(token), expires_at: expiry(kind, date),
  });
  if (error) throw new Error(`pro link insert failed: ${error.message}`);
  return token;
}

export async function resolveProLink(token: string): Promise<ProLink | null> {
  if (!/^[A-Za-z0-9_-]{32}$/.test(token)) return null;
  const { data } = await createServiceClient().from('pro_links').select('id, kind, pro_id, visit_id, route_date')
    .eq('token_hash', hash(token)).gt('expires_at', new Date().toISOString()).maybeSingle();
  return (data as ProLink) ?? null;
}
