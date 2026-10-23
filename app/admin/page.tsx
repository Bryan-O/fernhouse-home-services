import type { Metadata } from 'next';
import { OwnerHeader } from '@/components/admin/OwnerHeader';
import { requireOwner } from '@/lib/auth';

export const metadata: Metadata = { title: 'Owner dashboard', robots: { index: false, follow: false } };

// The Today / Assign / Capacity / Pros dashboard is build step 9; this proves the lock works.
export default async function AdminPage() {
  const owner = await requireOwner();
  return (
    <div style={{ background: 'var(--paper-2)', minHeight: '100vh' }}>
      <OwnerHeader signedIn />
      <main className="wrap" style={{ paddingTop: 28, paddingBottom: 56 }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h1 className="display" style={{ fontSize: 28, lineHeight: '34px' }}>You’re signed in</h1>
          <p className="body" style={{ margin: 0, color: 'var(--ink-2)' }}>
            Signed in as <strong>{owner.email}</strong>. The dashboard (Today, Assign, Capacity, Pros) is added in build step 9.
          </p>
        </div>
      </main>
    </div>
  );
}
