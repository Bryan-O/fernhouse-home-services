import 'server-only';
import { BRAND } from './config';

// Resend sends our automated email from bookings@<domain>, with replies going to the Gmail inbox.
// The key lives in .env.local / Vercel env only. RESEND_API_BASE points at a local mock in tests.

export function resendConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export class ResendError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function resendSend(m: { to: string; subject: string; html: string; text: string; idempotencyKey?: string }): Promise<{ id: string }> {
  const base = (process.env.RESEND_API_BASE ?? 'https://api.resend.com').replace(/\/$/, '');
  const res = await fetch(`${base}/emails`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      ...(m.idempotencyKey ? { 'Idempotency-Key': m.idempotencyKey.slice(0, 256) } : {}),
    },
    body: JSON.stringify({
      from: `${BRAND.name} <${BRAND.sendFrom}>`,
      to: [m.to],
      reply_to: BRAND.email,
      subject: m.subject,
      html: m.html,
      text: m.text,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!res.ok || !json.id) throw new ResendError(json.message ?? `Resend HTTP ${res.status}`, res.status);
  return { id: json.id };
}
