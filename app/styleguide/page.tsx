import type { Metadata } from 'next';
import { BrandMark } from '@/components/BrandMark';
import {
  ARRIVAL_WINDOWS,
  BOOKING,
  BRAND,
  CANCELLATION_POLICY,
  CAPACITY_DEFAULTS,
  firstCleanTotal,
  OFFER,
  PET_FREQS,
  PET_WASTE_PRICING,
  petVisit,
  POLICIES,
  PRICING,
  ROUTE_DAYS,
  SERVICE_AREAS,
  SERVICE_ZIPS,
  standardFor,
  YARD_CONDITIONS,
} from '@/lib/config';

// Internal build-step page: the design tokens, shared components and config values.
export const metadata: Metadata = { title: 'Style guide', robots: { index: false, follow: false } };

const SWATCHES = [
  ['--ink', 'Ink'], ['--ink-2', 'Ink 2'], ['--muted', 'Muted'], ['--line', 'Line'],
  ['--paper', 'Paper'], ['--paper-2', 'Paper 2'], ['--accent', 'Accent'], ['--accent-soft', 'Accent soft'],
  ['--gold', 'Gold'], ['--error', 'Error'], ['--warning', 'Warning'], ['--note', 'Note'],
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 className="display h3">{title}</h2>
      {children}
    </section>
  );
}

