import { readTwilioWebhook } from '@/lib/twilio';
import { createServiceClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Twilio delivery reports for texts we sent (StatusCallback). Moves a message forward only:
// a late "sent" never overwrites "delivered".
const RANK = { queued: 0, sent: 1, delivered: 2, failed: 2 } as const;
const MAP: Record<string, keyof typeof RANK> = {
  accepted: 'queued', queued: 'queued', sending: 'queued', sent: 'sent', delivered: 'delivered', undelivered: 'failed', failed: 'failed',
};

export async function POST(request: Request) {
  if (!process.env.TWILIO_AUTH_TOKEN) return new Response('not configured', { status: 503 });
  const params = await readTwilioWebhook(request);
  if (!params) return new Response('bad signature', { status: 403 });
  const status = MAP[params.MessageStatus ?? ''];
  if (!status || !params.MessageSid) return new Response(null, { status: 204 });

  const db = createServiceClient();
  const { data: m } = await db.from('messages').select('id, status').eq('provider_id', params.MessageSid).maybeSingle();
  if (m && RANK[status] > (RANK[m.status as keyof typeof RANK] ?? 0)) {
    await db.from('messages').update({
      status,
      ...(status === 'failed' ? { error: `twilio_${params.ErrorCode || 'undelivered'}` } : {}),
    }).eq('id', m.id);
  }
  return new Response(null, { status: 204 });
}
