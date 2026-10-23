'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check } from '@/components/Icons';
import { makeRecurring } from './actions';
import type { ConfirmationView } from '@/lib/checkout';
import { buildIcs } from '@/lib/ics';
import { fmtLong, formatPhone, routeLong } from '@/lib/booking';
import {
  ARRIVAL_WINDOWS,
  BRAND,
  CLEAN_SERVICE_LABEL,
  dogsText,
  lookupHome,
  OFFER,
  PET_FREQ_LABEL,
  petInitial,
  POLICIES,
  ROUTE_DAYS,
  standardFor,
  type RouteDayId,
} from '@/lib/config';

const FREQ_NAME = { one_time: 'One-time', weekly: 'Weekly', biweekly: 'Biweekly', twice_weekly: 'Twice weekly' } as const;
const dollars = (cents: number) => `$${Math.round(cents / 100)}`;

function CalendarIcon() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 9.5h17" /><path d="M8 3v4" /><path d="M16 3v4" /><path d="M12 13v4" /><path d="M10 15h4" />
    </svg>
  );
}

function download(name: string, ics: string) {
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Hero({ v }: { v: ConfirmationView }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 12, paddingTop: 8 }}>
      <span aria-hidden="true" style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Check size={36} width={2.4} stroke="#FFFFFF" />
      </span>
      <h1 id="ok-title" className="display" style={{ fontSize: 36, lineHeight: '42px' }}>You’re booked!</h1>
      <p className="body" style={{ margin: 0, color: 'var(--ink-2)', overflowWrap: 'anywhere' }}>
        We’ve sent your confirmation to <span style={{ whiteSpace: 'nowrap' }}>{formatPhone(v.phone)}</span> and {v.email}.
      </p>
    </div>
  );
}

function Steps({ items }: { items: string[] }) {
  return (
    <div className="bk-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 className="display h3">What happens next</h2>
      <ol className="ok-steps">
        {items.map((t, i) => <li key={t} className="body"><span className="display ok-num">{i + 1}</span>{t}</li>)}
      </ol>
    </div>
  );
}

