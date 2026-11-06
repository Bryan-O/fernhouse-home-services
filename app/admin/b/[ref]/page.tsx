import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { OwnerFrame } from '@/components/admin/OwnerHeader';
import { requireOwner } from '@/lib/auth';
import { loadAssign } from '@/lib/ops';
import { AssignPicker } from './AssignPicker';
import { NoAccessForm } from '@/components/admin/ProblemForms';
import { CopyLinkButton, OwnerToast } from '@/components/admin/OwnerBits';
import { jobLink } from '@/app/admin/ops-actions';

export const metadata: Metadata = { title: 'Assign a pro', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

// Owner · Assign a pro (design/Admin.dc.html, screen "assign"). /admin/b/04817 is linked from the new-booking text.
export default async function AssignPage({ params, searchParams }: { params: Promise<{ ref: string }>; searchParams: Promise<{ assigned?: string; customer?: string; note?: string }> }) {
  await requireOwner();
  const a = await loadAssign((await params).ref);
  if (!a) notFound();
  const sp = await searchParams;
  return (
    <OwnerFrame current="home">
      {sp.assigned && (
        <OwnerToast text={`${sp.assigned} assigned. They’re texted the job link and ${sp.customer ?? 'the customer'} is told their team is confirmed. Until texts are connected, copy the job link below and send it yourself.${sp.note ? ` ${sp.note}` : ''}`} />
      )}
      <div className="step-in narrow" style={{ margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Link className="linkbtn" href="/admin" style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
          Back to today
        </Link>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="small" style={{ color: 'var(--muted)', fontWeight: 600 }}>{a.ref} · booked {a.bookedAgo}</span>
          <h1 className="display mg-h1">Assign a pro</h1>
        </div>
        <section className="mg-card">
          <dl className="dl">{a.details.map((d) => <div key={d.k} style={{ display: 'contents' }}><dt>{d.k}</dt><dd>{d.v}</dd></div>)}</dl>
        </section>
        {a.assigned ? (
          <section className="mg-card">
            <p className="body" style={{ margin: 0 }}><strong>{a.assigned.pro}</strong> has the next {a.assigned.count === 1 ? 'visit' : `${a.assigned.count} visits`}. Every upcoming visit has a pro.</p>
          </section>
        ) : (
          <AssignPicker planId={a.planId} legend={a.legend} pros={a.pros} customerFirst={a.customerFirst} />
        )}
        {a.jobVisits.length > 0 && (
          <section className="mg-card" aria-labelledby="links-h">
            <h2 id="links-h" className="display h3">Job links</h2>
            <p className="small" style={{ margin: 0, color: 'var(--ink-2)' }}>
              Each visit has its own page for the pro: address, access notes on the day, “on my way” and “mark done”. Texts send these automatically; you can also send one yourself.
            </p>
            <ul className="block-list">
              {a.jobVisits.map((v) => (
                <li key={v.id} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
                  <span style={{ fontWeight: 600 }}>{v.label} <span style={{ fontWeight: 400, color: 'var(--ink-2)' }}>· {v.pro}</span></span>
                  <CopyLinkButton action={jobLink.bind(null, v.id)} label="Copy job link" sentTo={v.pro} />
                </li>
              ))}
            </ul>
          </section>
        )}
        {a.dueVisit && <NoAccessForm visitId={a.dueVisit.id} isPet={a.dueVisit.isPet} label={a.dueVisit.label} />}
      </div>
    </OwnerFrame>
  );
}
