'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check } from '../Icons';
import { SummaryBar, SummarySide } from './Summary';
import { CleanStep2, CleanStep3, CleanStep4, PetStep2, PetStep3, PetStep4, Waitlist } from './Steps';
import { ErrIcon } from './parts';
import { BOOKING, BRAND, PET_WASTE_PRICING, PRICING } from '@/lib/config';
import { DEFAULT_CLEAN, DEFAULT_PET_STEP1, readClean, readPet } from '@/lib/booking-store';
import {
  isFullDate,
  quoteClean,
  quotePet,
  step2Errors,
  step3Errors,
  toE164,
  type Availability,
  type BookingDraft,
} from '@/lib/booking';
import { getAvailability, joinWaitlist, releaseAttempt, startBooking } from '@/app/actions/booking';

type Step = 2 | 3 | 4;

const DRAFT_KEY = 'booking-draft'; // this tab only (sessionStorage): survives a refresh or a trip to checkout

const EMPTY: Omit<BookingDraft, 'svc' | 'clean' | 'pet'> = {
  zip: '', date: null, window: null, routeDay: null, address: '', unit: '', name: '', phone: '', email: '',
  access: '', pets: false, petNote: '', requests: '', smsPromo: false, gate: '', dogNames: '', dogsFriendly: true,
};

interface Hold {
  ref: string;
  expiresAt: string;
  key: string; // the attempt's idempotency key: a retry after checkout reuses this booking
}

function readDraft(): (Partial<BookingDraft> & { hold?: Hold }) | null {
  try {
    return JSON.parse(window.sessionStorage.getItem(DRAFT_KEY) || 'null');
  } catch {
    return null;
  }
}

function writeDraft(v: BookingDraft & { hold?: Hold | null }) {
  try {
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(v));
  } catch {
    // Storage blocked: the draft just won't survive a refresh.
  }
}

/** "14:32" countdown until the slot hold runs out. */
function useCountdown(until: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!until) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [until]);
  if (!until) return null;
  const secs = Math.max(0, Math.floor((new Date(until).getTime() - now) / 1000));
  return { secs, label: `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}` };
}

