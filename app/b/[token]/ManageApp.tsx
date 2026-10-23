'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check } from '@/components/Icons';
import {
  cancelPlan,
  cancelVisit,
  changeRouteDay,
  requestRedo,
  rescheduleVisit,
  setPlanPaused,
  skipVisit,
  startCardUpdate,
  undoSkip,
  updateNotes,
  type ActionResult,
} from './actions';
import type { ManageView, PlanView, VisitView } from '@/lib/manage';
import {
  addDays,
  fmtLong,
  fmtShort,
  isBookableDate,
  isClosedDate,
  isFullDate,
  windowsLeft,
  type Availability,
} from '@/lib/booking';
import { ARRIVAL_WINDOWS, BRAND, OFFER, POLICIES, ROUTE_DAYS, type ArrivalWindowId, type RouteDayId } from '@/lib/config';

type View = 'overview' | 'reschedule' | 'cancel' | 'cancelled';
const REASONS = ['Schedule conflict', 'Away from home', 'Feeling unwell', 'Something else'];
const dollars = (cents: number) => `$${Math.round(cents / 100)}`;
const winShort = (w: ArrivalWindowId | null) => ARRIVAL_WINDOWS.find((x) => x.id === w)?.short ?? '';
const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' });
const doneTime = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });

function Toast({ text }: { text: string }) {
  return (
    <div role="status" className="mg-toast">
      <Check size={20} width={2} stroke="var(--accent)" style={{ flex: 'none' }} />
      <span>{text}</span>
    </div>
  );
}

function ErrorBox({ text }: { text: string }) {
  return <div role="alert" className="small mg-error">{text}</div>;
}

function Back({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="linkbtn" onClick={onClick} style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
      Back to your booking
    </button>
  );
}

function SectionHead({ id, title, action }: { id: string; title: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
      <h2 className="display h3" id={id}>{title}</h2>
      {action}
    </div>
  );
}

const pill = (tone: 'ok' | 'neutral' | 'warn') =>
  tone === 'ok' ? { background: 'var(--accent-soft)', color: 'var(--accent)' } : tone === 'warn' ? { background: 'var(--warning-soft)', color: 'var(--warning)' } : { background: 'var(--paper-2)', color: 'var(--ink-2)' };