export default function StyleGuide() {
  const zipCount = Object.keys(SERVICE_ZIPS).length;
  return (
    <div style={{ background: 'var(--paper-2)', minHeight: '100vh' }}>
      <header style={{ background: '#FFFFFF', borderBottom: '1px solid var(--line)' }}>
        <div className="wrap" style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 68 }}>
          <BrandMark />
          <span className="small" style={{ marginLeft: 'auto', color: 'var(--muted)', fontWeight: 600 }}>Build step 1 · style guide</span>
        </div>
      </header>

      <main className="wrap sec" style={{ display: 'flex', flexDirection: 'column', gap: 48 }}>
        <Section title="Colour tokens">
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
            {SWATCHES.map(([v, label]) => (
              <li key={v} className="card" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ height: 48, borderRadius: 8, background: `var(${v})`, border: '1px solid var(--line)' }} />
                <span className="small" style={{ fontWeight: 600 }}>{label}</span>
                <code className="small" style={{ color: 'var(--muted)' }}>{v}</code>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Type">
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p className="display h1">Display H1 · 40/48</p>
            <p className="display h2">Display H2 · 30/36</p>
            <p className="display h3">Display H3 · 22/28</p>
            <p className="body" style={{ margin: 0, color: 'var(--ink-2)' }}>Body · Inter 17/27. Phone layouts drop H1 to 32/38.</p>
            <p className="small" style={{ margin: 0, color: 'var(--muted)' }}>Small · Inter 14/21</p>
          </div>
        </Section>

        <Section title="Buttons">
          <div className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            <button type="button" className="btn btn-primary">Primary</button>
            <button type="button" className="btn btn-secondary">Secondary</button>
            <button type="button" className="btn btn-primary btn-sm">Small</button>
            <button type="button" className="btn btn-danger btn-sm">Danger</button>
            <button type="button" className="btn btn-primary" disabled>Disabled</button>
            <button type="button" className="btn btn-primary btn-busy" disabled><span className="spinner" aria-hidden="true" />Busy</button>
            <button type="button" className="linkbtn">Link button</button>
            <div className="on-accent" style={{ background: 'var(--accent)', padding: 12, borderRadius: 16 }}>
              <button type="button" className="btn btn-white">White on accent</button>
            </div>
          </div>
        </Section>

        <Section title="Options, stepper, switch">
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 520 }}>
            <div className="seg2" role="group" aria-label="Example service switch">
              <button type="button" className="opt" aria-pressed="true">Home Cleaning</button>
              <button type="button" className="opt" aria-pressed="false">Pet Waste</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
              <button type="button" className="opt" aria-pressed="false" style={{ minHeight: 64 }}>Default</button>
              <button type="button" className="opt" aria-pressed="true" style={{ minHeight: 64 }}>Selected</button>
              <button type="button" className="opt" disabled style={{ minHeight: 64 }}>Full</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ flex: '0 1 200px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1.5px solid var(--line)', borderRadius: 12, padding: 4, minHeight: 52 }}>
                <button type="button" className="stepper-btn" aria-label="Fewer" disabled>−</button>
                <output style={{ fontSize: 18, fontWeight: 600 }}>1</output>
                <button type="button" className="stepper-btn" aria-label="More">+</button>
              </div>
              <button type="button" className="switch" role="switch" aria-checked="true" aria-label="Example switch" />
            </div>
          </div>
        </Section>

        <Section title="Fields">
          <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            <div className="field">
              <label className="label" htmlFor="sg-a">Default</label>
              <input id="sg-a" className="input" placeholder="(404) 555-0123" />
              <p className="help">Help text</p>
            </div>
            <div className="field">
              <label className="label" htmlFor="sg-b">Valid</label>
              <input id="sg-b" className="input ok" defaultValue="30062" />
              <p className="help-ok">Marietta — we serve your area</p>
            </div>
            <div className="field">
              <label className="label" htmlFor="sg-c">Error</label>
              <input id="sg-c" className="input" aria-invalid="true" aria-describedby="sg-c-err" />
              <p className="err" id="sg-c-err">Enter a 10-digit mobile number</p>
            </div>
            <div className="field">
              <label className="label" htmlFor="sg-d">Disabled <span className="opt-tag">(optional)</span></label>
              <input id="sg-d" className="input" disabled />
            </div>
          </div>
        </Section>

        <Section title="Pills and notices">
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <span className="pill pill-ok">Available</span>
              <span className="pill pill-warn">Expires soon</span>
              <span className="pill pill-bad">Can’t assign</span>
              <span className="pill pill-neutral">Off that day</span>
            </div>
            <div className="notice small">Notice panel (custom quote, 5+ dogs, yard over ½ acre).</div>
            <div className="skel" style={{ height: 20, width: '60%' }} />
          </div>
        </Section>

        <Section title={`Home cleaning prices (lib/config.ts) · first clean ${OFFER.firstCleanPct}% off`}>
          <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15 }}>
              <thead>
                <tr style={{ background: 'var(--paper-2)', textAlign: 'left' }}>
                  {['Home', 'Biweekly', 'Weekly', 'One-time', 'Deep', 'Move-In/Out', 'First biweekly clean'].map((h) => (
                    <th key={h} scope="col" style={{ padding: '12px 16px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PRICING.rows.map((r) => (
                  <tr key={`${r.bd}-${r.ba}`} style={{ borderTop: '1px solid var(--line)' }}>
                    <th scope="row" style={{ padding: '12px 16px', textAlign: 'left' }}>{r.bd} bd / {r.ba} ba{r.popular ? ' ★' : ''}</th>
                    <td style={{ padding: '12px 16px' }}>${r.standard}</td>
                    <td style={{ padding: '12px 16px' }}>${standardFor(r, 'weekly')}</td>
                    <td style={{ padding: '12px 16px' }}>${standardFor(r, 'oneTime')}</td>
                    <td style={{ padding: '12px 16px' }}>${r.deep}</td>
                    <td style={{ padding: '12px 16px' }}>${r.move}</td>
                    <td style={{ padding: '12px 16px' }}>${firstCleanTotal(r.standard)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small" style={{ margin: 0, color: 'var(--muted)' }}>
            Over {PRICING.maxBeds} beds or {PRICING.maxBaths} baths → custom quote.
          </p>
        </Section>

        <Section title="Pet waste prices (lib/config.ts)">
          <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15 }}>
              <thead>
                <tr style={{ background: 'var(--paper-2)', textAlign: 'left' }}>
                  <th scope="col" style={{ padding: '12px 16px' }}>Dogs</th>
                  {PET_FREQS.map((f) => <th key={f.id} scope="col" style={{ padding: '12px 16px' }}>{f.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: PET_WASTE_PRICING.maxDogs }, (_, i) => i + 1).map((d) => (
                  <tr key={d} style={{ borderTop: '1px solid var(--line)' }}>
                    <th scope="row" style={{ padding: '12px 16px', textAlign: 'left' }}>{d}</th>
                    {PET_FREQS.map((f) => <td key={f.id} style={{ padding: '12px 16px' }}>${petVisit(f.id, d)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small" style={{ margin: 0, color: 'var(--muted)' }}>
            Initial cleanup: {YARD_CONDITIONS.map((c) => c.lower).join(' / ')} → $0 / ${PET_WASTE_PRICING.initialCleanupWithWeekly} (weekly, twice weekly) or ${PET_WASTE_PRICING.initialCleanup} / ${PET_WASTE_PRICING.initialCleanup}.
            Add-ons: deodorizer +${PET_WASTE_PRICING.addOns.deodorizer}/visit, sanitizing +${PET_WASTE_PRICING.addOns.sanitizing}.
            {' '}{PET_WASTE_PRICING.maxDogs + 1}+ dogs or over ½ acre → quote.
          </p>
        </Section>

        <Section title="Policies, schedule and area">
          <div className="card">
            <dl className="dl">
              <dt>Contact</dt><dd>{BRAND.phone} · {BRAND.email}</dd>
              <dt>Cancellation</dt><dd>{CANCELLATION_POLICY}</dd>
              <dt>Guarantee</dt><dd>Re-clean or re-scoop if reported within {POLICIES.guaranteeWindow}</dd>
              <dt>Arrival windows</dt><dd>{ARRIVAL_WINDOWS.map((w) => w.time).join(' · ')}</dd>
              <dt>Route days</dt><dd>{ROUTE_DAYS.map((d) => d.full).join(', ')}</dd>
              <dt>Slot hold</dt><dd>{BOOKING.holdMinutes} minutes · book up to {BOOKING.windowDays} days ahead</dd>
              <dt>Capacity</dt>
              <dd>
                {CAPACITY_DEFAULTS.cleaningPerWindow.map((w, i) => `${DAY_NAMES[i]} ${w.join('/')}`).join(' · ')}
                <br />
                Yards: {Object.entries(CAPACITY_DEFAULTS.yardsPerRouteDay).map(([d, n]) => `${d} ${n}`).join(' · ')}
              </dd>
              <dt>Service area</dt><dd>{SERVICE_AREAS.join(', ')} · {zipCount} ZIP codes</dd>
            </dl>
          </div>
        </Section>
      </main>
    </div>
  );
}
