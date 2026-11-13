import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { OwnerFrame } from '@/components/admin/OwnerHeader';
import { requireOwner } from '@/lib/auth';
import { loadPro, loadProPay } from '@/lib/ops';
import { PRO_PAY } from '@/lib/config';
import { ProForm } from './ProForm';
import { ProDocs } from './ProDocs';

export const metadata: Metadata = { title: 'Pro', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

// Add a pro (/admin/pros/new) or edit one, with their documents.
export default async function ProPage({ params }: { params: Promise<{ id: string }> }) {
  await requireOwner();
  const { id } = await params;
  const pro = id === 'new' ? null : await loadPro(id);
  if (id !== 'new' && !pro) notFound();
  const pay = pro ? await loadProPay(pro.id) : [];
  return (
    <OwnerFrame current="pros">
      <div className="step-in narrow" style={{ margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Link className="linkbtn" href="/admin/pros" style={{ alignSelf: 'flex-start' }}>Back to pros</Link>
        <h1 className="display mg-h1">{pro ? pro.name : 'Add a pro'}</h1>
        <ProForm pro={pro} />
        {pro && <ProDocs pro={pro} />}
        {pro && (
          <section className="mg-card" aria-labelledby="pay-h">
            <h2 id="pay-h" className="display h3">Pay</h2>
            <p className="small" style={{ margin: 0, color: 'var(--ink-2)' }}>
              {PRO_PAY.pctOfVisit}% of each completed visit’s full price. The first-clean discount comes out of Fernhouse’s share, not theirs.
            </p>
            {pay.map((w) => (
              <div key={w.label} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="sec-head">
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{w.label}</h3>
                  <span style={{ fontWeight: 600 }}>{w.total}</span>
                </div>
                {w.visits.length ? (
                  <ul className="block-list">
                    {w.visits.map((v) => (
                      <li key={v.id}>
                        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                          <span style={{ fontWeight: 600 }}>{v.when}</span>
                          <span className="small" style={{ color: 'var(--ink-2)', overflowWrap: 'anywhere' }}>{v.what}</span>
                        </span>
                        <span style={{ fontWeight: 600 }}>{v.pay}</span>
                      </li>
                    ))}
                  </ul>
                ) : <p className="small" style={{ margin: 0, color: 'var(--muted)' }}>No completed visits.</p>}
              </div>
            ))}
          </section>
        )}
      </div>
    </OwnerFrame>
  );
}
