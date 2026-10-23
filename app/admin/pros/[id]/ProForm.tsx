'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { savePro } from '@/app/admin/ops-actions';
import type { ProDetail } from '@/lib/ops';
import { SERVICE_AREAS, SERVICE_ZIPS } from '@/lib/config';
import { CONSENT } from '@/lib/messages';
import { formatPhone } from '@/lib/booking';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function ProForm({ pro }: { pro: ProDetail | null }) {
  const router = useRouter();
  const allCities = pro ? !pro.zips.length : true;
  const [f, setF] = useState({
    name: pro?.name ?? '', mobile: pro ? formatPhone(pro.mobile) : '', services: pro?.services ?? ['cleaning'],
    cities: allCities ? [...SERVICE_AREAS] as string[] : [...new Set(pro!.zips.map((z) => SERVICE_ZIPS[z]).filter(Boolean))] as string[],
    offWeekdays: pro?.offWeekdays ?? [0], consent: pro?.consent ?? false, active: pro?.active ?? true,
  });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const toggle = <T,>(list: T[], x: T) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x]);

  const save = () => start(async () => {
    const all = f.cities.length === SERVICE_AREAS.length;
    const r = await savePro(pro?.id ?? null, { ...f, cities: all ? [] : f.cities, active: pro ? f.active : undefined });
    setMsg(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
    if (r.ok && !pro && r.id) router.push(`/admin/pros/${r.id}`);
    else router.refresh();
  });

  return (
    <section className="mg-card" aria-labelledby="pro-h">
      <h2 className="display h3" id="pro-h">Details</h2>
      <div className="field"><label className="label" htmlFor="p-name">Name</label><input id="p-name" className="input" autoComplete="off" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
      <div className="field"><label className="label" htmlFor="p-mobile">Mobile</label><input id="p-mobile" className="input" type="tel" inputMode="tel" value={f.mobile} onChange={(e) => setF({ ...f, mobile: e.target.value })} /></div>
      <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
        <legend className="label" style={{ marginBottom: 8 }}>Services</legend>
        <div className="mg-reasons">
          {[['cleaning', 'House cleaning'], ['pet', 'Pet waste (yards)']].map(([id, l]) => (
            <button key={id} type="button" className="opt" aria-pressed={f.services.includes(id)} onClick={() => setF({ ...f, services: toggle(f.services, id) })} style={{ minHeight: 48, fontWeight: 600 }}>{l}</button>
          ))}
        </div>
      </fieldset>
      <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
        <legend className="label" style={{ marginBottom: 8 }}>Areas they cover</legend>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {SERVICE_AREAS.map((c) => (
            <button key={c} type="button" className="opt" aria-pressed={f.cities.includes(c)} onClick={() => setF({ ...f, cities: toggle(f.cities, c) })} style={{ minHeight: 44, padding: '0 14px', fontWeight: 600, fontSize: 14 }}>{c}</button>
          ))}
        </div>
      </fieldset>
      <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
        <legend className="label" style={{ marginBottom: 8 }}>Days off</legend>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {DAYS.map((d, i) => (
            <button key={d} type="button" className="opt" aria-pressed={f.offWeekdays.includes(i)} onClick={() => setF({ ...f, offWeekdays: toggle(f.offWeekdays, i) })} style={{ minHeight: 44, minWidth: 56, fontWeight: 600, fontSize: 14 }}>{d}</button>
          ))}
        </div>
      </fieldset>
      <label className="check-row">
        <input type="checkbox" checked={f.consent} disabled={!!pro?.consent} onChange={(e) => setF({ ...f, consent: e.target.checked })} />
        <span>They agreed to job texts: <span style={{ color: 'var(--ink-2)' }}>“{CONSENT.pro.text}”</span></span>
      </label>
      {pro && (
        <label className="check-row">
          <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />
          <span>Active — can be assigned visits</span>
        </label>
      )}
      {msg && <p className={msg.ok ? 'help-ok' : 'err'} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}
      <button type="button" className="btn btn-primary" onClick={save} disabled={pending} style={{ alignSelf: 'flex-start' }}>{pro ? 'Save' : 'Add pro'}</button>
    </section>
  );
}
