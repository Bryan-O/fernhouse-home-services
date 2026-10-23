'use client';

import Link from 'next/link';
import { Calendar } from './Calendar';
import { ChosenStrip, ContinueButton, FieldError, HelpOk, PayButton, ReviewRow, reviewLine } from './parts';
import { Lock, Pin } from '../Icons';
import { ARRIVAL_WINDOWS, BOOKING, BRAND, cityForZip, OFFER, POLICIES, ROUTE_DAYS } from '@/lib/config';
import { CONSENT } from '@/lib/messages';
import {
  digits,
  firstRouteDate,
  fmtLong,
  fmtShort,
  formatPhone,
  isFullDate,
  openDatesAfter,
  routeLong,
  windowsLeft,
  type Availability,
  type BookingDraft,
  type CleanQuote,
  type PetQuote,
  type Step2Errors,
  type Step3Errors,
} from '@/lib/booking';

export interface StepProps {
  d: BookingDraft;
  set: (patch: Partial<BookingDraft>) => void;
  av: Availability;
}

// ───────── Shared fields ─────────

function ZipField({ d, set, e, id, verb, onClearZip }: StepProps & { e: Step2Errors; id: string; verb: string; onClearZip?: () => void }) {
  const city = cityForZip(d.zip);
  const zip5 = /^\d{5}$/.test(d.zip);
  return (
    <div className="field">
      <label className="label" htmlFor={id}>ZIP code</label>
      <input id={id} className={zip5 && city ? 'input ok' : 'input'} type="text" inputMode="numeric" autoComplete="postal-code" maxLength={5}
        value={d.zip} onChange={(ev) => set({ zip: digits(ev.target.value).slice(0, 5) })}
        aria-invalid={e.zip || undefined} aria-describedby={`${id}-msg`} style={{ maxWidth: 200 }} />
      <div id={`${id}-msg`} aria-live="polite">
        {zip5 && city && <HelpOk>Good news — we {verb} in {city}.</HelpOk>}
        {e.zip && <FieldError>Please enter your ZIP so we can check coverage.</FieldError>}
        {!zip5 && !e.zip && <p className="help">We’ll check that we cover your area.</p>}
        {zip5 && !city && onClearZip && (
          <p className="err" style={{ color: 'var(--warning)' }}>
            <span>We don’t cover {d.zip} yet. <button type="button" className="linkbtn" onClick={onClearZip}>Try another ZIP</button> or call <a className="link" href={BRAND.phoneHref}>{BRAND.phone}</a>.</span>
          </p>
        )}
      </div>
    </div>
  );
}

function AddressFields({ d, set, e, prefix }: StepProps & { e: Step2Errors; prefix: string }) {
  return (
    <div className="row2">
      <div className="field">
        <label className="label" htmlFor={`${prefix}addr`}>Street address</label>
        <input id={`${prefix}addr`} className="input" type="text" autoComplete="street-address" value={d.address}
          onChange={(ev) => set({ address: ev.target.value })} aria-invalid={e.address || undefined} aria-describedby={`${prefix}addr-msg`} />
        <div id={`${prefix}addr-msg`}>{e.address && <FieldError alert>Please enter your street address.</FieldError>}</div>
      </div>
      <div className="field">
        <label className="label" htmlFor={`${prefix}unit`}>Apt / unit <span className="opt-tag">(optional)</span></label>
        <input id={`${prefix}unit`} className="input" type="text" autoComplete="address-line2" value={d.unit} onChange={(ev) => set({ unit: ev.target.value })} />
      </div>
    </div>
  );
}

function ErrorSummary({ count }: { count: number }) {
  if (!count) return null;
  return (
    <div role="alert" className="small bk-panel-error">
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5" /><path d="M12 16.5h.01" /></svg>
      {count === 1 ? 'Please fix 1 field below.' : `Please fix ${count} fields below.`}
    </div>
  );
}

