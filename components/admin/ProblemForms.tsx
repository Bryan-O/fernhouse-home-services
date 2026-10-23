'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { noAccess, weatherMove } from '@/app/admin/ops-actions';
import { addDays, todayIso, weekday } from '@/lib/booking';
import { POLICIES } from '@/lib/config';

const REASONS = ['gate locked', 'no one home', 'dog loose in the yard', 'lockbox code didn’t work'];

/** "Couldn't get in" for a visit due today: texts the customer (design/Messages.dc.html → Couldn’t get in). */
export function NoAccessForm({ visitId, isPet, label }: { visitId: string; isPet: boolean; label: string }) {
  const router = useRouter();
  const [reason, setReason] = useState(REASONS[0]);
  const [fee, setFee] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <section className="mg-card" aria-labelledby="na-h">
      <h2 className="display h3" id="na-h">Couldn’t get in?</h2>
      <p className="small" style={{ margin: 0, color: 'var(--ink-2)' }}>
        For the {label} visit. We text the customer to reply with access info{isPet ? ', and the yard visit moves to tomorrow.' : '. The visit is marked “couldn’t get in”.'}
      </p>
      <div className="field">
        <label className="label" htmlFor="na-reason">Reason (goes in the text)</label>
        <select id="na-reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
          {REASONS.map((r) => <option key={r}>{r}</option>)}
        </select>
      </div>
      {!isPet && (
        <label className="check-row">
          <input type="checkbox" checked={fee} onChange={(e) => setFee(e.target.checked)} />
          <span>Also charge the ${POLICIES.lateCancelFee} late fee (the Terms count a no-access visit as a late cancellation)</span>
        </label>
      )}
      {msg && <p className={msg.ok ? 'help-ok' : 'err'} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}
      <button type="button" className="btn btn-secondary" disabled={pending || !!msg?.ok} style={{ alignSelf: 'flex-start' }}
        onClick={() => start(async () => {
          const r = await noAccess(visitId, reason, fee).catch(() => ({ ok: false as const, error: 'Something went wrong.' }));
          setMsg(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
          router.refresh();
        })}>
        Text the customer
      </button>
    </section>
  );
}

/** Weather: move all of today's open yard visits to another day. */
export function WeatherMove({ count }: { count: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // Default: the next weekday (yard routes run Monday–Friday).
  const [to, setTo] = useState(() => { let d = addDays(todayIso(), 1); while ([0, 6].includes(weekday(d))) d = addDays(d, 1); return d; });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  if (!open) return <button type="button" className="linkbtn" onClick={() => setOpen(true)} style={{ alignSelf: 'flex-start' }}>Weather: move today’s {count} yard visit{count === 1 ? '' : 's'}</button>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
      <div className="field">
        <label className="label" htmlFor="wm-to">Move today’s open yard visits to</label>
        <input id="wm-to" className="input" type="date" value={to} min={addDays(todayIso(), 1)} max={addDays(todayIso(), 14)} onChange={(e) => setTo(e.target.value)} />
      </div>
      <p className="small" style={{ margin: 0, color: 'var(--muted)' }}>Each customer gets “Storms today — your yard visit moves to …”.</p>
      {msg && <p className={msg.ok ? 'help-ok' : 'err'} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}
      <div className="mg-actions">
        <button type="button" className="btn btn-primary btn-sm" disabled={pending || !!msg?.ok}
          onClick={() => start(async () => {
            const r = await weatherMove(to).catch(() => ({ ok: false as const, error: 'Something went wrong.' }));
            setMsg(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
            router.refresh();
          })}>Move and text customers</button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setOpen(false); setMsg(null); }}>Close</button>
      </div>
    </div>
  );
}