export function BookingFlow() {
  const [d, setD] = useState<BookingDraft>({ svc: 'clean', clean: DEFAULT_CLEAN, pet: DEFAULT_PET_STEP1, ...EMPTY });
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState<Step>(2);
  const [av, setAv] = useState<Availability | null>(null);
  const [avError, setAvError] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [monthOffset, setMonthOffset] = useState(0);
  const [gateWarned, setGateWarned] = useState(false);
  const [agree, setAgree] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [hold, setHold] = useState<Hold | null>(null);
  const [noPayments, setNoPayments] = useState(false);
  const [payFailed, setPayFailed] = useState(false);
  const [offerUsed, setOfferUsed] = useState(false);
  const [serverError, setServerError] = useState(false);
  const [wait, setWait] = useState({ phone: '', joined: false, error: null as 'phone' | 'failed' | null, busy: false });
  const attemptKey = useRef<string | null>(null);
  const countdown = useCountdown(payFailed && hold ? hold.expiresAt : null);

  const set = useCallback((patch: Partial<BookingDraft>) => setD((prev) => ({ ...prev, ...patch })), []);

  // Restore Step 1 (home or pet page), then this tab's draft; ?service=pet-waste opens the yard flow.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const clean = readClean();
    const pet = readPet();
    let svc: BookingDraft['svc'] = 'clean';
    try {
      if (window.localStorage.getItem('booking-service') === 'pet') svc = 'pet';
    } catch {}
    if (params.get('service') === 'pet-waste') svc = 'pet';
    const saved = readDraft();
    const { hold: savedHold, ...savedFields } = saved ?? {};
    setD((prev) => ({
      ...prev,
      ...savedFields,
      svc,
      clean: clean && clean.beds <= PRICING.maxBeds && clean.baths <= PRICING.maxBaths ? clean : DEFAULT_CLEAN,
      pet: pet ? { ...pet, dogs: Math.min(pet.dogs, PET_WASTE_PRICING.maxDogs), yard: 'std' } : DEFAULT_PET_STEP1,
    }));
    // Back from checkout without paying: the slot is still held, show the countdown.
    if (params.get('checkout') === 'cancelled' && savedHold && new Date(savedHold.expiresAt) > new Date()) {
      attemptKey.current = savedHold.key;
      setHold(savedHold);
      setPayFailed(true);
      setAgree(true);
      setStep(4);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) writeDraft({ ...d, hold });
  }, [ready, d, hold]);

  const loadAvailability = useCallback(async () => {
    setAvError(false);
    try {
      setAv(await getAvailability());
    } catch {
      setAvError(true);
    }
  }, []);

  useEffect(() => {
    loadAvailability();
  }, [loadAvailability]);

  // Keep the calendar on the chosen month.
  useEffect(() => {
    if (!av || !d.date) return;
    const [ty, tm] = av.today.split('-').map(Number);
    const [y, m] = d.date.split('-').map(Number);
    setMonthOffset(Math.max(0, (y - ty) * 12 + (m - tm)));
    // Only when availability arrives, so paging through months isn't undone.
  }, [av]); // eslint-disable-line react-hooks/exhaustive-deps

  const isPet = d.svc === 'pet';
  const clean = useMemo(() => quoteClean(d.clean, !offerUsed), [d.clean, offerUsed]);
  const pet = useMemo(() => quotePet(d.pet), [d.pet]);
  const e2 = showErrors && step === 2 && av ? step2Errors(d, av) : {};
  const e3 = showErrors && step === 3 ? step3Errors(d) : {};

  const go = (next: Step) => {
    if (next < 4 && hold) {
      // Changing the booking after checkout started: release that attempt; paying again starts fresh.
      releaseAttempt(hold.key).catch(() => {});
      attemptKey.current = null;
      setHold(null);
    }
    setStep(next);
    setShowErrors(false);
    setPayFailed(false);
    setServerError(false);
    window.scrollTo(0, 0);
  };

  const continue2 = () => {
    if (!av) return;
    if (Object.keys(step2Errors(d, av)).length) {
      setShowErrors(true);
      return;
    }
    if (isPet && !d.gate.trim() && !gateWarned) {
      setGateWarned(true);
      return;
    }
    go(3);
  };

  const continue3 = () => {
    if (Object.keys(step3Errors(d)).length) {
      setShowErrors(true);
      return;
    }
    go(4);
  };

  const pay = async () => {
    if (!agree) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    setServerError(false);
    setPayFailed(false); // the new attempt's outcome replaces the old banner
    setSubmitting(true);
    attemptKey.current ??= crypto.randomUUID();
    const r = await startBooking({ draft: d, idempotencyKey: attemptKey.current, acceptFullPrice: offerUsed }).catch(() => ({ ok: false as const, reason: 'error' as const }));
    setSubmitting(false);
    if (r.ok) {
      const h = { ref: r.ref, expiresAt: r.holdExpiresAt, key: attemptKey.current };
      setHold(h);
      setPayFailed(false);
      setRedirecting(true);
      window.scrollTo(0, 0);
      if (r.checkoutUrl) {
        writeDraft({ ...d, hold: h }); // so a cancelled checkout can come back to the countdown
        window.location.assign(r.checkoutUrl);
      } else {
        setNoPayments(true);
      }
      return;
    }
    if (r.reason === 'offer_used') {
      setOfferUsed(true);
      return;
    }
    if (r.reason === 'full' || r.reason === 'date_out_of_range') {
      attemptKey.current = null; // nothing was saved; the next attempt is a new booking
      await loadAvailability();
      setStep(2);
      setShowErrors(true);
      window.scrollTo(0, 0);
      return;
    }
    setServerError(true);
  };

  const joinWait = async () => {
    if (!toE164(wait.phone)) {
      setWait((w) => ({ ...w, error: 'phone' }));
      return;
    }
    setWait((w) => ({ ...w, busy: true, error: null }));
    const r = await joinWaitlist(wait.phone, d.zip).catch(() => ({ ok: false as const, reason: 'error' as const }));
    setWait((w) => ({ ...w, busy: false, joined: r.ok, error: r.ok ? null : r.reason === 'invalid' ? 'phone' : 'failed' }));
  };

  const clearZip = () => {
    set({ zip: '' });
    setWait((w) => ({ ...w, joined: false, error: null }));
    document.getElementById(isPet ? 'pzip' : 'zip')?.focus();
  };

  const loading = !ready || !av;
  const names = isPet ? ['', 'Your yard', 'Route day & access', 'Your details', 'Review & confirm'] : ['', 'Your clean', 'When & where', 'Your details', 'Review & pay'];
  const shownStep = loading ? 2 : step;
  const quoteMissing = isPet ? !pet : !clean;

  const notice = payFailed && countdown ? (
    <div role="alert" style={{ background: '#FEF3F2', border: '1px solid #FDA29B', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 12 }}>
        <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--error)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18" /><path d="M15 15l4-4" /><path d="M19 15l-4-4" /></svg>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <p style={{ margin: 0, fontWeight: 600, color: 'var(--error)' }}>Your payment didn’t go through</p>
          <p className="small" style={{ margin: 0, color: 'var(--ink-2)' }}>
            {countdown.secs > 0 ? `Your slot is held for ${BOOKING.holdMinutes} minutes — try again. You haven’t been charged.` : 'Your slot hold has ended — try again and we’ll check it’s still open. You haven’t been charged.'}
          </p>
        </div>
      </div>
      {countdown.secs > 0 && (
        <div className="small" style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2" /><path d="M9.5 2.5h5" /></svg>
          Slot held for <span aria-live="off" style={{ fontVariantNumeric: 'tabular-nums' }}>{countdown.label}</span>
        </div>
      )}
    </div>
  ) : offerUsed && clean ? (
    <div role="status" className="bk-panel-warn" style={{ padding: 16, gap: 6 }}>
      <p style={{ margin: 0, fontWeight: 600 }}>The first-clean offer has already been used for this home.</p>
      <p className="small" style={{ margin: 0, color: 'var(--ink-2)' }}>It’s once per household, so today’s total is ${clean.total}. Questions? Call {BRAND.phone}.</p>
    </div>
  ) : serverError ? (
    <div role="alert" className="small bk-panel-error">
      <ErrIcon size={20} />
      <span>We couldn’t start your booking just now. Nothing was charged — please try again, or call {BRAND.phone}.</span>
    </div>
  ) : null;

  const reviewProps = {
    d, set, av: av!, agree, onAgree: () => setAgree(!agree), agreeError: showErrors && step === 4 && !agree,
    submitting, notice, onEdit2: () => go(2), onEdit3: () => go(3), onPay: pay,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h1 className="display" style={{ fontSize: 30, lineHeight: '36px' }}>{isPet ? 'Book your yard cleanup' : 'Book your clean'}</h1>
        <ol className="bk-progress" aria-label="Booking steps">
          {[1, 2, 3, 4].map((n) => {
            const current = n === shownStep;
            const done = n < shownStep;
            return (
              <li key={n} className={`pstep${done ? ' is-done' : ''}${current ? ' is-current' : ''}`} aria-current={current ? 'step' : undefined}>
                <span className="pbar" aria-hidden="true" />
                <span className="plabel">
                  {done && <Check size={16} width={2.4} />}
                  <span>{names[n]}</span>
                  {current && <span className="small" style={{ color: 'var(--muted)', fontWeight: 400 }}>· Step {n} of 4</span>}
                </span>
              </li>
            );
          })}
        </ol>
        <p className="pcap" aria-hidden="true">Step {shownStep} of 4 · <span style={{ color: 'var(--ink-2)', fontWeight: 400 }}>{names[shownStep]}</span></p>
      </div>

      <div className="book-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <SummaryBar d={d} clean={clean} pet={pet} loading={loading} dateOk={!!(av && d.date && !isFullDate(av, d.date))} />

          {quoteMissing ? (
            <div className="bk-card" role="status">
              <p className="body" style={{ margin: 0 }}>This home needs a custom quote. Call <a className="link" href={BRAND.phoneHref}>{BRAND.phone}</a>, or <a className="link" href={isPet ? '/pet-waste-removal#booking' : '/#booking'}>change your choices</a>.</p>
            </div>
          ) : avError ? (
            <div className="bk-card" role="alert" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p className="body" style={{ margin: 0 }}>We couldn’t load available times. Please try again, or call {BRAND.phone}.</p>
              <button type="button" className="btn btn-secondary" style={{ alignSelf: 'flex-start' }} onClick={loadAvailability}>Try again</button>
            </div>
          ) : loading ? (
            <div className="bk-card" aria-busy="true" aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <span className="small" style={{ color: 'var(--muted)', fontWeight: 600 }}>Loading available times…</span>
              <span className="skel" style={{ display: 'block', width: '45%', height: 26 }} />
              <span className="skel" style={{ display: 'block', width: '100%', height: 52, borderRadius: 12 }} />
              <div className="cal">{Array.from({ length: 14 }, (_, i) => <span key={i} className="skel" style={{ height: 48, borderRadius: 12 }} />)}</div>
              <div className="win-grid">{[0, 1, 2].map((i) => <span key={i} className="skel" style={{ height: 64, borderRadius: 12 }} />)}</div>
              <span className="skel" style={{ display: 'block', width: '100%', height: 52, borderRadius: 999 }} />
            </div>
          ) : redirecting && hold ? (
            <div className="bk-card step-in" role="status" aria-live="polite" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 16, paddingTop: 56, paddingBottom: 56 }}>
              <span className="spinner spinner-lg" aria-hidden="true" />
              <h2 className="display h3">Taking you to secure checkout…</h2>
              <p className="body" style={{ margin: 0, color: 'var(--ink-2)', maxWidth: 420 }}>You’ll pay Fernhouse through Stripe. We never see or store your card number.</p>
              <p className="small" style={{ margin: 0, color: 'var(--muted)' }}>Please keep this page open.</p>
              {noPayments && (
                // Local preview without Stripe keys only; never shown once payments are connected.
                <p className="small" data-dev-note style={{ margin: 0, color: 'var(--muted)' }}>Payments aren’t connected in this preview. Booking {hold.ref} is held for {BOOKING.holdMinutes} minutes.</p>
              )}
            </div>
          ) : isPet && pet ? (
            step === 2 ? (
              <PetStep2 d={d} set={set} av={av!} e={e2} pet={pet} gateWarned={gateWarned} onClearZip={clearZip} onContinue={continue2} />
            ) : step === 3 ? (
              <PetStep3 d={d} set={set} av={av!} e={e3} errorCount={Object.keys(e3).length} onBack={() => go(2)} onContinue={continue3} />
            ) : (
              <PetStep4 {...reviewProps} pet={pet} />
            )
          ) : clean ? (
            step === 2 ? (
              <CleanStep2 d={d} set={set} av={av!} e={e2} clean={clean} monthOffset={monthOffset} onMonth={setMonthOffset} onContinue={continue2}
                waitlist={<Waitlist zip={d.zip} phone={wait.phone} onPhone={(v) => setWait((w) => ({ ...w, phone: v }))} joined={wait.joined} error={wait.error} busy={wait.busy} onJoin={joinWait} onClearZip={clearZip} />} />
            ) : step === 3 ? (
              <CleanStep3 d={d} set={set} av={av!} e={e3} errorCount={Object.keys(e3).length} onBack={() => go(2)} onContinue={continue3} />
            ) : (
              <CleanStep4 {...reviewProps} clean={clean} payLabel={payFailed ? 'Try payment again' : undefined} />
            )
          ) : null}
        </div>

        <SummarySide d={d} clean={clean} pet={pet} loading={loading} dateOk={!!(av && d.date && !isFullDate(av, d.date))} />
      </div>
    </div>
  );
}
