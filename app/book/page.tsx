import type { Metadata } from 'next';
import Link from 'next/link';
import { BrandMark } from '@/components/BrandMark';
import { Lock, PhoneIcon } from '@/components/Icons';
import { BookingFlow } from '@/components/book/BookingFlow';
import { SiteFooter } from '@/components/SiteFooter';
import { BRAND } from '@/lib/config';

export const metadata: Metadata = {
  title: 'Book online',
  description: `Book house cleaning or pet waste removal with ${BRAND.name} in ${BRAND.areaLine}.`,
  robots: { index: false, follow: true },
};

/** Checkout header: no navigation, so nothing pulls the visitor out of the flow. */
export default function BookPage() {
  return (
    <div style={{ background: 'var(--paper-2)', minHeight: '100vh' }}>
      <header style={{ background: '#FFFFFF', borderBottom: '1px solid var(--line)' }}>
        <div className="wrap bk-main" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, minHeight: 64 }}>
          <Link href="/" aria-label={`${BRAND.name} home`} className="brand-link">
            <BrandMark />
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span className="small hide-s" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muted)', fontWeight: 600 }}>
              <Lock size={16} />Secure booking
            </span>
            <a className="btn btn-secondary btn-sm" href={BRAND.phoneHref} aria-label={`Call ${BRAND.phone}`} style={{ padding: '0 14px' }}>
              <PhoneIcon size={18} />
              <span className="hide-s">{BRAND.phone}</span>
            </a>
          </div>
        </div>
      </header>
      <main className="wrap bk-main" style={{ paddingTop: 32, paddingBottom: 64 }}>
        <BookingFlow />
      </main>
      <SiteFooter variant="minimal" />
    </div>
  );
}
