import { BrandMark } from '../BrandMark';
import { PhoneIcon } from '../Icons';
import { BRAND } from '@/lib/config';

/** Header for the pro job page (design/ProJob.dc.html): brand + "Call Fernhouse". */
export function JobChrome({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--paper-2)', minHeight: '100vh' }}>
      <header style={{ background: '#FFFFFF', borderBottom: '1px solid var(--line)' }}>
        <div className="wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 60, maxWidth: 640 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><BrandMark sub="Job" /></span>
          <a className="btn btn-secondary btn-sm" href={BRAND.phoneHref} style={{ padding: '0 14px' }}>
            <PhoneIcon size={18} />Call {BRAND.name}
          </a>
        </div>
      </header>
      <main className="wrap" style={{ paddingTop: 24, paddingBottom: 48, maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {children}
      </main>
    </div>
  );
}
