import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { OwnerFrame } from '@/components/admin/OwnerHeader';
import { requireOwner } from '@/lib/auth';
import { loadPro } from '@/lib/ops';
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
  return (
    <OwnerFrame current="pros">
      <div className="step-in narrow" style={{ margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Link className="linkbtn" href="/admin/pros" style={{ alignSelf: 'flex-start' }}>Back to pros</Link>
        <h1 className="display mg-h1">{pro ? pro.name : 'Add a pro'}</h1>
        <ProForm pro={pro} />
        {pro && <ProDocs pro={pro} />}
      </div>
    </OwnerFrame>
  );
}
