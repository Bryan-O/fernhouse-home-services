import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BrandMark } from '@/components/BrandMark';
import { SiteFooter } from '@/components/SiteFooter';
import { Check } from '@/components/Icons';
import { ClearDraft } from './ClearDraft';
import { BRAND } from '@/lib/config';
import { stripeConfigured } from '@/lib/stripe';
import { confirmCheckout, type ConfirmResult } from '@/lib/checkout';

export const metadata: Metadata = { title: 'Booking confirmed', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

// Stripe sends the visitor here after Checkout. The booking is confirmed here too (not only by
// the webhook), so the page never depends on which arrives first.
// TODO (build step 6): the full confirmation design (recurring, one-time + upsell, pet).
export default async function ConfirmedPage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const sessionId = (await searchParams).session_id ?? '';
  if (!stripeConfigured() || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) redirect('/book');

  const r: ConfirmResult = await confirmCheckout(sessionId).catch(() => ({ ok: false as const, reason: 'error' as const }));
  if (!r.ok && r.reason === 'not_paid') redirect('/book?checkout=cancelled');

  return (
    <div style={{ background: 'var(--paper-2)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ background: '#FFFFFF', borderBottom: '1px solid var(--line)' }}>
        <div className="wrap bk-main" style={{ display: 'flex', alignItems: 'center', minHeight: 64 }}>
          <Link href="/" aria-label={`${BRAND.name} home`} className="brand-link"><BrandMark /></Link>
        </div>
      </header>
      <main className="wrap bk-main" style={{ paddingTop: 48, paddingBottom: 64, flex: 1, width: '100%' }}>
        <section className="bk-card step-in" style={{ maxWidth: 560, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 12 }}>
          {r.ok ? (
            <>
              <ClearDraft />
              <span aria-hidden="true" style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Check size={36} width={2.4} stroke="#FFFFFF" />
              </span>
              <h1 className="display" style={{ fontSize: 36, lineHeight: '42px' }}>You’re booked!</h1>
              <p className="body" style={{ margin: 0, color: 'var(--ink-2)' }}>Booking <strong data-ref={r.ref}>{r.ref}</strong> is confirmed.</p>
            </>
          ) : r.reason === 'slot_taken' ? (
            <>
              <ClearDraft />
              <h1 className="display h3">Sorry — that time was booked while you were paying</h1>
              <p className="body" style={{ margin: 0, color: 'var(--ink-2)' }}>We’ve refunded your payment in full. It can take 5–10 days to show on your statement.</p>
              <Link className="btn btn-primary" href="/book">Pick another time</Link>
            </>
          ) : r.reason === 'ended' ? (
            <>
              <ClearDraft />
              <h1 className="display h3">This checkout was replaced</h1>
              <p className="body" style={{ margin: 0, color: 'var(--ink-2)' }}>You changed your booking after starting this payment, so we’ve refunded it in full. Your newer booking is the one that counts.</p>
              <Link className="btn btn-secondary" href="/book">Back to booking</Link>
            </>
          ) : (
            <>
              <h1 className="display h3">We’re confirming your booking</h1>
              <p className="body" style={{ margin: 0, color: 'var(--ink-2)' }}>
                This can take a minute. You’ll get a text as soon as it’s done. Questions? Call <a className="link" href={BRAND.phoneHref}>{BRAND.phone}</a>.
              </p>
            </>
          )}
        </section>
      </main>
      <SiteFooter variant="minimal" />
    </div>
  );
}