function ContactFields({ d, set, e, prefix, phoneHelp, emailHelp }: StepProps & { e: Step3Errors; prefix: string; phoneHelp: string; emailHelp: string }) {
  return (
    <>
      <div className="field">
        <label className="label" htmlFor={`${prefix}name`}>Full name</label>
        <input id={`${prefix}name`} className="input" type="text" autoComplete="name" value={d.name} onChange={(ev) => set({ name: ev.target.value })}
          aria-invalid={e.name || undefined} aria-describedby={`${prefix}name-msg`} />
        <div id={`${prefix}name-msg`}>{e.name && <FieldError>Please enter your name.</FieldError>}</div>
      </div>
      <div className="row2 row2-even">
        <div className="field">
          <label className="label" htmlFor={`${prefix}phone`}>Mobile phone</label>
          <input id={`${prefix}phone`} className="input" type="tel" inputMode="tel" autoComplete="tel" value={d.phone} onChange={(ev) => set({ phone: ev.target.value })}
            aria-invalid={e.phone || undefined} aria-describedby={`${prefix}phone-msg`} />
          <div id={`${prefix}phone-msg`}>{e.phone ? <FieldError>Please enter a 10-digit mobile number.</FieldError> : <p className="help">{phoneHelp}</p>}</div>
        </div>
        <div className="field">
          <label className="label" htmlFor={`${prefix}email`}>Email</label>
          <input id={`${prefix}email`} className="input" type="email" inputMode="email" autoComplete="email" value={d.email} onChange={(ev) => set({ email: ev.target.value })}
            aria-invalid={e.email || undefined} aria-describedby={`${prefix}email-msg`} />
          <div id={`${prefix}email-msg`}>{e.email ? <FieldError>Please enter a valid email, like name@example.com.</FieldError> : <p className="help">{emailHelp}</p>}</div>
        </div>
      </div>
      <div className="sms-consent" style={{ display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--paper-2)', borderRadius: 12, padding: '12px 14px' }}>
        <p className="small" style={{ margin: 0, color: 'var(--ink-2)' }}>
          {CONSENT.booking.text} See our <Link className="link" href="/privacy">Privacy Policy</Link> and <Link className="link" href="/terms#t-texts">Terms</Link>.
        </p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <input id={`${prefix}sms-promo`} className="check" type="checkbox" checked={d.smsPromo} onChange={() => set({ smsPromo: !d.smsPromo })} />
          <label htmlFor={`${prefix}sms-promo`} className="small" style={{ color: 'var(--ink)', cursor: 'pointer' }}>
            {CONSENT.marketing.text} <span style={{ color: 'var(--muted)' }}>(optional)</span>
          </label>
        </div>
      </div>
    </>
  );
}

function AgreeField({ id, checked, onToggle, disabled, error, children }: { id: string; checked: boolean; onToggle: () => void; disabled: boolean; error: boolean; children: React.ReactNode }) {
  return (
    <div className="field">
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <input id={id} className="check" type="checkbox" checked={checked} onChange={onToggle} disabled={disabled} aria-invalid={error || undefined} aria-describedby={`${id}-msg`} />
        <label htmlFor={id} className="small" style={{ color: 'var(--ink)', cursor: 'pointer' }}>{children}</label>
      </div>
      <div id={`${id}-msg`}>{error && <FieldError alert>Please accept the Terms to continue.</FieldError>}</div>
    </div>
  );
}

// ───────── Cleaning: Step 2 — When & where ─────────

export function CleanStep2({ d, set, av, e, clean, monthOffset, onMonth, waitlist, onContinue }: StepProps & {
  e: Step2Errors;
  clean: CleanQuote;
  monthOffset: number;
  onMonth: (n: number) => void;
  waitlist: React.ReactNode;
  onContinue: () => void;
}) {
  const city = cityForZip(d.zip);
  const zipOut = /^\d{5}$/.test(d.zip) && !city;
  const dateFull = !!d.date && isFullDate(av, d.date);
  const left = d.date ? windowsLeft(av, d.date) : null;
  const pickDate = (iso: string) => {
    const [ty, tm] = av.today.split('-').map(Number);
    const [y, m] = iso.split('-').map(Number);
    set({ date: iso, window: isFullDate(av, iso) ? null : d.window && windowsLeft(av, iso)[d.window] > 0 ? d.window : null });
    onMonth((y - ty) * 12 + (m - tm));
  };

  return (
    <section className="bk-card step-in" aria-labelledby="s2-title" style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 id="s2-title" className="display h3">When &amp; where</h2>
        <ChosenStrip line={clean.line} href="/#booking" />
      </div>

      <ZipField d={d} set={set} av={av} e={e} id="zip" verb="clean" />
      {zipOut && waitlist}

      {!zipOut && (
        <>
          <fieldset className="bk-fieldset">
            <legend className="label" style={{ padding: 0, marginBottom: 12 }}>Pick a date</legend>
            <Calendar av={av} value={d.date} monthOffset={monthOffset} onMonth={onMonth} onPick={(iso) => set({ date: iso, window: isFullDate(av, iso) ? null : d.window && windowsLeft(av, iso)[d.window] > 0 ? d.window : null })} />
            <p className="help">Book up to {BOOKING.windowDays} days ahead. Dates marked “Full” have no open slots.</p>
            {e.date && <FieldError alert>Please pick a date for your clean.</FieldError>}
            {dateFull && d.date && (
              <div role="status" className="bk-panel-warn" style={{ padding: 16, gap: 12 }}>
                <p style={{ margin: 0, fontWeight: 600 }}>{fmtLong(d.date)} is fully booked.</p>
                <p className="small" style={{ margin: 0, color: 'var(--ink-2)' }}>These days have open slots:</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
                  {openDatesAfter(av, d.date, 3).map((iso) => (
                    <button key={iso} type="button" className="opt" onClick={() => pickDate(iso)}
                      style={{ minHeight: 56, padding: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                      <span style={{ fontSize: 13, color: 'var(--muted)' }}>{fmtShort(iso).split(',')[0]}</span>
                      <span style={{ fontSize: 15, fontWeight: 600 }}>{fmtShort(iso).split(', ')[1]}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </fieldset>

          {d.date && !dateFull && left && (
            <fieldset className="bk-fieldset">
              <legend className="label" style={{ padding: 0, marginBottom: 4 }}>Arrival window <span className="opt-tag">· {fmtShort(d.date)}</span></legend>
              <p className="help" style={{ marginTop: -4 }}>Your team arrives any time within your window.</p>
              <div className="win-grid">
                {ARRIVAL_WINDOWS.map((w) => (
                  <button key={w.id} type="button" className="opt bk-tile" aria-pressed={d.window === w.id} disabled={left[w.id] <= 0}
                    aria-label={`${w.label}, arrival ${w.spoken}${left[w.id] <= 0 ? ', full' : ''}`} onClick={() => set({ window: w.id })}>
                    <span style={{ fontSize: 16, fontWeight: 600 }}>{w.label}</span>
                    <span className="small" style={{ color: left[w.id] <= 0 ? 'inherit' : 'var(--ink-2)' }}>{left[w.id] <= 0 ? 'Full' : w.time}</span>
                  </button>
                ))}
              </div>
              {e.window && <FieldError alert>Please pick an arrival window.</FieldError>}
              {e.windowFull && <FieldError alert>That arrival window just filled up — please pick another.</FieldError>}
            </fieldset>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <AddressFields d={d} set={set} av={av} e={e} prefix="" />
            {city && <p className="help">{city}, GA {d.zip}</p>}
          </div>

          <div className="bk-actions">
            <Link href="/#booking" className="btn btn-secondary">Back</Link>
            <ContinueButton onClick={onContinue}>Continue to your details</ContinueButton>
          </div>
        </>
      )}
    </section>
  );
}

/** ZIP outside the area → waitlist (never a dead end). */
export function Waitlist({ zip, phone, onPhone, joined, error, busy, onJoin, onClearZip }: {
  zip: string; phone: string; onPhone: (v: string) => void; joined: boolean; error: 'phone' | 'failed' | null; busy: boolean; onJoin: () => void; onClearZip: () => void;
}) {
  return (
    <div role="status" className="bk-panel-warn">
      <div style={{ display: 'flex', gap: 12 }}>
        <Pin stroke="var(--warning)" style={{ flex: 'none' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <h3 className="display" style={{ fontSize: 18, lineHeight: '24px' }}>We don’t cover {zip} yet — join the waitlist</h3>
          <p className="small" style={{ margin: 0, color: 'var(--ink-2)' }}>We’re expanding across metro Atlanta. Leave your mobile number and we’ll text you the day we start cleaning in your area.</p>
        </div>
      </div>
      {joined ? (
        <HelpOk>You’re on the list. We’ll text {phone} when we reach {zip}.</HelpOk>
      ) : (
        <div className="field">
          <label className="label" htmlFor="wait-phone">Mobile phone</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <input id="wait-phone" className="input" type="tel" autoComplete="tel" inputMode="tel" value={phone} onChange={(ev) => onPhone(ev.target.value)}
              placeholder="(404) 555-0123" style={{ flex: '1 1 200px', width: 'auto' }} aria-invalid={error === 'phone' || undefined} />
            <button type="button" className="btn btn-primary btn-busy" onClick={onJoin} disabled={busy} style={{ flex: '1 1 auto' }}>
              {busy && <span className="spinner" aria-hidden="true" />}Join the waitlist
            </button>
          </div>
          {error === 'phone' && <p className="err" role="alert">Please enter a 10-digit mobile number.</p>}
          {error === 'failed' && <p className="err" role="alert">We couldn’t add you just now. Please try again, or call {BRAND.phone}.</p>}
          <p className="consent-line">{CONSENT.waitlist.text}</p>
        </div>
      )}
      <p className="small" style={{ margin: 0, color: 'var(--ink-2)' }}>
        Typed the wrong ZIP? <button type="button" className="linkbtn" onClick={onClearZip}>Try another ZIP</button> or call <a className="link" href={BRAND.phoneHref}>{BRAND.phone}</a>.
      </p>
    </div>
  );
}

// ───────── Pet waste: Step 2 — Route day & access ─────────

export function PetStep2({ d, set, av, e, pet, gateWarned, onClearZip, onContinue }: StepProps & {
  e: Step2Errors; pet: PetQuote; gateWarned: boolean; onClearZip: () => void; onContinue: () => void;
}) {
  const gateWarn = gateWarned && !d.gate.trim();
  return (
    <section className="bk-card step-in" aria-labelledby="ps2-title" style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 id="ps2-title" className="display h3">Route day &amp; access</h2>
        <ChosenStrip line={pet.line} href="/pet-waste-removal#booking" />
      </div>

      <ZipField d={d} set={set} av={av} e={e} id="pzip" verb="scoop" onClearZip={onClearZip} />

      <fieldset className="bk-fieldset" style={{ gap: 10 }}>
        <legend className="label" style={{ padding: 0, marginBottom: 4 }}>Preferred route day</legend>
        <p className="help" style={{ marginTop: -2 }}>{pet.once ? 'Pick the weekday that suits you for your cleanup.' : 'We scoop on this day every week — it’s your route day.'}</p>
        <div className="route-grid">
          {ROUTE_DAYS.map((r) => (
            <button key={r.id} type="button" className="opt" aria-pressed={d.routeDay === r.id} disabled={av.yard[r.id] <= 0}
              aria-label={r.full + (av.yard[r.id] <= 0 ? ', full' : '')} onClick={() => set({ routeDay: r.id })} style={{ minHeight: 52, fontSize: 15, fontWeight: 600 }}>
              {r.id}
            </button>
          ))}
        </div>
        {d.routeDay && av.yard[d.routeDay] > 0 && <HelpOk>First visit: {fmtLong(firstRouteDate(d.routeDay, av.today))}.</HelpOk>}
        {e.day && <FieldError alert>Please pick a route day.</FieldError>}
        {e.dayFull && <FieldError alert>That route day just filled up — please pick another day.</FieldError>}
      </fieldset>

      <AddressFields d={d} set={set} av={av} e={e} prefix="p" />

      <div className="field">
        <label className="label" htmlFor="gate">Gate code or access notes</label>
        <textarea id="gate" className="input" rows={2} value={d.gate} onChange={(ev) => set({ gate: ev.target.value })} aria-describedby="gate-help" />
        <p id="gate-help" className="help">For example: gate code 2580, side gate on the left, or “gate is always unlocked.”</p>
        {gateWarn && (
          <div role="status" className="small" style={{ background: 'var(--note)', border: '1px solid var(--note-line)', borderRadius: 12, padding: '12px 14px', display: 'flex', gap: 10 }}>
            <span style={{ color: 'var(--warning)', display: 'flex' }}><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none', marginTop: 1 }}><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5" /><path d="M12 16.5h.01" /></svg></span>
            <span>No gate access added yet. Without a code or note, your team may not be able to get in. Add one above, or continue if your gate is always unlocked.</span>
          </div>
        )}
      </div>

      <div className="bk-actions">
        <Link href="/pet-waste-removal#booking" className="btn btn-secondary">Back</Link>
        <ContinueButton onClick={onContinue}>{gateWarn ? 'Continue without gate access' : 'Continue to your details'}</ContinueButton>
      </div>
    </section>
  );
}

// ───────── Step 3 — Your details ─────────

export function CleanStep3({ d, set, av, e, errorCount, onBack, onContinue }: StepProps & { e: Step3Errors; errorCount: number; onBack: () => void; onContinue: () => void }) {
  return (
    <section className="bk-card step-in" aria-labelledby="s3-title" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <h2 id="s3-title" className="display h3">Your details</h2>
        <p className="small" style={{ margin: 0, color: 'var(--muted)' }}>No account or password needed.</p>
      </div>
      <ErrorSummary count={errorCount} />
      <ContactFields d={d} set={set} av={av} e={e} prefix="" phoneHelp="We’ll text your confirmation." emailHelp="For your receipt." />

      <div className="field">
        <label className="label" htmlFor="access">How will your team get in? <span className="opt-tag">(optional)</span></label>
        <textarea id="access" className="input" rows={3} autoComplete="off" value={d.access} onChange={(ev) => set({ access: ev.target.value })} aria-describedby="access-help" />
        <p id="access-help" className="help">For example: key under the mat, a door code, or a garage code. Shared only with your assigned team.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, border: '1px solid var(--line)', borderRadius: 12, padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <span id="pets-label" className="label">Pets at home?</span>
          <button type="button" className="switch" role="switch" aria-checked={d.pets} aria-labelledby="pets-label" onClick={() => set({ pets: !d.pets })} />
        </div>
        {d.pets && (
          <div className="field">
            <label className="label" htmlFor="pet-note" style={{ fontWeight: 400, color: 'var(--ink-2)' }}>Tell your team about them <span className="opt-tag">(optional)</span></label>
            <input id="pet-note" className="input" type="text" value={d.petNote} onChange={(ev) => set({ petNote: ev.target.value })} />
          </div>
        )}
      </div>

      <div className="field">
        <label className="label" htmlFor="requests">Special requests <span className="opt-tag">(optional)</span></label>
        <textarea id="requests" className="input" rows={3} value={d.requests} onChange={(ev) => set({ requests: ev.target.value })} aria-describedby="req-help" />
        <p id="req-help" className="help">Anything to focus on or skip.</p>
      </div>

      <div className="bk-actions">
        <button type="button" className="btn btn-secondary" onClick={onBack}>Back</button>
        <ContinueButton onClick={onContinue}>Review my booking</ContinueButton>
      </div>
    </section>
  );
}

export function PetStep3({ d, set, av, e, errorCount, onBack, onContinue }: StepProps & { e: Step3Errors; errorCount: number; onBack: () => void; onContinue: () => void }) {
  return (
    <section className="bk-card step-in" aria-labelledby="ps3-title" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <h2 id="ps3-title" className="display h3">Your details</h2>
        <p className="small" style={{ margin: 0, color: 'var(--muted)' }}>No account or password needed.</p>
      </div>
      <ErrorSummary count={errorCount} />
      <ContactFields d={d} set={set} av={av} e={e} prefix="p" phoneHelp="Gate photos and updates come by text." emailHelp="For your receipts." />

      <div className="field">
        <label className="label" htmlFor="dognames">Your dogs’ names <span className="opt-tag">(optional)</span></label>
        <input id="dognames" className="input" type="text" value={d.dogNames} onChange={(ev) => set({ dogNames: ev.target.value })} />
      </div>

      <fieldset className="bk-fieldset" style={{ gap: 8 }}>
        <legend className="label" style={{ padding: 0, marginBottom: 8 }}>On your route day, your dogs are…</legend>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
          <button type="button" className="opt bk-tile" aria-pressed={d.dogsFriendly} onClick={() => set({ dogsFriendly: true })} style={{ padding: '8px 10px' }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>Friendly</span>
            <span className="small" style={{ color: 'var(--ink-2)' }}>They can stay out</span>
          </button>
          <button type="button" className="opt bk-tile" aria-pressed={!d.dogsFriendly} onClick={() => set({ dogsFriendly: false })} style={{ padding: '8px 10px' }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>Kept inside</span>
            <span className="small" style={{ color: 'var(--ink-2)' }}>We’ll keep them in</span>
          </button>
        </div>
      </fieldset>

      <div className="field">
        <label className="label" htmlFor="prequests">Anything else? <span className="opt-tag">(optional)</span></label>
        <textarea id="prequests" className="input" rows={2} value={d.requests} onChange={(ev) => set({ requests: ev.target.value })} />
        <p className="help">For example: skip the vegetable garden, or the back corner floods.</p>
      </div>

      <div className="bk-actions">
        <button type="button" className="btn btn-secondary" onClick={onBack}>Back</button>
        <ContinueButton onClick={onContinue}>Review my booking</ContinueButton>
      </div>
    </section>
  );
}

// ───────── Step 4 — Review ─────────

export interface ReviewProps extends StepProps {
  agree: boolean;
  onAgree: () => void;
  agreeError: boolean;
  submitting: boolean;
  notice: React.ReactNode; // payment failed, offer used, or a server error
  payLabel?: string;
  onEdit2: () => void;
  onEdit3: () => void;
  onPay: () => void;
}

export function CleanStep4({ d, clean, agree, onAgree, agreeError, submitting, notice, payLabel, onEdit2, onEdit3, onPay }: ReviewProps & { clean: CleanQuote }) {
  const w = ARRIVAL_WINDOWS.find((x) => x.id === d.window);
  const city = cityForZip(d.zip);
  return (
    <section className="bk-card step-in" aria-labelledby="s4-title" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {notice}
      <h2 id="s4-title" className="display h3">Review &amp; pay</h2>
      <div className="bk-review">
        <ReviewRow label="Your clean" edit={<Link className="link small" href="/#booking" style={{ padding: '4px 0', alignSelf: 'flex-start' }}>Edit</Link>}>
          <span style={{ fontWeight: 600 }}>{clean.line}</span>
        </ReviewRow>
        <ReviewRow label="When & where" edit={<button type="button" className="linkbtn small" onClick={onEdit2} style={{ padding: '4px 0', alignSelf: 'flex-start' }}>Edit</button>}>
          <span style={{ fontWeight: 600 }}>{d.date ? fmtLong(d.date) : ''}</span>
          <span className="small" style={reviewLine}>{w ? `Arrival ${w.spoken}` : ''}</span>
          <span className="small" style={reviewLine}>{d.address.trim()}{d.unit.trim() ? `, ${d.unit.trim()}` : ''}, {city}, GA {d.zip}</span>
        </ReviewRow>
        <ReviewRow label="Your details" edit={<button type="button" className="linkbtn small" onClick={onEdit3} style={{ padding: '4px 0', alignSelf: 'flex-start' }}>Edit</button>}>
          <span style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{d.name.trim()}</span>
          <span className="small" style={reviewLine}>{formatPhone(d.phone)} · {d.email.trim()}</span>
          <span className="small" style={reviewLine}>Access: {d.access.trim() || 'None given'}</span>
          <span className="small" style={reviewLine}>Pets: {d.pets ? `Yes${d.petNote.trim() ? ` — ${d.petNote.trim()}` : ''}` : 'None'}</span>
          {d.requests.trim() && <span className="small" style={reviewLine}>Requests: {d.requests.trim()}</span>}
        </ReviewRow>
      </div>

      <div className="bk-total">
        <div className="bk-row"><span style={{ color: 'var(--ink-2)' }}>Base price</span><span style={{ fontWeight: 600 }}>${clean.base}</span></div>
        {clean.discount > 0 && <div className="bk-row" style={{ color: 'var(--accent)', fontWeight: 600 }}><span>First clean −{OFFER.firstCleanPct}%</span><span>−${clean.discount}</span></div>}
        <div className="bk-row" style={{ borderTop: '1px solid var(--line)', paddingTop: 10, alignItems: 'baseline' }}>
          <span style={{ fontWeight: 600 }}>Total today</span>
          <span className="display" style={{ fontSize: 32, lineHeight: 1 }}>${clean.total}</span>
        </div>
        <span className="small" style={{ color: 'var(--muted)' }}>{clean.afterLine} No hidden fees, ever.</span>
      </div>

      <p className="small" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink-2)', fontWeight: 600 }}>
        <Lock size={18} stroke="var(--accent)" style={{ flex: 'none' }} />You pay Fernhouse online — never pay your cleaner directly.
      </p>

      <AgreeField id="agree" checked={agree} onToggle={onAgree} disabled={submitting} error={agreeError}>
        I agree to the <Link className="link" href="/terms">Terms of Service</Link>, including the cancellation policy: free changes until {POLICIES.freeChangeHours} hours before your visit, ${POLICIES.lateCancelFee} after that.
      </AgreeField>

      <div className="bk-actions">
        <button type="button" className="btn btn-secondary" onClick={onEdit3} disabled={submitting}>Back</button>
        <PayButton busy={submitting} label={payLabel ?? `Pay $${clean.total} securely`} onClick={onPay} />
      </div>
      <p className="small pay-note">Secure checkout by Stripe</p>
    </section>
  );
}

export function PetStep4({ d, av, pet, agree, onAgree, agreeError, submitting, notice, onEdit2, onEdit3, onPay }: ReviewProps & { pet: PetQuote }) {
  const city = cityForZip(d.zip);
  return (
    <section className="bk-card step-in" aria-labelledby="ps4-title" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {notice}
      <h2 id="ps4-title" className="display h3">Review &amp; confirm</h2>
      <div className="bk-review">
        <ReviewRow label="Your yard" edit={<Link className="link small" href="/pet-waste-removal#booking" style={{ padding: '4px 0', alignSelf: 'flex-start' }}>Edit</Link>}>
          <span style={{ fontWeight: 600 }}>{pet.line}</span>
        </ReviewRow>
        <ReviewRow label="Route day & access" edit={<button type="button" className="linkbtn small" onClick={onEdit2} style={{ padding: '4px 0', alignSelf: 'flex-start' }}>Edit</button>}>
          <span style={{ fontWeight: 600 }}>{d.routeDay ? routeLong(d.pet, d.routeDay) : ''}</span>
          <span className="small" style={reviewLine}>{d.routeDay ? `First visit: ${fmtLong(firstRouteDate(d.routeDay, av.today))}.` : ''}</span>
          <span className="small" style={reviewLine}>{d.address.trim()}{d.unit.trim() ? `, ${d.unit.trim()}` : ''}, {city}, GA {d.zip}</span>
          <span className="small" style={reviewLine}>Gate: {d.gate.trim() || 'None given'}</span>
        </ReviewRow>
        <ReviewRow label="Your details" edit={<button type="button" className="linkbtn small" onClick={onEdit3} style={{ padding: '4px 0', alignSelf: 'flex-start' }}>Edit</button>}>
          <span style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{d.name.trim()}</span>
          <span className="small" style={reviewLine}>{formatPhone(d.phone)} · {d.email.trim()}</span>
          <span className="small" style={reviewLine}>Dogs: {d.dogNames.trim() ? `${d.dogNames.trim()} — ` : ''}{d.dogsFriendly ? 'friendly, can stay out' : 'kept inside on route day'}</span>
        </ReviewRow>
      </div>

      <div className="bk-total">
        <div className="bk-row"><span style={{ color: 'var(--ink-2)' }}>{pet.once ? 'One-time yard reset' : 'Per visit'}</span><span style={{ fontWeight: 600 }}>${pet.visit}</span></div>
        {pet.initial > 0 && <div className="bk-row"><span style={{ color: 'var(--ink-2)' }}>First-visit cleanup ({pet.condLabel})</span><span style={{ fontWeight: 600 }}>${pet.initial}</span></div>}
        <div className="bk-row" style={{ borderTop: '1px solid var(--line)', paddingTop: 10, alignItems: 'baseline' }}>
          <span style={{ fontWeight: 600 }}>First visit</span>
          <span className="display" style={{ fontSize: 32, lineHeight: 1 }}>${pet.firstTotal}</span>
        </div>
        <span className="small" style={{ color: 'var(--muted)' }}>{pet.afterLine} Nothing is charged today.</span>
        {pet.initial > 0 && <span className="small" style={{ color: 'var(--muted)' }}>If your first visit needs more cleanup than you picked, we’ll text you before charging the higher rate.</span>}
      </div>

      <p className="small" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink-2)', fontWeight: 600 }}>
        <Lock size={18} stroke="var(--accent)" style={{ flex: 'none' }} />You pay Fernhouse online after each visit — never anyone directly.
      </p>

      <AgreeField id="pagree" checked={agree} onToggle={onAgree} disabled={submitting} error={agreeError}>
        I agree to the <Link className="link" href="/terms">Terms of Service</Link>, including the {POLICIES.guaranteeWindow.replace(' hours', '-hour')} re-scoop guarantee and free changes until {POLICIES.freeChangeHours} hours before a visit.
      </AgreeField>

      <div className="bk-actions">
        <button type="button" className="btn btn-secondary" onClick={onEdit3} disabled={submitting}>Back</button>
        <PayButton busy={submitting} label="Confirm & save card" onClick={onPay} />
      </div>
      <p className="small pay-note">Card saved securely with Stripe</p>
    </section>
  );
}
