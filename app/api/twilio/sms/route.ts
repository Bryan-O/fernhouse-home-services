import { readTwilioWebhook, twiml } from '@/lib/twilio';
import { handleInbound } from '@/lib/inbound';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Twilio → Fernhouse: texts to our number. Set as the number's (or Messaging Service's)
// "A message comes in" webhook: https://<domain>/api/twilio/sms (HTTP POST).
// Keyword replies go back as TwiML; everything else is forwarded to the owner.
export async function POST(request: Request) {
  if (!process.env.TWILIO_AUTH_TOKEN) return new Response('not configured', { status: 503 });
  const params = await readTwilioWebhook(request);
  if (!params) return new Response('bad signature', { status: 403 });
  let reply: string | null = null;
  try {
    reply = await handleInbound(params);
  } catch (err) {
    // Twilio retries on a 5xx; logging is idempotent by MessageSid, so a retry is safe.
    console.error('twilio inbound failed', (err as Error).message);
    return new Response('error', { status: 500 });
  }
  return new Response(twiml(reply ?? undefined), { headers: { 'Content-Type': 'text/xml' } });
}
