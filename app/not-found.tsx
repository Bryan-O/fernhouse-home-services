import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { ChevronRight, PhoneIcon } from '@/components/Icons';
import { BRAND } from '@/lib/config';

export const metadata: Metadata = { title: 'Page not found' };

export default function NotFound() {
  const arrow = <ChevronRight size={18} stroke="var(--accent)" />;
  return (
    <div className="page" style={{ background: 'var(--paper-2)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <SiteHeader variant="minimal" />
      <main className="wrap nf-main" style={{ flex: 1, width: '100%' }}>
        <div className="nf-grid">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
            <span className="nf-tag">Error 404</span>
            <h1 className="display nf-title">We couldn’t find that page.</h1>
            <p style={{ margin: 0, fontSize: 17, lineHeight: '27px', color: 'var(--ink-2)', maxWidth: '52ch' }}>
              The link may be old or mistyped. Everything you need is still a tap away — and booking a clean takes about 60 seconds.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <Link className="btn btn-primary btn-block-m" href="/#booking">Book a clean</Link>
              <Link className="btn btn-secondary btn-block-m" href="/">Go to the home page</Link>
            </div>
            <nav aria-label="Popular pages" style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--muted)' }}>Or jump to</span>
              <div className="ql-grid">
                <Link className="ql" href="/#services">Services{arrow}</Link>
                <Link className="ql" href="/#pricing">Pricing{arrow}</Link>
                <Link className="ql" href="/#faq">Questions{arrow}</Link>
                <a className="ql" href={BRAND.phoneHref}>Call {BRAND.phone}<PhoneIcon size={18} stroke="var(--accent)" /></a>
              </div>
            </nav>
          </div>

          <div className="nf-art" aria-hidden="true">
            <svg viewBox="0 0 320 280" width="100%" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="160" cy="150" r="118" fill="#E3F2EC" />
              <path d="M78 150l82-64 82 64" stroke="#16211F" strokeWidth="6" />
              <path d="M98 136v86h124v-86" stroke="#16211F" strokeWidth="6" />
              <rect x="142" y="170" width="36" height="52" rx="4" stroke="#16211F" strokeWidth="6" />
              <path d="M160 104l5 13 13 5-13 5-5 13-5-13-13-5 13-5z" fill="#C99A2C" stroke="#C99A2C" strokeWidth="2" />
              <path d="M232 64l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" fill="#0E7A5F" stroke="#0E7A5F" strokeWidth="2" />
              <path d="M70 92l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5z" fill="#0E7A5F" stroke="#0E7A5F" strokeWidth="2" />
              <path d="M40 238h240" stroke="#16211F" strokeWidth="6" />
            </svg>
          </div>
        </div>
      </main>
      <SiteFooter variant="minimal" />
    </div>
  );
}