export function ManageApp({ token, data, av, cardUpdated }: { token: string; data: ManageView; av: Availability; cardUpdated: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [planId, setPlanId] = useState(data.plans[0]?.id ?? '');
  const [view, setView] = useState<View>('overview');
  const [toast, setToast] = useState(cardUpdated ? 'Card updated. Future visits will be charged to your new card.' : '');
  const [error, setError] = useState('');
  const [target, setTarget] = useState<VisitView | null>(null);
  const [cancelled, setCancelled] = useState<{ date: string; feeCents: number; refundedCents: number } | null>(null);

  const plan = data.plans.find((p) => p.id === planId) ?? data.plans[0];
  const card = data.card ? `${data.card.brand.charAt(0).toUpperCase()}${data.card.brand.slice(1)} •••• ${data.card.last4}` : 'your card';

  const run = (fn: () => Promise<ActionResult>, after?: (r: Extract<ActionResult, { ok: true }>) => void) => {
    setError('');
    startTransition(async () => {
      const r = await fn().catch(() => ({ ok: false as const, error: 'Something went wrong. Please try again.' }));
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setToast(r.toast);
      after?.(r);
      router.refresh();
      window.scrollTo(0, 0);
    });
  };
  const go = (v: View, visit?: VisitView | null) => {
    setError('');
    setToast('');
    if (visit !== undefined) setTarget(visit);
    setView(v);
    window.scrollTo(0, 0);
  };

  if (!plan) {
    return (
      <div className="narrow" style={{ margin: '0 auto' }}>
        <div className="mg-card">
          <h1 className="display mg-h1">No upcoming visits</h1>
          <p className="body" style={{ margin: 0, color: 'var(--ink-2)' }}>You don’t have any bookings with us right now.</p>
          <Link className="btn btn-primary" href="/#booking" style={{ alignSelf: 'flex-start' }}>Book a clean</Link>
        </div>
      </div>
    );
  }

  if (view === 'reschedule' && target) return <Reschedule {...{ target, av, pending, error }} onBack={() => go('overview')} onConfirm={(date, w) => run(() => rescheduleVisit(token, target.id, date, w), () => setView('overview'))} />;

  if (view === 'cancel' && target) {
    return (
      <CancelVisit {...{ target, pending, error, card }} oneTime={plan.frequency === 'one_time'} onBack={() => go('overview')}
        onConfirm={(reason) => run(() => cancelVisit(token, target.id, reason), (r) => {
          setCancelled({ date: target.date, feeCents: r.feeCents ?? 0, refundedCents: r.refundedCents ?? 0 });
          setView('cancelled');
        })} />
    );
  }

  if (view === 'cancelled' && cancelled) {
    return (
      <div className="narrow step-in" style={{ margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
          <span aria-hidden="true" style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--paper-2)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Check size={24} width={1.8} stroke="var(--ink-2)" />
          </span>
          <h1 className="display mg-h1">Visit cancelled</h1>
          <p className="body" style={{ margin: 0, color: 'var(--ink-2)' }}>
            Your {fmtLong(cancelled.date)} visit is cancelled.{' '}
            {cancelled.feeCents > 0 ? `A ${dollars(cancelled.feeCents)} late fee was charged to ${card} — we’ve texted and emailed a receipt.` : 'There’s no fee.'}
            {cancelled.refundedCents > 0 ? ` We’ve refunded ${dollars(cancelled.refundedCents)} to ${card}.` : ''}
          </p>
        </div>
        <div className="mg-card">
          <dl className="dl">
            <dt>Your plan</dt><dd>{plan.status === 'ended' || plan.frequency === 'one_time' ? 'Ended' : `Still ${plan.status === 'paused' ? 'paused' : 'active'} · ${plan.frequency.replace('_', ' ')}`}</dd>
            {plan.next && <><dt>Next visit</dt><dd>{fmtLong(plan.next.date)}{plan.next.window ? ` · ${winShort(plan.next.window)}` : ''}</dd></>}
          </dl>
          <div className="mg-actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => go('overview')}>Back to your booking</button>
          </div>
        </div>
      </div>
    );
  }

  const common = { token, plan, data, card, pending, run, go, setError };
  return (
    <div className="step-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {toast && <Toast text={toast} />}
      {error && <ErrorBox text={error} />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span className="small" style={{ color: 'var(--muted)', fontWeight: 600 }}>{plan.isPet ? 'Yard service' : 'Booking'} <span data-ref={plan.ref}>{plan.ref}</span></span>
        <h1 className="display mg-h1">Hi {data.firstName}, here’s your {plan.isPet ? 'yard plan' : 'plan'}</h1>
      </div>
      {data.plans.length > 1 && (
        <div className="mg-plans" role="group" aria-label="Your bookings">
          {data.plans.map((p) => (
            <button key={p.id} type="button" className="opt" aria-pressed={p.id === plan.id} onClick={() => { setPlanId(p.id); setToast(''); setError(''); }}
              style={{ minHeight: 44, padding: '0 14px', fontSize: 14, fontWeight: 600, borderRadius: 999 }}>
              {p.isPet ? 'Yard service' : 'Home cleaning'} · {p.ref}
            </button>
          ))}
        </div>
      )}
      {plan.isPet ? <PetOverview {...common} /> : <CleanOverview {...common} />}
    </div>
  );
}

// ───────── Shared cards ─────────

interface OverviewProps {
  token: string;
  plan: PlanView;
  data: ManageView;
  card: string;
  pending: boolean;
  run: (fn: () => Promise<ActionResult>) => void;
  go: (v: View, visit?: VisitView | null) => void;
  setError: (e: string) => void;
}

function PaymentCard({ token, data, plan, card, setError }: OverviewProps) {
  const [busy, setBusy] = useState(false);
  const update = async () => {
    setBusy(true);
    const r = await startCardUpdate(token).catch(() => ({ error: 'Something went wrong. Please try again.' }));
    if ('url' in r) window.location.assign(r.url);
    else {
      setBusy(false);
      setError(r.error);
    }
  };
  return (
    <section className="mg-card" aria-labelledby={`pay-h-${plan.id}`}>
      <SectionHead id={`pay-h-${plan.id}`} title="Payment" action={<button type="button" className="linkbtn" onClick={update} disabled={busy}>{busy ? 'Opening…' : 'Update card'}</button>} />
      <dl className="dl">
        <dt>Card</dt><dd>{data.card ? card.replace(/^./, (c) => c.toUpperCase()) : 'None saved yet'}</dd>
        {plan.lastCharge && (
          <><dt>Last charge</dt><dd>{dollars(plan.lastCharge.amountCents)} on {shortDate(plan.lastCharge.date)}{plan.lastCharge.receiptUrl && <> · <a className="link" href={plan.lastCharge.receiptUrl} target="_blank" rel="noreferrer">Receipt</a></>}</dd></>
        )}
      </dl>
      {!plan.isPet && <p className="small" style={{ margin: 0, color: 'var(--muted)' }}>Card details are handled by Stripe. You pay {BRAND.name}, never anyone directly.</p>}
    </section>
  );
}

function RedoCard({ token, plan, pending, run }: OverviewProps) {
  const [note, setNote] = useState('');
  const d = plan.lastDone;
  const word = plan.isPet ? 're-scoop' : 're-clean';
  return (
    <section className="mg-card" aria-labelledby={`help-h-${plan.id}`} style={{ gap: 10 }}>
      <h2 className="display h3" id={`help-h-${plan.id}`}>Something not right?</h2>
      <p className="small" style={{ margin: 0, color: 'var(--ink-2)' }}>Tell us within {POLICIES.guaranteeWindow} of a visit and we’ll send a team back to {word}, free.</p>
      {d?.canRequest ? (
        <>
          <label className="sr-only" htmlFor={`redo-${plan.id}`}>What needs another look?</label>
          <textarea id={`redo-${plan.id}`} className="input" rows={2} placeholder="What needs another look? (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <button type="button" className="btn btn-secondary btn-sm" disabled={pending} onClick={() => run(() => requestRedo(token, d.id, note))} style={{ alignSelf: 'flex-start' }}>Request a {word}</button>
        </>
      ) : d?.requested ? (
        <p className="small" style={{ margin: 0, fontWeight: 600, color: 'var(--accent)' }}>We’ve got your request for {fmtShort(d.date)} — we’ll text you the time.</p>
      ) : (
        <p className="small" style={{ margin: 0, color: 'var(--muted)' }}>You can ask from here for {POLICIES.guaranteeWindow} after each visit, or text us anytime.</p>
      )}
    </section>
  );
}

function NotesCard({ token, plan, pending, run }: OverviewProps) {
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState({ access: plan.access, gate: plan.gate, petsNote: plan.petsNote, requests: plan.requests, dogNames: plan.dogNames, dogsFriendly: plan.dogsFriendly ?? true });
  const field = (id: string, label: string, key: keyof typeof f, rows = 2) => (
    <div className="field">
      <label className="label" htmlFor={`${id}-${plan.id}`}>{label}</label>
      <textarea id={`${id}-${plan.id}`} className="input" rows={rows} value={String(f[key])} onChange={(e) => setF({ ...f, [key]: e.target.value })} />
    </div>
  );
  return (
    <section className="mg-card" aria-labelledby={`notes-h-${plan.id}`}>
      <SectionHead id={`notes-h-${plan.id}`} title={plan.isPet ? 'Dogs & yard' : 'Access & notes'}
        action={!editing && plan.status !== 'ended' ? <button type="button" className="linkbtn" onClick={() => setEditing(true)}>Edit</button> : undefined} />
      {editing ? (
        <>
          {plan.isPet ? (
            <>
              {field('gate', 'Gate code or access notes', 'gate')}
              {field('dogs', 'Your dogs’ names', 'dogNames', 1)}
              <fieldset className="bk-fieldset" style={{ gap: 8 }}>
                <legend className="label" style={{ padding: 0, marginBottom: 8 }}>On your route day, your dogs are…</legend>
                <div className="mg-reasons">
                  <button type="button" className="opt" aria-pressed={f.dogsFriendly} onClick={() => setF({ ...f, dogsFriendly: true })} style={{ minHeight: 48, fontWeight: 600 }}>Friendly</button>
                  <button type="button" className="opt" aria-pressed={!f.dogsFriendly} onClick={() => setF({ ...f, dogsFriendly: false })} style={{ minHeight: 48, fontWeight: 600 }}>Kept inside</button>
                </div>
              </fieldset>
              {field('req', 'Anything else?', 'requests')}
            </>
          ) : (
            <>
              {field('access', 'How will your team get in?', 'access', 3)}
              {field('pets', 'Pets', 'petsNote', 1)}
              {field('req', 'Special requests', 'requests')}
            </>
          )}
          <div className="mg-actions">
            <button type="button" className="btn btn-primary btn-sm" disabled={pending} onClick={() => { run(() => updateNotes(token, plan.id, f)); setEditing(false); }}>Save</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </>
      ) : plan.isPet ? (
        <dl className="dl">
          <dt>Dogs</dt><dd>{plan.dogNames || 'Not named'}{plan.dogsFriendly === false ? ' — kept inside' : ' — friendly'}</dd>
          <dt>Gate</dt><dd>{plan.gate || 'None given'}</dd>
          <dt>Address</dt><dd>{plan.addressLine}</dd>
        </dl>
      ) : (
        <dl className="dl">
          <dt>Entry</dt><dd>{plan.access ? `${plan.access} · shared with your team only` : 'None given'}</dd>
          <dt>Pets</dt><dd>{plan.petsNote || 'None'}</dd>
          <dt>Requests</dt><dd>{plan.requests || 'None'}</dd>
        </dl>
      )}
    </section>
  );
}

function FreeNote({ v }: { v: VisitView }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: 'var(--paper-2)', borderRadius: 12, padding: '12px 14px' }}>
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink-2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none', marginTop: 2 }}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
      <span className="small" style={{ color: 'var(--ink-2)' }}>
        {v.terms.free
          ? <>Free changes until <strong style={{ color: 'var(--ink)' }}>{v.terms.deadlineLabel}</strong>. After that, changes or cancellations carry a ${POLICIES.lateCancelFee} fee.</>
          : <>Your visit is in {v.terms.hoursUntil} hours, so changes or cancellations now carry a ${POLICIES.lateCancelFee} fee{v.feeCents > 0 ? ' (already applied to this visit)' : ''}.</>}
      </span>
    </div>
  );
}