export function Confirmed({ v, sessionId }: { v: ConfirmationView; sessionId: string }) {
  const [upsold, setUpsold] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [upsellError, setUpsellError] = useState(false);

  if (v.isPet) {
    const route = (v.routeDay ? ROUTE_DAYS.find((r) => r.id.toLowerCase() === v.routeDay)!.id : 'Mon') as RouteDayId;
    const pet = { petFreq: v.petFreq, dogs: v.dogs ?? 1, yard: 'std' as const, cond: v.cond };
    const once = v.frequency === 'one_time';
    const visit = v.pricePerVisitCents;
    const initial = petInitial(v.petFreq, v.cond) * 100;
    return (
      <section className="step-in" aria-labelledby="ok-title" style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <Hero v={v} />
        <div className="bk-card" style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
          <div className="small bk-row" style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
            <span style={{ color: 'var(--muted)', fontWeight: 600 }}>Booking</span><span style={{ fontWeight: 600 }} data-ref={v.ref}>{v.ref}</span>
          </div>
          <dl className="small ok-dl">
            <dt>Service</dt><dd>Pet waste removal · {PET_FREQ_LABEL[v.petFreq]} · {dogsText(v.dogs ?? 1)}</dd>
            <dt>Route day</dt><dd>{routeLong(pet, route)}</dd>
            <dt>First visit</dt><dd>{fmtLong(v.date)}</dd>
            <dt>Address</dt><dd>{v.address}</dd>
            <dt>{once ? 'One-time yard reset' : 'Per visit'}</dt><dd>{dollars(visit)}</dd>
            {initial > 0 && <><dt>First-visit cleanup</dt><dd>{dollars(initial)}</dd></>}
            <dt>Charged</dt><dd>After each visit</dd>
          </dl>
        </div>
        <Steps items={[
          'We’ll text you the evening before your first visit.',
          'After every visit you get a photo of your latched gate.',
          `Missed a spot? Tell us within ${POLICIES.guaranteeWindow} and we re-scoop free.`,
        ]} />
        <div style={{ background: 'var(--accent-soft)', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2 className="display h3">Want the inside done too?</h2>
          <p className="body" style={{ margin: 0, color: 'var(--ink-2)' }}>Get {OFFER.firstCleanPct}% off your first home clean — vetted, bonded and insured pros, booked in 60 seconds.</p>
          <Link className="btn btn-primary" href="/#booking" style={{ alignSelf: 'flex-start' }}>See my cleaning price</Link>
        </div>
        <div className="mg-actions" style={{ justifyContent: 'center' }}>
          <button type="button" className="btn btn-secondary" onClick={() => download(`fernhouse-${v.ref}.ics`, buildIcs({
            uid: v.ref, title: `${BRAND.name} yard visit`, description: `Pet waste removal — ${BRAND.phone}`, location: v.address, date: v.date,
            weeklyEvery: once ? undefined : v.frequency === 'biweekly' ? 2 : 1,
          }))}><CalendarIcon />Add route day to calendar</button>
          <Link className="btn btn-secondary" href="/">Back to home</Link>
        </div>
      </section>
    );
  }

  const w = ARRIVAL_WINDOWS.find((x) => x.id === v.window);
  const recurring = v.frequency !== 'one_time' || upsold !== null;
  const row = lookupHome(v.beds ?? 1, v.baths ?? 1);
  const biweekly = row ? standardFor(row, 'biweekly') : 0;
  const canUpsell = v.service === 'standard' && v.frequency === 'one_time' && upsold === null && !!row;
  const paid = v.firstVisitCents - v.discountCents;
  const planFreq = upsold !== null ? 'biweekly' : FREQ_NAME[v.frequency].toLowerCase();
  const planPrice = upsold ?? v.pricePerVisitCents;
  const label = `${CLEAN_SERVICE_LABEL[v.service as 'standard']} · ${upsold !== null ? 'Biweekly' : FREQ_NAME[v.frequency]} · ${v.beds} bd / ${v.baths} ba`;

  const upsell = async () => {
    setBusy(true);
    setUpsellError(false);
    const r = await makeRecurring(sessionId).catch(() => ({ ok: false as const }));
    setBusy(false);
    if (r.ok) setUpsold(r.priceCents);
    else setUpsellError(true);
  };

  return (
    <section className="step-in" aria-labelledby="ok-title" style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Hero v={v} />
      <div className="bk-card" style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
        <div className="small bk-row" style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
          <span style={{ color: 'var(--muted)', fontWeight: 600 }}>Booking</span><span style={{ fontWeight: 600 }} data-ref={v.ref}>{v.ref}</span>
        </div>
        <dl className="small ok-dl">
          <dt>Clean</dt><dd>{label}</dd>
          <dt>Date</dt><dd>{fmtLong(v.date)}</dd>
          <dt>Arrival</dt><dd>{w ? `B${w.spoken.slice(1)}` : ''}</dd>
          <dt>Address</dt><dd>{v.address}</dd>
          <dt>Paid today</dt><dd>{dollars(paid)}{v.discountCents > 0 && <> <span style={{ color: 'var(--accent)' }}>({OFFER.firstCleanPct}% off)</span></>}</dd>
          {recurring && <><dt>Your plan</dt><dd>{dollars(planPrice)} per visit, {planFreq}</dd></>}
        </dl>
      </div>

      {canUpsell && (
        <div style={{ background: 'var(--accent-soft)', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2 className="display h3">Keep it this clean — make it recurring</h2>
          <p className="body" style={{ margin: 0, color: 'var(--ink-2)' }}>
            Switch to biweekly and pay ${biweekly} per visit instead of {dollars(v.pricePerVisitCents)}. Same standing slot, your preferences saved, no contracts.
          </p>
          <button type="button" className="btn btn-primary btn-busy" onClick={upsell} disabled={busy} style={{ alignSelf: 'flex-start' }}>
            {busy && <span className="spinner" aria-hidden="true" />}Make it recurring
          </button>
          {upsellError && <p className="err" role="alert">We couldn’t switch your plan just now. Please try again, or call {BRAND.phone}.</p>}
        </div>
      )}
      {upsold !== null && (
        <div role="status" style={{ background: 'var(--accent-soft)', borderRadius: 16, padding: 20, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <Check size={22} width={2.4} stroke="var(--accent)" style={{ flex: 'none' }} />
          <p className="body" style={{ margin: 0 }}><strong>You’re on a biweekly plan.</strong> Your next visit is two weeks after this one, at {dollars(upsold)}. Pause or cancel anytime from your confirmation link.</p>
        </div>
      )}

      <Steps items={[
        'We’ll text you when your team is confirmed, with their arrival window.',
        'Your team brings all supplies.',
        'After your clean, tell us how it went — if anything’s not right, the re-clean guarantee applies.',
      ]} />

      <div className="mg-actions" style={{ justifyContent: 'center' }}>
        <button type="button" className="btn btn-secondary" onClick={() => download(`fernhouse-${v.ref}.ics`, buildIcs({
          uid: v.ref, title: `${BRAND.name} clean`, description: `${label}. Arrival ${w?.time ?? ''}. ${BRAND.phone}`, location: v.address, date: v.date,
          startHour: w?.startHour, endHour: w?.endHour, weeklyEvery: !recurring ? undefined : v.frequency === 'weekly' ? 1 : 2,
        }))}><CalendarIcon />Add to calendar</button>
        <Link className="btn btn-secondary" href="/#booking">Book another home</Link>
      </div>
    </section>
  );
}
