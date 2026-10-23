import type { Metadata } from 'next';
import Link from 'next/link';
import { OwnerFrame } from '@/components/admin/OwnerHeader';
import { ActionButton, OwnerToast } from '@/components/admin/OwnerBits';
import { WeatherMove } from '@/components/admin/ProblemForms';
import { requireOwner } from '@/lib/auth';
import { loadToday } from '@/lib/ops';
import { markQuoted, retryCharge } from './ops-actions';
import { BRAND } from '@/lib/config';

export const metadata: Metadata = { title: 'Owner dashboard', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const KPI_CLASS = { warn: 'kpi kpi-warn', bad: 'kpi kpi-bad' } as const;

// Owner · Today (design/Admin.dc.html, screen "home").
export default async function AdminPage({ searchParams }: { searchParams: Promise<{ assigned?: string; customer?: string; note?: string }> }) {
  await requireOwner();
  const t = await loadToday();
  const sp = await searchParams;
  const toast = sp.assigned
    ? `${sp.assigned} assigned. They got the job link, and ${sp.customer ?? 'the customer'} got “Your team is confirmed.”${sp.note ? ` ${sp.note}` : ''}`
    : '';

  return (
    <OwnerFrame current="home">
      {toast && <OwnerToast text={toast} />}
      <div className="step-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="small" style={{ color: 'var(--muted)', fontWeight: 600 }}>{t.dateLabel}</span>
            <h1 className="display mg-h1">{t.greeting}</h1>
          </div>
          <span className="small" style={{ color: 'var(--ink-2)' }}>New bookings also text {BRAND.phone} and email you.</span>
        </div>

        <ul className="kpis" aria-label="Needs attention">
          {t.kpis.map((k) => (
            <li key={k.label} className={k.tone ? KPI_CLASS[k.tone] : 'kpi'}>
              <span className="display" style={{ fontSize: 28, lineHeight: '32px' }}>{k.n}</span>
              <span className="small" style={{ fontWeight: 600 }}>{k.label}</span>
            </li>
          ))}
        </ul>

        <div className="mg-grid">
          <div className="mg-col">
            <section className="mg-card" aria-labelledby="need-h">
              <div className="sec-head"><h2 className="display h3" id="need-h">Needs a pro</h2><span className="small" style={{ color: 'var(--muted)' }}>Assign within 24 hours of booking</span></div>
              {t.unassigned.length ? (
                <ul className="row-list">
                  {t.unassigned.map((u) => (
                    <li key={u.ref} className="row-card">
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                        <span style={{ fontWeight: 600 }}>{u.what}</span>
                        <span className="small" style={{ color: 'var(--ink-2)' }}>{u.when} · {u.area}</span>
                        <span className="small" style={{ color: 'var(--muted)' }}>Booked {u.ago} · {u.price}</span>
                      </div>
                      <Link className="btn btn-primary btn-sm" href={`/admin/b/${u.ref}`}>Assign</Link>
                    </li>
                  ))}
                </ul>
              ) : <p className="small" style={{ margin: 0, color: 'var(--muted)' }}>Every booking has a pro.</p>}
            </section>

            <section className="mg-card" aria-labelledby="today-h">
              <h2 className="display h3" id="today-h">Today’s visits</h2>
              {t.today.length ? (
                <div className="tbl-wrap">
                  <table className="tbl stack">
                    <thead><tr><th scope="col">When</th><th scope="col">Service</th><th scope="col">Area</th><th scope="col">Pro</th><th scope="col">Status</th></tr></thead>
                    <tbody>
                      {t.today.map((v, i) => (
                        <tr key={i}>
                          <td data-l="When" style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{v.when}</td>
                          <td data-l="Service">{v.svc}{v.note && <span className="small" style={{ display: 'block', color: 'var(--muted)' }}>Pro note: {v.note}</span>}</td>
                          <td data-l="Area">{v.area}</td>
                          <td data-l="Pro">{v.pro}</td>
                          <td data-l="Status"><span className={`pill pill-${v.tone}`}>{v.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="small" style={{ margin: 0, color: 'var(--muted)' }}>No visits today.</p>}
              {t.openYardsToday > 0 && <WeatherMove count={t.openYardsToday} />}
            </section>
          </div>

          <div className="mg-col">
            <section className="mg-card" aria-labelledby="pay-h">
              <h2 className="display h3" id="pay-h">Failed payments</h2>
              {t.failed.length ? t.failed.map((f) => (
                <div key={f.paymentId} className="row-card" style={{ alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontWeight: 600 }}>{f.title}</span>
                    <span className="small" style={{ color: 'var(--ink-2)' }}>{f.what}</span>
                    <span className="small" style={{ color: 'var(--muted)' }}>{f.sub}</span>
                  </div>
                  <ActionButton action={retryCharge.bind(null, f.paymentId)} label="Retry" />
                </div>
              )) : <p className="small" style={{ margin: 0, color: 'var(--muted)' }}>None.</p>}
            </section>

            <section className="mg-card" aria-labelledby="quote-h">
              <h2 className="display h3" id="quote-h">Quote requests</h2>
              {t.quotes.length ? t.quotes.map((q) => (
                <div key={q.id} className="row-card">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontWeight: 600 }}>{q.what}</span>
                    <span className="small" style={{ color: 'var(--ink-2)' }}>{q.phone} · {q.ago}</span>
                    <ActionButton action={markQuoted.bind(null, q.id)} label="Mark as quoted" className="linkbtn" />
                  </div>
                  <a className="btn btn-secondary btn-sm" href={q.smsHref}>Text quote</a>
                </div>
              )) : <p className="small" style={{ margin: 0, color: 'var(--muted)' }}>None waiting.</p>}
            </section>

            <section className="mg-card" aria-labelledby="docs-h">
              <h2 className="display h3" id="docs-h">Pro documents</h2>
              {t.docs.length ? t.docs.map((d, i) => (
                <div key={i} className={`row-card${d.warn ? ' row-card-warn' : ''}`}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontWeight: 600 }}>{d.title}</span>
                    <span className="small" style={{ color: 'var(--ink-2)' }}>{d.sub}</span>
                  </div>
                  {!d.warn && <Link className="btn btn-secondary btn-sm" href={`/admin/pros/${d.proId}`}>Review</Link>}
                </div>
              )) : <p className="small" style={{ margin: 0, color: 'var(--muted)' }}>Everything is checked and in date.</p>}
            </section>

            <section className="mg-card" aria-labelledby="wait-h" style={{ gap: 10 }}>
              <h2 className="display h3" id="wait-h">Waitlist</h2>
              <p className="small" style={{ margin: 0, color: 'var(--ink-2)' }}>
                {t.waitlist.people ? `${t.waitlist.people} ${t.waitlist.people === 1 ? 'person' : 'people'} outside the area · most asked: ${t.waitlist.top}.` : 'Nobody yet.'}
              </p>
            </section>
          </div>
        </div>
      </div>
    </OwnerFrame>
  );
}
