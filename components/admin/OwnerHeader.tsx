import { BRAND } from '@/lib/config';
import { signOut } from '@/app/admin/actions';

/** Dark owner-dashboard bar from design/Admin.dc.html. Tabs arrive with the dashboard (step 9). */
export function OwnerHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="on-dark" style={{ background: 'var(--ink)', color: '#FFFFFF' }}>
      <div className="wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, minHeight: 60 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span aria-hidden="true" style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 11l8-6.5 8 6.5" />
              <path d="M6 9.5V19h12V9.5" />
            </svg>
          </span>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 17 }}>
            {BRAND.name}
            <span style={{ fontWeight: 600, color: 'var(--footer-muted)' }}> Owner</span>
          </span>
        </div>
        {signedIn && (
          <form action={signOut}>
            <button type="submit" className="ad-tab">Sign out</button>
          </form>
        )}
      </div>
    </header>
  );
}
