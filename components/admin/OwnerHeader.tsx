import Link from 'next/link';
import { BrandMark } from '../BrandMark';
import { signOut } from '@/app/admin/actions';

export type OwnerTab = 'home' | 'capacity' | 'pros';
const TABS: { id: OwnerTab; label: string; href: string }[] = [
  { id: 'home', label: 'Today', href: '/admin' },
  { id: 'capacity', label: 'Capacity', href: '/admin/capacity' },
  { id: 'pros', label: 'Pros', href: '/admin/pros' },
];

/** Dark owner-dashboard bar from design/Admin.dc.html, with the Today / Capacity / Pros tabs. */
export function OwnerHeader({ signedIn, current }: { signedIn: boolean; current?: OwnerTab }) {
  return (
    <header className="on-dark" style={{ background: 'var(--ink)', color: '#FFFFFF' }}>
      <div className="wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, minHeight: 60 }}>
        <div className="ad-brand" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <BrandMark light sub="Owner" />
        </div>
        {signedIn && (
          <nav className="ad-nav" aria-label="Owner">
            {TABS.map((t) => (
              <Link key={t.id} href={t.href} className="ad-tab" aria-current={current === t.id ? 'page' : undefined} style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>{t.label}</Link>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}

/** Page frame for every owner page; sign-out sits at the foot of the page. */
export function OwnerFrame({ current, children }: { current?: OwnerTab; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--paper-2)', minHeight: '100vh' }}>
      <OwnerHeader signedIn current={current} />
      <main className="wrap" style={{ paddingTop: 28, paddingBottom: 56 }}>
        {children}
        <form action={signOut} style={{ marginTop: 40, display: 'flex', justifyContent: 'center' }}>
          <button type="submit" className="linkbtn" style={{ color: 'var(--muted)' }}>Sign out</button>
        </form>
      </main>
    </div>
  );
}
