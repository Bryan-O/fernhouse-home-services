import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { OwnerFrame } from '@/components/admin/OwnerHeader';
import { requireOwner } from '@/lib/auth';
import { loadAssign } from '@/lib/ops';
import { AssignPicker } from './AssignPicker';

export const metadata: Metadata = { title: 'Assign a pro', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

// Owner · Assign a pro (design/Admin.dc.html, screen "assign"). /admin/b/04817 is linked from the new-booking text.
export default async function AssignPage({ params }: { params: Promise<{ ref: string }> }) {
  await requireOwner();
  const a = await loadAssign((await params).ref);
  if (!a) notFound();
  return (
    <OwnerFrame current="home">
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
      </div>
    </OwnerFrame>
  );
}
