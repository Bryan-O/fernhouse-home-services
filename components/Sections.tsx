import { BRAND, SERVICE_AREAS } from '@/lib/config';
import { Lock, Pin, Redo, Shield, Team } from './Icons';

/** The four promises under the hero. */
export function TrustStrip({ guarantee }: { guarantee: string }) {
  const items: [React.ReactNode, string][] = [
    [<Shield key="s" stroke="var(--accent)" style={{ flex: 'none' }} />, 'Vetted, bonded & insured'],
    [<Team key="t" stroke="var(--accent)" style={{ flex: 'none' }} />, 'Backup team, never cancelled'],
    [<Redo key="r" stroke="var(--gold)" style={{ flex: 'none' }} />, guarantee],
    [<Lock key="l" stroke="var(--accent)" style={{ flex: 'none' }} />, 'Secure online payment'],
  ];
  return (
    <section aria-label="Our promises" style={{ background: '#FFFFFF', borderBottom: '1px solid var(--line)' }}>
      <ul className="wrap grid-4 trust">
        {items.map(([icon, label]) => (
          <li key={label}>{icon}{label}</li>
        ))}
      </ul>
    </section>
  );
}

export function ServiceAreas({ id, note }: { id?: string; note?: boolean }) {
  return (
    <section id={id} aria-label="Service areas" style={{ background: 'var(--paper-2)' }}>
      <div className="wrap sec" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <h2 className="display h2">Serving {BRAND.areaLine}</h2>
        <ul className="area-list">
          {SERVICE_AREAS.map((a) => (
            <li key={a} className="area"><Pin size={16} stroke="var(--accent)" />{a}</li>
          ))}
          <li className="area area-more">+ surrounding suburbs</li>
        </ul>
        {note && (
          <p className="body" style={{ margin: 0, color: 'var(--ink-2)' }}>
            Don’t see your area? Call <a className="link link-plain" href={BRAND.phoneHref}>{BRAND.phone}</a> — we’re expanding across metro Atlanta.
          </p>
        )}
      </div>
    </section>
  );
}

export function FinalCta({ label, title, line, cta }: { label: string; title: string; line: string; cta: string }) {
  return (
    <section className="on-accent" aria-label={label} style={{ background: 'var(--accent)', color: '#FFFFFF' }}>
      <div className="wrap sec" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
        <div style={{ flex: '1 1 420px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h2 className="display h2" style={{ color: '#FFFFFF' }}>{title}</h2>
          <p className="body" style={{ margin: 0, color: '#FFFFFF' }}>{line}</p>
        </div>
        <a className="btn btn-white btn-block-m" href="#booking">{cta}</a>
      </div>
    </section>
  );
}

/** Feature card used in the "Why book with Fernhouse" grids. */
export function WhyCard({ icon, gold, title, children, filled }: { icon: React.ReactNode; gold?: boolean; title: string; children: React.ReactNode; filled?: boolean }) {
  return (
    <div className="why-card" style={filled ? { background: '#FFFFFF' } : undefined}>
      <span aria-hidden="true" className={gold ? 'icon-tile icon-tile-gold' : 'icon-tile'}>{icon}</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <h3 className="display h3">{title}</h3>
        <p className="body" style={{ margin: 0, color: 'var(--ink-2)' }}>{children}</p>
      </div>
    </div>
  );
}

export function HowSteps({ steps }: { steps: { icon?: React.ReactNode; title: string; body: string }[] }) {
  return (
    <section id="how" aria-label="How it works" style={{ background: '#FFFFFF' }}>
      <div className="wrap sec" style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        <h2 className="display h2">How it works</h2>
        <ol className="grid-3" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {steps.map((s, i) => (
            <li key={s.title} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="display step-num">{i + 1}</span>
                {s.icon}
              </div>
              <h3 className="display h3">{s.title}</h3>
              <p className="body" style={{ margin: 0, color: 'var(--ink-2)' }}>{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
