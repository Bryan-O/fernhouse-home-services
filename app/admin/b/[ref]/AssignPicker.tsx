'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { assignPro } from '@/app/admin/ops-actions';
import type { AssignView } from '@/lib/ops';

export function AssignPicker({ planId, legend, pros, customerFirst }: { planId: string; legend: string; pros: AssignView['pros']; customerFirst: string }) {
  const router = useRouter();
  const [pick, setPick] = useState(pros.find((p) => !p.blocked)?.id ?? '');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const chosen = pros.find((p) => p.id === pick && !p.blocked);

  const assign = () => start(async () => {
    setError('');
    const r = await assignPro(planId, pick).catch(() => ({ ok: false as const, error: 'Something went wrong. Please try again.' }));
    if (!r.ok) return setError(r.error);
    const q = new URLSearchParams({ assigned: chosen!.name, customer: customerFirst, ...(r.message !== 'assigned' ? { note: r.message } : {}) });
    router.push(`/admin?${q}`);
  });

  return (
    <section className="mg-card">
      <fieldset style={{ border: 0, margin: 0, padding: 0, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <legend style={{ fontSize: 15, fontWeight: 600, padding: 0, marginBottom: 4 }}>{legend}</legend>
        {pros.length ? pros.map((p) => (
          <button key={p.id} type="button" className="opt pro-opt" aria-pressed={pick === p.id} disabled={p.blocked} onClick={() => setPick(p.id)}>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'left', minWidth: 0 }}>
              <span style={{ fontWeight: 600 }}>{p.name}</span>
              <span className="small" style={{ color: 'var(--ink-2)' }}>{p.detail}</span>
            </span>
            <span className={`pill pill-${p.tone}`}>{p.status}</span>
          </button>
        )) : <p className="small" style={{ margin: 0, color: 'var(--ink-2)' }}>No pros cover this area for this service yet. Add one on the Pros tab.</p>}
      </fieldset>
      <p className="small" style={{ margin: 0, color: 'var(--muted)' }}>Confirm with the pro by text or phone first. Assigning sends them the job link and tells the customer their team is confirmed.</p>
      {error && <p className="err" role="alert">{error}</p>}
      <button type="button" className="btn btn-primary btn-busy" onClick={assign} disabled={!chosen || pending} style={{ width: '100%' }}>
        {pending && <span className="spinner" aria-hidden="true" />}{chosen ? `Assign ${chosen.name} & notify` : 'Pick a pro'}
      </button>
    </section>
  );
}
