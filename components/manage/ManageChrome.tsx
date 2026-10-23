import Link from 'next/link';
import { BrandMark } from '../BrandMark';
import { PhoneIcon } from '../Icons';
import { BRAND } from '@/lib/config';

/** Header and footer for /manage and /b/[token] (design/ManageBooking.dc.html). */
export function ManageChrome({ children }: { children: React.ReactNode }) {
  const sms = BRAND.phoneHref.replace('tel:', 'sms:');
  return (
    <div style={{ background: 'var(--paper-2)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ background: '#FFFFFF', borderBottom: '1px solid var(--line)' }}>
        <div className="wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, minHeight: 68 }}>
          <Link href="/" aria-label={`${BRAND.name} home`} className="brand-link"><BrandMark /></Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <a className="btn btn-secondary btn-sm" href={sms} aria-label={`Text us at ${BRAND.phone}`} style={{ padding: '0 14px' }}>
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h16v11H9l-5 4z" /></svg>
              <span className="call-label">Text us</span>
            </a>
            <a className="btn btn-secondary btn-sm" href={BRAND.phoneHref} aria-label={`Call ${BRAND.phone}`} style={{ padding: '0 14px' }}>
              <PhoneIcon size={18} />
              <span className="call-label">{BRAND.phone}</span>
            </a>
          </div>
        </div>
      </header>
      <main className="wrap" style={{ paddingTop: 40, paddingBottom: 64, flex: 1, width: '100%' }}>{children}</main>
      <footer className="on-dark mg-footer" style={{ background: 'var(--ink)', color: 'var(--footer-ink)' }}>
        <div className="wrap" style={{ paddingTop: 24, paddingBottom: 24, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, fontSize: 14 }}>
          <span>© {BRAND.copyrightYear} {BRAND.name} · Serving {BRAND.areaLine}</span>
          <span style={{ display: 'flex', gap: 20 }}><Link href="/privacy">Privacy Policy</Link><Link href="/terms">Terms</Link></span>
        </div>
      </footer>
    </div>
  );
}
