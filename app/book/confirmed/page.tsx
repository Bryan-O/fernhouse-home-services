import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BrandMark } from '@/components/BrandMark';
import { SiteFooter } from '@/components/SiteFooter';
import { Lock, PhoneIcon } from '@/components/Icons';
import { ClearDraft } from './ClearDraft';
import { Confirmed } from './Confirmed';
import { BRAND } from '@/lib/config';
import { stripeConfigured } from '@/lib/stripe';
import { confirmCheckout, loadConfirmation, type ConfirmResult } from '@/lib/checkout';

export const metadata: Metadata = { title: 'Booking confirmed', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

// Stripe sends the visitor here after Checkout. The booking is confirmed here too (not only by
// the webhook), so the page never depends on which arrives first.
export default async function ConfirmedPage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const sessionId = (await searchParams).session_id ?? '';
  if (!stripeConfigured() || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) redirect('/book');

  const r: ConfirmResult = await confirmCheckout(sessionId).catch(() => ({ ok: false as const, reason: 'error' as const }));
  if (!r.ok && r.reason === 'not_paid') redirect('/book?checkout=cancelled');
  const view = r.ok ? await loadConfirmation(r.ref) : null;

  return (
    <div style={{ background: 'var(--paper-2)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ background: '#FFFFFF', borderBottom: '1px solid var(--line)' }}>
        <div className="wrap bk-main" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, minHeight: 64 }}>
          <Link href="/" aria-label={`${BRAND.name} home`} className="brand-link"><BrandMark /></Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span className="small hide-s" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muted)', fontWeight: 600 }}><Lock size={16} />Secure booking</span>
            <a className="btn btn-secondary btn-sm" href={BRAND.phoneHref} aria-label={`Call ${BRAND.phone}`} style={{ padding: '0 14px' }}>
              <PhoneIcon size={18} /><span className="hide-s">{BRAND.phone}</span>
            </a>
          </div>
        </div>
      </header>
      <main className="wrap bk-main" style={{ paddingTop: 32, paddingBottom: 64, flex: 1, width: '100%' }}>
        {view ? (
          <>
            <ClearDraft />
            <Confirmed v={view} sessionId={sessionId} />
          </>
        ) : (
          <section className="bk-card step-in" style={{ maxWidth: 560, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 12 }}>
            {!r.ok && (r.reason === 'slot_taken' || r.reason === 'ended') ? (
              <>
                <ClearDraft />
                <h1 className="display h3">{r.reason === 'slot_taken' ? 'Sorry — that time was booked while you were paying' : 'This checkout was replaced'}</h1>
                <p className="body" style={{ margin: 0, color: 'var(--ink-2)' }}>
                  {r.reason === 'slot_taken'
                    ? 'We’ve refunded your payment in full. It can take 5–10 days to show on your statement.'
                    : 'You changed your booking after starting this payment, so we’ve refunded it in full. Your newer booking is the one that counts.'}
                </p>
                <Link className="btn btn-primary" href="/book">{r.reason === 'slot_taken' ? 'Pick another time' : 'Back to booking'}</Link>
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
        )}
      </main>
      <SiteFooter variant="minimal" />
    </div>
  );
}