// ───────── Home cleaning ─────────

function CleanOverview(props: OverviewProps) {
  const { token, plan, pending, run, go } = props;
  const next = plan.next;
  const recurring = plan.frequency !== 'one_time';
  return (
    <div className="mg-grid">
      <div className="mg-col">
        <section className="mg-card" aria-labelledby={`next-h-${plan.id}`}>
          {next ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span className="small" style={{ color: 'var(--muted)', fontWeight: 600 }} id={`next-h-${plan.id}`}>Next visit</span>
                  <span className="display" style={{ fontSize: 26, lineHeight: '32px' }}>{fmtLong(next.date)}</span>
                  <span className="body" style={{ color: 'var(--ink-2)' }}>Arrival {winShort(next.window)}</span>
                </div>
                <span className="pill" style={pill(next.teamConfirmed ? 'ok' : 'neutral')}>
                  {next.teamConfirmed && <Check size={14} width={2.4} />}{next.teamConfirmed ? 'Team confirmed' : 'Finding your team'}
                </span>
              </div>
              <dl className="dl">
                <dt>Service</dt><dd>{plan.serviceLine}</dd>
                <dt>Address</dt><dd>{plan.addressLine}</dd>
                <dt>Price</dt><dd>{dollars(plan.pricePerVisitCents)} · {next.prepaid ? 'paid at booking' : plan.chargeLine}</dd>
              </dl>
              {next.terms.allowed ? (
                <>
                  <FreeNote v={next} />
                  <div className="mg-actions">
                    <button type="button" className="btn btn-primary btn-sm" disabled={pending} onClick={() => go('reschedule', next)}>Reschedule</button>
                    {recurring && <button type="button" className="btn btn-secondary btn-sm" disabled={pending} onClick={() => run(() => skipVisit(token, next.id))}>Skip this visit</button>}
                    <button type="button" className="btn btn-secondary btn-sm" disabled={pending} onClick={() => go('cancel', next)}>Cancel visit</button>
                  </div>
                </>
              ) : (
                <p className="small" style={{ margin: 0, color: 'var(--ink-2)' }}>Your visit is under way. Need something? Text us at <a className="link" href={BRAND.phoneHref.replace('tel:', 'sms:')}>{BRAND.phone}</a>.</p>
              )}
            </>
          ) : (
            <>
              <span className="small" style={{ color: 'var(--muted)', fontWeight: 600 }} id={`next-h-${plan.id}`}>Next visit</span>
              <p className="body" style={{ margin: 0 }}>{plan.status === 'paused' ? 'None while your plan is paused.' : 'No visits scheduled.'}</p>
              {plan.status === 'ended' && <Link className="btn btn-primary btn-sm" href="/#booking" style={{ alignSelf: 'flex-start' }}>Book again</Link>}
            </>
          )}
        </section>

        <section className="mg-card" aria-labelledby={`plan-h-${plan.id}`}>
          <SectionHead id={`plan-h-${plan.id}`} title="Your plan" action={<span className="pill" style={pill(plan.status === 'paused' ? 'warn' : 'neutral')}>{plan.status === 'active' ? 'Active' : plan.status === 'paused' ? 'Paused' : 'Ended'}</span>} />
          <p className="body" style={{ margin: 0, color: 'var(--ink-2)' }}>{plan.planLine}</p>
          {plan.upcoming.length > 0 && (
            <ul className="mg-upcoming">
              {plan.upcoming.map((u) => <li key={u.id}><span style={{ fontWeight: 600 }}>{fmtShort(u.date)}</span><span style={{ color: 'var(--ink-2)' }}>{winShort(u.window)}</span></li>)}
            </ul>
          )}
          {recurring && plan.status !== 'ended' && (
            <div className="mg-actions">
              <button type="button" className="btn btn-secondary btn-sm" disabled={pending} onClick={() => run(() => setPlanPaused(token, plan.id, plan.status === 'active'))}>{plan.status === 'paused' ? 'Resume plan' : 'Pause plan'}</button>
              <button type="button" className="linkbtn linkbtn-danger" disabled={pending} onClick={() => { if (window.confirm('Cancel your plan? Visits more than a day away are cancelled. No fee.')) run(() => cancelPlan(token, plan.id)); }} style={{ padding: '10px 8px' }}>Cancel plan</button>
            </div>
          )}
        </section>
      </div>

      <div className="mg-col">
        <NotesCard {...props} />
        <PaymentCard {...props} />
        <RedoCard {...props} />
      </div>
    </div>
  );
}

