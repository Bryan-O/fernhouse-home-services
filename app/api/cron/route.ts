import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { runJobs } from '@/lib/jobs';
import { supabaseConfigured } from '@/lib/supabase/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Called every hour (.github/workflows/hourly-jobs.yml) with "Authorization: Bearer <CRON_SECRET>".
// ?only=jobA,jobB runs just those jobs (for a manual run from the terminal).
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !supabaseConfigured()) return NextResponse.json({ error: 'not configured' }, { status: 503 });
  const got = Buffer.from(request.headers.get('authorization') ?? '');
  const want = Buffer.from(`Bearer ${secret}`);
  if (got.length !== want.length || !timingSafeEqual(got, want)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const only = new URL(request.url).searchParams.get('only')?.split(',').filter(Boolean);
  const { ok, results } = await runJobs(new Date(), only);
  return NextResponse.json({ ok, results }, { status: ok ? 200 : 500 });
}
