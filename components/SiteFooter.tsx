import Link from 'next/link';
import { BRAND } from '@/lib/config';

type Variant = 'home' | 'pet' | 'legal' | 'minimal';

/** Dark site footer; the 404 page uses the slim light version. */
export function SiteFooter({ variant }: { variant: Variant }) {
  if (variant === 'minimal') {
    return (
      <footer style={{ background: '#FFFFFF', borderTop: '1px solid var(--line)' }}>
        <div className="wrap" style={{ paddingTop: 12, paddingBottom: 12, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0 24px', fontSize: 14, color: 'var(--muted)' }}>
          <span>© {BRAND.copyrightYear} {BRAND.name} · Serving {BRAND.areaLine}</span>
          <span style={{ display: 'flex', gap: 20 }}>
            <Link href="/privacy" className="tap-link" style={{ color: 'var(--muted)' }}>Privacy Policy</Link>
            <Link href="/terms" className="tap-link" style={{ color: 'var(--muted)' }}>Terms</Link>
          </span>
        </div>
      </footer>
    );
  }

  const links: [string, string][] =
    variant === 'legal'
      ? [['/#services', 'Services'], ['/#pricing', 'Pricing'], ['/#faq', 'FAQ'], ['/privacy', 'Privacy Policy'], ['/terms', 'Terms']]
      : [
          [variant === 'home' ? '#services' : '/#services', 'Home Cleaning'],
          [variant === 'pet' ? '#top' : '/pet-waste-removal', 'Pet Waste Removal'],
          ['#pricing', 'Pricing'],
          ['#faq', 'FAQ'],
          ['/privacy', 'Privacy Policy'],
          ['/terms', 'Terms'],
          ['/manage', 'Manage booking'],
        ];

  return (
    <footer className="on-dark" style={{ background: 'var(--ink)', color: 'var(--footer-ink)' }}>
      <div className="wrap" style={{ paddingTop: variant === 'legal' ? 40 : 48, paddingBottom: 24, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: variant === 'legal' ? 24 : 32 }}>
        <div className={variant === 'legal' ? 'footer-id footer-id-tight' : 'footer-id'}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, color: '#FFFFFF' }}>{BRAND.name}</span>
          <span className="small">Serving {BRAND.areaLine}</span>
          <a href={BRAND.phoneHref} className="small footer-contact">{BRAND.phone}</a>
          <a href={`mailto:${BRAND.email}`} className="small footer-contact">{BRAND.email}</a>
        </div>
        <nav aria-label="Footer" className="footer-nav">
          {links.map(([href, label]) =>
            href.startsWith('#') ? (
              <a key={label} href={href}>{label}</a>
            ) : (
              <Link key={label} href={href}>{label}</Link>
            ),
          )}
        </nav>
      </div>
      <div className="wrap small" style={{ paddingBottom: 32, color: 'var(--footer-muted)' }}>
        © {BRAND.copyrightYear} {BRAND.name}. All rights reserved.
      </div>
    </footer>
  );
}
