import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ManageChrome } from '@/components/manage/ManageChrome';
import { ManageApp } from './ManageApp';
import { customerForToken, loadManage, loadRatingPrompt } from '@/lib/manage';
import { getAvailability } from '@/app/actions/booking';
import { supabaseConfigured } from '@/lib/supabase/env';

export const metadata: Metadata = { title: 'Your booking', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

// The link in every confirmation text and email: signed, expiring, no password.
export default async function ManageBookingPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ card?: string; rate?: string; score?: string }> }) {
  const { token } = await params;
  if (!supabaseConfigured()) redirect('/manage');
  const customerId = await customerForToken(token);
  if (!customerId) redirect('/manage?expired=1');
  const sp = await searchParams;
  const [data, av, rating] = await Promise.all([loadManage(customerId), getAvailability(), loadRatingPrompt(customerId, sp.rate, sp.score)]);
  if (!data) redirect('/manage?expired=1');
  return (
    <ManageChrome>
      <ManageApp token={token} data={data} av={av} rating={rating} cardUpdated={sp.card === 'updated'} />
    </ManageChrome>
  );
}