// ───────── Pet waste ─────────

function PetOverview(props: OverviewProps) {
  const { token, plan, pending, run } = props;
  const [routeOpen, setRouteOpen] = useState(false);
  const next = plan.next;
  const skipped = plan.skipped;
  const recurring = plan.frequency !== 'one_time';
  return (
    <div className="mg-grid">
      <div className="mg-col">
        <section className="mg-card" aria-labelledby={`pnext-h-${plan.id}`}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span className="small" style={{ color: 'var(--muted)', fontWeight: 600 }} id={`pnext-h-${plan.id}`}>Next visit</span>
              <span className="display" style={{ fontSize: 26, lineHeight: '32px' }}>{next ? fmtLong(next.date) : plan.status === 'paused' ? 'Paused' : 'None scheduled'}</span>
              {next && <span className="body" style={{ color: 'var(--ink-2)' }}>Any time that day — it’s your route day</span>}
            </div>
            <span className="pill" style={pill('ok')}>{plan.freqPill}</span>
          </div>
          <dl className="dl">
            <dt>Service</dt><dd>{plan.serviceLine}</dd>
            <dt>Price</dt><dd>{dollars(plan.pricePerVisitCents)} per visit · {plan.chargeLine}</dd>
            <dt>Gate</dt><dd>{plan.gate || 'None given'}</dd>
          </dl>
          {plan.status !== 'ended' && (
            <>
              <div className="mg-actions">
                {next && recurring && <button type="button" className="btn btn-secondary btn-sm" disabled={pending || !next.terms.allowed} onClick={() => run(() => skipVisit(token, next.id))}>Skip next visit</button>}
                {skipped && <button type="button" className="btn btn-secondary btn-sm" disabled={pending} onClick={() => run(() => undoSkip(token, skipped.id))}>Undo skip ({fmtShort(skipped.date).split(', ')[1]})</button>}
                <button type="button" className="btn btn-secondary btn-sm" disabled={pending} onClick={() => setRouteOpen(!routeOpen)} aria-expanded={routeOpen}>Change route day</button>
                {recurring && <button type="button" className="btn btn-secondary btn-sm" disabled={pending} onClick={() => run(() => setPlanPaused(token, plan.id, plan.status === 'active'))}>{plan.status === 'paused' ? 'Resume plan' : 'Pause plan'}</button>}
              </div>
              {routeOpen && (
                <div className="route-grid" role="group" aria-label="New route day">
                  {ROUTE_DAYS.map((r) => (
                    <button key={r.id} type="button" className="opt" aria-pressed={plan.routeDay === r.id.toLowerCase()} aria-label={r.full} disabled={pending}
                      onClick={() => { setRouteOpen(false); run(() => changeRouteDay(token, plan.id, r.id as RouteDayId)); }} style={{ minHeight: 52, fontSize: 15, fontWeight: 600 }}>
                      {r.id}
                    </button>
                  ))}
                </div>
              )}
              <p className="small" style={{ margin: 0, color: 'var(--muted)' }}>Skip or change by 8 PM the night before your route day.</p>
            </>
          )}
        </section>

        {plan.lastDone && (
          <section className="mg-card" aria-labelledby={`plast-h-${plan.id}`}>
            <SectionHead id={`plast-h-${plan.id}`} title={`Last visit · ${fmtShort(plan.lastDone.date)}`} action={<span className="pill" style={pill('ok')}>Done {doneTime(plan.lastDone.completedAt)}</span>} />
            {plan.lastDone.gatePhotoUrl ? (
              // Plain <img>: a short-lived signed URL from private storage.
              <img src={plan.lastDone.gatePhotoUrl} alt="Your latched gate after the visit" style={{ width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', borderRadius: 12 }} />
            ) : (
              <div role="img" aria-label="No gate photo for this visit" style={{ aspectRatio: '16 / 9', borderRadius: 12, background: 'var(--placeholder)', border: '1px dashed var(--placeholder-line)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 14, fontWeight: 600 }}>Gate photo from the visit</div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              {plan.lastDone.canRequest ? (
                <>
                  <span className="small" style={{ color: 'var(--ink-2)' }}>Missed a spot? You have until {plan.lastDone.requestUntil ? doneTime(plan.lastDone.requestUntil) : ''} tomorrow.</span>
                  <button type="button" className="btn btn-secondary btn-sm" disabled={pending} onClick={() => run(() => requestRedo(token, plan.lastDone!.id, ''))}>Request a re-scoop</button>
                </>
              ) : plan.lastDone.requested ? (
                <span className="small" style={{ fontWeight: 600, color: 'var(--accent)' }}>Re-scoop requested — we’ll text you when.</span>
              ) : null}
            </div>
          </section>
        )}
      </div>

      <div className="mg-col">
        <PaymentCard {...props} />
        <NotesCard {...props} />
        <section className="mg-card" style={{ gap: 10, background: 'var(--accent-soft)', borderColor: 'transparent', boxShadow: 'none' }}>
          <h2 className="display h3">Add a home clean</h2>
          <p className="small" style={{ margin: 0, color: 'var(--ink-2)' }}>Same account, same card. New customers get {OFFER.firstCleanPct}% off their first home clean.</p>
          <Link className="btn btn-primary btn-sm" href="/#booking" style={{ alignSelf: 'flex-start' }}>See home cleaning</Link>
        </section>
        {plan.status !== 'ended' && (
          <button type="button" className="linkbtn linkbtn-danger" disabled={pending} style={{ alignSelf: 'flex-start' }}
            onClick={() => { if (window.confirm('Cancel your yard service? Visits after tomorrow are cancelled. No fee.')) run(() => cancelPlan(token, plan.id)); }}>
            Cancel yard service
          </button>
        )}
      </div>
    </div>
  );
}

// ───────── Reschedule ─────────

function Reschedule({ target, av, pending, error, onBack, onConfirm }: {
  target: VisitView; av: Availability; pending: boolean; error: string; onBack: () => void; onConfirm: (date: string, w: ArrivalWindowId) => void;
}) {
  const days: string[] = [];
  for (let i = 1; days.length < 10 && i <= 60; i++) {
    const d = addDays(av.today, i);
    if (isBookableDate(d, av.today) && !isClosedDate(av, d)) days.push(d);
  }
  const [day, setDay] = useState<string | null>(null);
  const [win, setWin] = useState<ArrivalWindowId>(target.window ?? 'morning');
  const left = day ? windowsLeft(av, day) : null;
  // The visit's own slot doesn't count against itself.
  const free = (d: string, w: ArrivalWindowId) => (windowsLeft(av, d)[w] ?? 0) > 0 || (d === target.date && w === target.window);
  const dayFull = (d: string) => isFullDate(av, d) && d !== target.date;

  return (
    <div className="narrow step-in" style={{ margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Back onClick={onBack} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h1 className="display mg-h1">Reschedule your visit</h1>
        <p className="body" style={{ margin: 0, color: 'var(--ink-2)' }}>
          Moving <strong style={{ color: 'var(--ink)' }}>{fmtLong(target.date)}, {winShort(target.window)}</strong>.{' '}
          {target.terms.free ? `It’s free — you’re more than ${POLICIES.freeChangeHours} hours out.` : target.feeCents > 0 ? 'The late fee for this visit is already applied.' : `You’re less than ${POLICIES.freeChangeHours} hours out, so a $${POLICIES.lateCancelFee} fee applies.`}
        </p>
      </div>
      {error && <ErrorBox text={error} />}
      <div className="mg-card">
        <fieldset style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
          <legend style={{ fontSize: 15, fontWeight: 600, padding: 0, marginBottom: 10 }}>New day</legend>
          <div className="mg-days">
            {days.map((d) => {
              const full = dayFull(d);
              const [dow, md] = fmtShort(d).split(', ');
              return (
                <button key={d} type="button" className="opt" aria-pressed={day === d} disabled={full} onClick={() => { setDay(d); if (!free(d, win)) setWin(ARRIVAL_WINDOWS.find((w) => free(d, w.id))?.id ?? win); }}
                  aria-label={`${fmtLong(d)}${full ? ', fully booked' : ''}`}
                  style={{ minHeight: 60, padding: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'inherit' }}>{dow}</span>
                  <span style={{ fontSize: 16, fontWeight: 600 }}>{md.split(' ')[1]}</span>
                  {full && <span style={{ fontSize: 11, fontWeight: 600 }}>Full</span>}
                </button>
              );
            })}
          </div>
        </fieldset>
        <fieldset style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
          <legend style={{ fontSize: 15, fontWeight: 600, padding: 0, marginBottom: 10 }}>Arrival window</legend>
          <div className="mg-wins">
            {ARRIVAL_WINDOWS.map((w) => (
              <button key={w.id} type="button" className="opt" aria-pressed={win === w.id} disabled={!!day && !!left && !free(day, w.id)} onClick={() => setWin(w.id)}
                style={{ minHeight: 52, padding: 6, fontSize: 15, fontWeight: 600 }}>{w.short}</button>
            ))}
          </div>
        </fieldset>
        <div aria-live="polite" style={{ background: 'var(--paper-2)', borderRadius: 12, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <span className="small" style={{ color: 'var(--ink-2)' }}>New visit</span>
          <span style={{ fontWeight: 600 }}>{day ? `${fmtShort(day)} · ${winShort(win)}` : 'Pick a day'}</span>
        </div>
        <button type="button" className="btn btn-primary btn-busy" disabled={!day || pending} onClick={() => day && onConfirm(day, win)} style={{ width: '100%' }}>
          {pending && <span className="spinner" aria-hidden="true" />}Confirm new time{!target.terms.free && target.feeCents === 0 ? ` · $${POLICIES.lateCancelFee} fee` : ''}
        </button>
        <p className="small" style={{ margin: 0, color: 'var(--muted)', textAlign: 'center' }}>Only this visit moves. The rest of your plan stays on its schedule.</p>
      </div>
    </div>
  );
}

// ───────── Cancel one visit ─────────

function CancelVisit({ target, pending, error, card, oneTime, onBack, onConfirm }: {
  target: VisitView; pending: boolean; error: string; card: string; oneTime: boolean; onBack: () => void; onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState(-1);
  const fee = target.terms.free || target.feeCents > 0 ? 0 : target.terms.feeCents;
  const sms = BRAND.phoneHref.replace('tel:', 'sms:');
  return (
    <div className="narrow step-in" style={{ margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Back onClick={onBack} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h1 className="display mg-h1">Cancel this visit?</h1>
        <p className="body" style={{ margin: 0, color: 'var(--ink-2)' }}>{fmtLong(target.date)}, {winShort(target.window)}. {oneTime ? 'This is your only booked visit.' : 'Your plan continues after this visit.'}</p>
      </div>
      {fee > 0 ? (
        <div role="alert" className="mg-warn">
          <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}><path d="M12 3l9.5 17h-19z" /><path d="M12 10v4" /><path d="M12 17.5h.01" /></svg>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontWeight: 600 }}>Your visit is in {target.terms.hoursUntil} hours, so a {dollars(fee)} fee applies.</span>
            <span className="small" style={{ color: 'var(--ink-2)' }}>Your team is already scheduled. Changes are free until {POLICIES.freeChangeHours} hours before a visit.</span>
          </div>
        </div>
      ) : (
        <div role="status" className="mg-toast" style={{ fontWeight: 400 }}>
          <Check size={20} width={2} stroke="var(--accent)" style={{ flex: 'none' }} />
          <span>Cancelling is free — you’re more than {POLICIES.freeChangeHours} hours out.{target.prepaid ? ` We’ll refund what you paid to ${card}.` : ''}</span>
        </div>
      )}
      {error && <ErrorBox text={error} />}
      <div className="mg-card">
        <fieldset style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
          <legend style={{ fontSize: 15, fontWeight: 600, padding: 0, marginBottom: 10 }}>What’s the reason? <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(optional)</span></legend>
          <div className="mg-reasons">
            {REASONS.map((r, i) => (
              <button key={r} type="button" className="opt" aria-pressed={reason === i} onClick={() => setReason(reason === i ? -1 : i)}
                style={{ minHeight: 52, padding: '8px 12px', fontSize: 15, fontWeight: 600, textAlign: 'left' }}>{r}</button>
            ))}
          </div>
        </fieldset>
        {fee > 0 && <div className="bk-row" style={{ borderTop: '1px solid var(--line)', paddingTop: 14 }}><span style={{ fontWeight: 600 }}>Late cancellation fee</span><span style={{ fontWeight: 600 }}>{dollars(fee)}</span></div>}
        <button type="button" className="btn btn-danger btn-busy" disabled={pending} onClick={() => onConfirm(reason >= 0 ? REASONS[reason] : '')} style={{ width: '100%' }}>
          {pending && <span className="spinner" aria-hidden="true" />}Cancel visit{fee > 0 ? ` · ${dollars(fee)} fee` : ''}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onBack} style={{ width: '100%' }}>Keep my visit</button>
        <p className="small" style={{ margin: 0, color: 'var(--muted)', textAlign: 'center' }}>
          Need to move it instead? Text us at <a className="link" href={sms}>{BRAND.phone}</a> and we’ll try to find a free swap.
        </p>
      </div>
    </div>
  );
}
