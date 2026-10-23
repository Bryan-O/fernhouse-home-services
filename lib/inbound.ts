import 'server-only';
import { createServiceClient } from './supabase/admin';
import { TEXTS } from './messages';
import { keywordOf, type Keyword } from './keywords';
import { inBackground, notifyInbound } from './notify';
import { answerUpgrade } from './visit-ops';

/**
 * A text to our number. Logs it, applies STOP / START to consent, and returns the reply to send
 * (null for none). When Twilio's own opt-out handling already answered a keyword (OptOutType is
 * set), consent is still recorded but no second reply is sent.
 */
export async function handleInbound(params: Record<string, string>): Promise<string | null> {
  const db = createServiceClient();
  const from = params.From ?? '';
  const body = (params.Body ?? '').slice(0, 1600);
  if (!/^\+1[2-9]\d{9}$/.test(from)) return null; // short codes and non-US numbers: ignore

  const [{ data: cust }, { data: pro }] = await Promise.all([
    db.from('customers').select('id').eq('mobile', from).maybeSingle(),
    db.from('pros').select('id').eq('mobile', from).maybeSingle(),
  ]);
  // Twilio retries a webhook on timeout: the MessageSid makes logging it idempotent.
  const { data: logged } = await db.from('messages').upsert({
    customer_id: cust?.id ?? null, pro_id: pro?.id ?? null, to_address: from, channel: 'sms', template: 'inbound',
    body: body || (Number(params.NumMedia) > 0 ? '(photo)' : ''), provider_id: params.MessageSid || null, status: 'received',
    sent_at: new Date().toISOString(),
  }, { onConflict: 'provider_id', ignoreDuplicates: true }).select('id');
  const inboundId = logged?.[0]?.id;
  if (!inboundId) return null; // a retry of a message we already handled

  const { data: consents } = await db.from('sms_consent').select('revoked_at').eq('phone', from);
  const optedOut = !!consents?.length && consents.every((c) => c.revoked_at);
  const twilioOptOut = (params.OptOutType ?? '').toUpperCase();
  const kw: Keyword = twilioOptOut === 'STOP' ? 'stop' : twilioOptOut === 'START' ? 'start' : twilioOptOut === 'HELP' ? 'help' : keywordOf(body, optedOut);

  let reply: string | null = null;
  if (kw === 'stop') {
    await db.rpc('sms_opt_out', { p_phone: from });
    reply = TEXTS.stop();
  } else if (kw === 'start') {
    await db.rpc('sms_opt_in', { p_phone: from, p_text: `Texted “${body.trim().slice(0, 40)}” to resubscribe` });
    reply = TEXTS.start();
  } else if (kw === 'help') {
    reply = TEXTS.help();
  } else {
    // YES / NO answers the yard cleanup-upgrade question, when one is waiting.
    const word = body.trim().toUpperCase().replace(/[^A-Z]/g, '');
    const answer = cust && ['YES', 'Y', 'NO', 'N'].includes(word) ? await answerUpgrade(cust.id, word.startsWith('Y')) : null;
    if (!answer?.handled) {
      // Anything else is a person writing to us: it goes to the owner's inbox.
      inBackground('inbound forward', () => notifyInbound({ id: inboundId, from, body }));
      return null;
    }
    if (!answer.reply) return null;
    reply = TEXTS.upgradeDeclined();
  }

  const answeredByTwilio = !!twilioOptOut;
  await db.from('messages').insert({
    customer_id: cust?.id ?? null, pro_id: pro?.id ?? null, to_address: from, channel: 'sms', template: kw ? `keyword_${kw}` : 'upgradeDeclined',
    // Sent as the TwiML reply (or already by Twilio's opt-out handling) — logged either way.
    body: reply, status: 'sent', inbound_of: inboundId, sent_at: new Date().toISOString(),
  });
  return answeredByTwilio ? null : reply;
}
