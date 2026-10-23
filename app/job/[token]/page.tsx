import type { Metadata } from 'next';
import Link from 'next/link';
import { JobChrome } from '@/components/job/JobChrome';
import { JobApp } from './JobApp';
import { DocsApp } from './DocsApp';
import { loadJob } from '@/lib/job';
import { supabaseConfigured } from '@/lib/supabase/env';
import { BRAND } from '@/lib/config';

export const metadata: Metadata = { title: 'Job', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

// The link a pro gets by text: one job, a yard route for the day, or their documents. No login.
export default async function JobPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ v?: string }> }) {
  const { token } = await params;
  const { v } = await searchParams;
  const view = supabaseConfigured() ? await loadJob(token, v) : null;

  if (!view) {
    return (
      <JobChrome>
        <div className="mg-card">
          <h1 className="display h3">This link has expired</h1>
          <p className="body" style={{ margin: 0, color: 'var(--ink-2)' }}>Job links stop working a day after the visit, or if the visit moved to another pro. Call {BRAND.name} at {BRAND.phone} if you need the details.</p>
        </div>
      </JobChrome>
    );
  }

  if (view.kind === 'docs') return <JobChrome><DocsApp token={token} view={view} /></JobChrome>;

  if (view.kind === 'route') {
    return (
      <JobChrome>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="small" style={{ color: 'var(--muted)', fontWeight: 600 }}>{view.when}</span>
          <h1 className="display mg-h1">{view.title}</h1>
        </div>
        <section className="mg-card" aria-labelledby="stops-h">
          <h2 className="display h3" id="stops-h">Yards</h2>
          <ul className="row-list">
            {view.stops.map((s) => (
              <li key={s.visitId} className="row-card">
                <span style={{ fontWeight: 600 }}>{s.label}</span>
                {s.done ? <span className="pill pill-ok">Done</span> : <Link className="btn btn-secondary btn-sm" href={`/job/${token}?v=${s.visitId}`}>Open</Link>}
              </li>
            ))}
          </ul>
          <p className="small" style={{ margin: 0, color: 'var(--muted)' }}>Gate codes and addresses unlock at 6 AM. Every yard needs a gate photo before it’s marked done.</p>
        </section>
      </JobChrome>
    );
  }

  return <JobChrome><JobApp token={token} job={view} /></JobChrome>;
}
