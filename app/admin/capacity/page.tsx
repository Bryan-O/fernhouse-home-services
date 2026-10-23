import type { Metadata } from 'next';
import { OwnerFrame } from '@/components/admin/OwnerHeader';
import { requireOwner } from '@/lib/auth';
import { loadCapacity } from '@/lib/ops';
import { CapacityEditor } from './CapacityEditor';

export const metadata: Metadata = { title: 'Booking capacity', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

// Owner · Capacity (design/Admin.dc.html, screen "capacity"). These numbers feed the booking page's Full days.
export default async function CapacityPage() {
  await requireOwner();
  const cap = await loadCapacity();
  return (
    <OwnerFrame current="capacity">
      <div className="step-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h1 className="display mg-h1">Booking capacity</h1>
          <p className="body" style={{ margin: 0, color: 'var(--ink-2)', maxWidth: 640 }}>How many visits the booking page can take. When a slot fills, customers see that date as Full. Raise the numbers as you add pros.</p>
        </div>
        <CapacityEditor cap={cap} />
      </div>
    </OwnerFrame>
  );
}
