'use server';

import { createServiceClient } from '@/lib/supabase/admin';
import { supabaseConfigured } from '@/lib/supabase/env';
import { createManageToken } from '@/lib/manage';
import { siteOrigin } from '@/lib/checkout';
import { TEXTS } from '@/lib/messages';
import { toE164 } from '@/lib/booking';

const LINKS_PER_HOUR = 3;

/**
 * "Find my booking": text a manage link to a number that has a booking. The answer is the
 * same whether or not the number is known, so the page never reveals who has a booking.
 */
export async function sendManageLink(phone: string): Promise<{ ok: true } | { ok: false; reason: 'invalid' }> {
  const mobile = toE164(phone);
  if (!mobile) return { ok: false, reason: 'invalid' };
  if (!supabaseConfigured()) return { ok: true };

  const db = createServiceClient();
  const { data: customer } = await db.from('customers').select('id, plans!inner(id)').eq('mobile', mobile)
    .in('plans.status', ['active', 'paused', 'ended']).limit(1).maybeSingle();
  if (!customer) return { ok: true };

  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await db.from('messages').select('id', { count: 'exact', head: true })
    .eq('to_address', mobile).eq('template', 'manage_link').gte('created_at', since);
  if ((count ?? 0) >= LINKS_PER_HOUR) return { ok: true };

  const token = await createManageToken(customer.id);
  const url = `${await siteOrigin()}/b/${token}`;
  // Queued here; build step 7 sends queued texts through Twilio.
  await db.from('messages').insert({ customer_id: customer.id, to_address: mobile, channel: 'sms', template: 'manage_link', body: TEXTS.manageLink(url), status: 'queued' });
  if (process.env.NODE_ENV !== 'production' || process.env.STRIPE_API_BASE) console.info('[dev] manage link for', mobile, url);
  return { ok: true };
}
