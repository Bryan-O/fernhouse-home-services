import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

// Twilio Programmable Messaging over its REST API (no SDK needed for send + signature check).
// Keys live in .env.local / Vercel env only. TWILIO_API_BASE points at a local mock in tests.

export function twilioConfigured(): boolean {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM);
}

export class TwilioError extends Error {
  constructor(message: string, readonly code: number | null, readonly status: number) {
    super(message);
  }
}

// Twilio's error for a number that texted STOP.
export const TWILIO_OPTED_OUT = 21610;

export async function twilioSend(m: { to: string; body: string; mediaUrl?: string; statusCallback?: string }): Promise<{ sid: string; status: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const from = process.env.TWILIO_FROM!;
  const base = (process.env.TWILIO_API_BASE ?? 'https://api.twilio.com').replace(/\/$/, '');
  const form = new URLSearchParams({ To: m.to, Body: m.body });
  // A Messaging Service (MG…) handles sender choice, Smart Encoding and opt-out replies.
  form.set(from.startsWith('MG') ? 'MessagingServiceSid' : 'From', from);
  if (m.mediaUrl) form.set('MediaUrl', m.mediaUrl);
  if (m.statusCallback) form.set('StatusCallback', m.statusCallback);
  const res = await fetch(`${base}/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form,
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => ({}))) as { sid?: string; status?: string; code?: number; message?: string };
  if (!res.ok || !json.sid) throw new TwilioError(json.message ?? `Twilio HTTP ${res.status}`, json.code ?? null, res.status);
  return { sid: json.sid, status: json.status ?? 'queued' };
}

/** X-Twilio-Signature: base64 HMAC-SHA1 of the full URL followed by each POST param (sorted) as name+value. */
export function twilioSignature(authToken: string, url: string, params: Record<string, string>): string {
  const data = Object.keys(params).sort().reduce((acc, k) => acc + k + params[k], url);
  return createHmac('sha1', authToken).update(data, 'utf8').digest('base64');
}

export function validTwilioSignature(authToken: string, url: string, params: Record<string, string>, signature: string | null): boolean {
  if (!signature) return false;
  const want = Buffer.from(twilioSignature(authToken, url, params));
  const got = Buffer.from(signature);
  return want.length === got.length && timingSafeEqual(want, got);
}

/**
 * Read and verify a Twilio webhook. Twilio signs the public URL it called, so behind a proxy
 * the URL is rebuilt from SITE_ORIGIN when it's set.
 */
export async function readTwilioWebhook(request: Request): Promise<Record<string, string> | null> {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token) return null;
  const params = Object.fromEntries(new URLSearchParams(await request.text())) as Record<string, string>;
  const u = new URL(request.url);
  const url = process.env.SITE_ORIGIN ? `${process.env.SITE_ORIGIN.replace(/\/$/, '')}${u.pathname}${u.search}` : u.toString();
  return validTwilioSignature(token, url, params, request.headers.get('x-twilio-signature')) ? params : null;
}

export const twiml = (reply?: string) =>
  `<?xml version="1.0" encoding="UTF-8"?><Response>${reply ? `<Message>${reply.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</Message>` : ''}</Response>`;
