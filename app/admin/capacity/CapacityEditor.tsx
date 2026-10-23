'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { blockDays, setCleanSlots, setYardSlots, unblockDays } from '@/app/admin/ops-actions';
import type { CapacityView } from '@/lib/ops';
import { ARRIVAL_WINDOWS } from '@/lib/config';

function Stepper({ n, label, onChange }: { n: number; label: string; onChange: (n: number) => void }) {
  return (
    <div className="ad-stepper" role="group" aria-label={label}>
      <button type="button" className="ad-st-btn" aria-label="Fewer" onClick={() => onChange(n - 1)} disabled={n <= 0}>−</button>
      <output aria-live="polite">{n}</output>
      <button type="button" className="ad-st-btn" aria-label="More" onClick={() => onChange(n + 1)}>+</button>
    </div>
  );
}

export function CapacityEditor({ cap }: { cap: CapacityView }) {
  const router = useRouter();
  const [clean, setClean] = useState(cap.clean);
  const [yard, setYard] = useState(cap.yard);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [note, setNote] = useState('');
  const [pending, start] = useTransition();

  // Save each change straight away; put the number back if it didn't save.
  const changeClean = (di: number, wi: number, n: number) => {
    const before = clean;
    setClean(clean.map((r, i) => (i === di ? { ...r, slots: r.slots.map((s, j) => (j === wi ? n : s)) as [number, number, number] } : r)));
    setCleanSlots(clean[di].weekday, ARRIVAL_WINDOWS[wi].id, n).then((r) => { if (!r.ok) { setClean(before); setError(r.error); } else setError(''); });
  };
  const changeYard = (di: number, n: number) => {
    const before = yard;
    setYard(yard.map((r, i) => (i === di ? { ...r, slots: n } : r)));
    setYardSlots(yard[di].weekday, n).then((r) => { if (!r.ok) { setYard(before); setError(r.error); } else setError(''); });
  };
  const block = () => start(async () => {
    const r = await blockDays(from, to, note);
    if (!r.ok) return setError(r.error);
    setError(''); setAdding(false); setFrom(''); setTo(''); setNote('');
    router.refresh();
  });

  return (
    <>
      {error && <div role="alert" className="mg-error">{error}</div>}
      <div className="mg-grid">
        <section className="mg-card" aria-labelledby="cap-clean">
          <h2 className="display h3" id="cap-clean">Home cleaning · per arrival window</h2>
          <div className="tbl-wrap">
            <table className="tbl cap">
              <thead><tr><th scope="col">Day</th>{ARRIVAL_WINDOWS.map((w) => <th key={w.id} scope="col">{w.short}</th>)}</tr></thead>
              <tbody>
                {clean.map((r, di) => (
                  <tr key={r.day}>
                    <th scope="row" style={{ textAlign: 'left' }}>{r.day}</th>
                    {r.slots.map((n, wi) => (
                      <td key={wi} data-w={ARRIVAL_WINDOWS[wi].short}>
                        <Stepper n={n} label={`${r.day} ${ARRIVAL_WINDOWS[wi].short} visits`} onChange={(v) => changeClean(di, wi, v)} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small" style={{ margin: 0, color: 'var(--muted)' }}>Sunday is closed. Set a window to 0 to stop taking bookings in it.</p>
        </section>
        <div className="mg-col">
          <section className="mg-card" aria-labelledby="cap-pet">
            <h2 className="display h3" id="cap-pet">Pet waste · yards per route day</h2>
            {yard.map((r, di) => (
              <div key={r.day} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <span style={{ fontWeight: 600 }}>{r.day}</span>
                <Stepper n={r.slots} label={`${r.day} yards`} onChange={(v) => changeYard(di, v)} />
              </div>
            ))}
          </section>
          <section className="mg-card" aria-labelledby="cap-block">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
              <h2 className="display h3" id="cap-block">Blocked days</h2>
              {!adding && <button type="button" className="linkbtn" onClick={() => setAdding(true)}>Block a day</button>}
            </div>
            {adding && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="row2-even" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                  <div className="field"><label className="label" htmlFor="b-from">From</label><input id="b-from" className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
                  <div className="field"><label className="label" htmlFor="b-to">To <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(optional)</span></label><input id="b-to" className="input" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></div>
                </div>
                <div className="field"><label className="label" htmlFor="b-note">Label <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(optional)</span></label><input id="b-note" className="input" maxLength={60} placeholder="Thanksgiving" value={note} onChange={(e) => setNote(e.target.value)} /></div>
                <div className="mg-actions">
                  <button type="button" className="btn btn-primary btn-sm" onClick={block} disabled={!from || pending}>Block</button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAdding(false)}>Cancel</button>
                </div>
              </div>
            )}
            {cap.blocked.length ? (
              <ul className="block-list">
                {cap.blocked.map((b) => (
                  <li key={b.dates[0]}>
                    <span style={{ fontWeight: 600 }}>{b.label}</span>
                    <button type="button" className="linkbtn" style={{ padding: 0 }} onClick={() => start(async () => { await unblockDays(b.dates); router.refresh(); })}>Remove</button>
                  </li>
                ))}
              </ul>
            ) : <p className="small" style={{ margin: 0, color: 'var(--muted)' }}>No blocked days.</p>}
            <p className="small" style={{ margin: 0, color: 'var(--muted)' }}>Existing visits on a blocked day aren’t cancelled — you’ll see them in Today.</p>
          </section>
        </div>
      </div>
    </>
  );
}
