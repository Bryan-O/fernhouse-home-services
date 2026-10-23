'use server';

import { createServiceClient } from '@/lib/supabase/admin';
import { supabaseConfigured } from '@/lib/supabase/env';
import { inBackground, notifyManageLink } from '@/lib/notify';
import { toE164 } from '@/lib/booking';
import { LIMITS } from '@/lib/config';


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
    .eq('to_address', mobile).eq('template', 'manageLink').gte('created_at', since);
  if ((count ?? 0) >= LIMITS.manageLinksPerHour) return { ok: true };

  // Sent after the response, so a known number answers no slower than an unknown one.
  inBackground('manage link text', () => notifyManageLink(customer.id, mobile));
  return { ok: true };
}
