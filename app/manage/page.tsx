import type { Metadata } from 'next';
import { ManageChrome } from '@/components/manage/ManageChrome';
import { FindForm } from './FindForm';

export const metadata: Metadata = { title: 'Manage your booking', robots: { index: false, follow: true } };

export default async function ManagePage({ searchParams }: { searchParams: Promise<{ expired?: string }> }) {
  const expired = (await searchParams).expired === '1';
  return (
    <ManageChrome>
      <FindForm expired={expired} />
    </ManageChrome>
  );
}
