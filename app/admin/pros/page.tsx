import type { Metadata } from 'next';
import Link from 'next/link';
import { OwnerFrame } from '@/components/admin/OwnerHeader';
import { requireOwner } from '@/lib/auth';
import { loadPros } from '@/lib/ops';

export const metadata: Metadata = { title: 'Pros', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

// Owner · Pros & documents (design/Admin.dc.html, screen "pros").
export default async function ProsPage() {
  await requireOwner();
  const pros = await loadPros();
  return (
    <OwnerFrame current="pros">
      <div className="step-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
          <h1 className="display mg-h1">Pros</h1>
          <Link className="btn btn-primary btn-sm" href="/admin/pros/new">Add a pro</Link>
        </div>
        <section className="mg-card">
          {pros.length ? (
            <div className="tbl-wrap">
              <table className="tbl stack">
                <thead><tr><th scope="col">Pro</th><th scope="col">Services</th><th scope="col">Areas</th><th scope="col">Insurance</th><th scope="col">Bond</th><th scope="col">Background check</th></tr></thead>
                <tbody>
                  {pros.map((p) => (
                    <tr key={p.id}>
                      <td data-l="Pro"><Link className="link" href={`/admin/pros/${p.id}`} style={{ color: 'var(--ink)' }}>{p.name}</Link>{!p.active && <span className="small" style={{ color: 'var(--muted)' }}> · inactive</span>}</td>
                      <td data-l="Services">{p.services}</td>
                      <td data-l="Areas">{p.areas}</td>
                      <td data-l="Insurance"><span className={`pill pill-${p.docs.insurance.tone}`}>{p.docs.insurance.label}</span></td>
                      <td data-l="Bond"><span className={`pill pill-${p.docs.bond.tone}`}>{p.docs.bond.label}</span></td>
                      <td data-l="Background check"><span className={`pill pill-${p.docs.background_check.tone}`}>{p.docs.background_check.label}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="body" style={{ margin: 0, color: 'var(--ink-2)' }}>No pros yet. Add your first one to start assigning visits.</p>}
          <p className="small" style={{ margin: 0, color: 'var(--muted)' }}>A pro with any missing, unverified or expired document can’t be assigned. Pros’ names are never shown to customers.</p>
        </section>
      </div>
    </OwnerFrame>
  );
}
