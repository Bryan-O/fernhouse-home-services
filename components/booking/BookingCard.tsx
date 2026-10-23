'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Calendar, CalendarRepeat, Key, Lock, Minus, Plus, Sparkle } from '../Icons';
import {
  BRAND,
  CLEAN_FREQ_LABEL,
  CLEAN_SERVICE_LABEL,
  cleanVisitPrice,
  dogsText,
  firstCleanDiscount,
  lookupHome,
  needsPetQuote,
  OFFER,
  PET_FREQ_LABEL,
  PET_FREQS,
  PET_WASTE_PRICING,
  petInitial,
  petVisit,
  PRICING,
  standardFor,
  YARD_CONDITIONS,
  type CleanFrequency,
  type CleanService,
} from '@/lib/config';
import { CONSENT, QUOTE } from '@/lib/messages';
import { toE164 } from '@/lib/booking';
import { requestQuote } from '@/app/actions/booking';
import { pickClean, type CleanStep1, type PetStep1, type ServiceTab } from '@/lib/booking-store';

// ───────── Small parts ─────────

function Counter({ label, value, onDown, onUp, downDisabled, upDisabled, noun }: {
  label?: string; value: string; noun: string;
  onDown: () => void; onUp: () => void; downDisabled: boolean; upDisabled: boolean;
}) {
  return (
    <div className="counter">
      <button type="button" className="stepper-btn" aria-label={`Fewer ${noun}`} onClick={onDown} disabled={downDisabled}><Minus size={18} /></button>
      <output aria-live="polite" aria-label={label} style={{ fontSize: 18, fontWeight: 600 }}>{value}</output>
      <button type="button" className="stepper-btn" aria-label={`More ${noun}`} onClick={onUp} disabled={upDisabled}><Plus size={18} /></button>
    </div>
  );
}

function Badge({ tone, children }: { tone: 'accent' | 'gold'; children: React.ReactNode }) {
  return <span className={`opt-badge opt-badge-${tone}`}>{children}</span>;
}

function SummaryRow({ label, value, accent }: { label: React.ReactNode; value: React.ReactNode; accent?: boolean }) {
  return (
    <div className="small" style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <span style={accent ? { color: 'var(--accent)', fontWeight: 600 } : { color: 'var(--ink-2)' }}>{label}</span>
      <span style={{ fontWeight: 600, color: accent ? 'var(--accent)' : undefined }}>{value}</span>
    </div>
  );
}

function SummaryTotal({ label, price }: { label: string; price: number }) {
  return (
    <div style={{ borderTop: '1px solid var(--line)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
      <span style={{ fontWeight: 600 }}>{label}</span>
      <span className="display" style={{ fontSize: 32, lineHeight: 1 }}>${price}</span>
    </div>
  );
}

function Progress() {
  return (
    <div aria-hidden="true" className="card-progress">
      <span className="on" /><span /><span /><span />
    </div>
  );
}

// ───────── Home cleaning panel ─────────

const SERVICE_TILES: { id: CleanService; label: string; Icon: typeof Sparkle }[] = [
  { id: 'standard', label: 'Standard', Icon: CalendarRepeat },
  { id: 'deep', label: 'Deep', Icon: Sparkle },
  { id: 'move', label: 'Move-In/Out', Icon: Key },
];

function CleanPanel({ clean, setClean }: { clean: CleanStep1; setClean: (c: CleanStep1) => void }) {
  const row = lookupHome(clean.beds, clean.baths);
  const set = (patch: Partial<CleanStep1>) => setClean({ ...clean, ...patch });
  const base = row ? cleanVisitPrice(row, clean.service, clean.freq) : 0;
  const discount = firstCleanDiscount(base);
  const bedLabel = clean.beds > PRICING.maxBeds ? `${PRICING.maxBeds}+` : String(clean.beds);
  const bathLabel = clean.baths > PRICING.maxBaths ? `${PRICING.maxBaths}+` : String(clean.baths);
  const freqLabel = (f: CleanFrequency) => (row ? `$${standardFor(row, f)}${f === 'oneTime' ? '' : '/visit'}` : 'Custom quote');
  const summary = `${CLEAN_SERVICE_LABEL[clean.service]} · ${clean.service === 'standard' ? CLEAN_FREQ_LABEL[clean.freq] : 'One-time'} · ${bedLabel} bd / ${bathLabel} ba`;
  const afterLine =
    clean.service !== 'standard'
      ? 'One-time visit. Price for a home in normal condition.'
      : clean.freq === 'oneTime'
        ? `One-time visit. Switch to biweekly and pay $${row ? standardFor(row, 'biweekly') : ''} per visit.`
        : `Then $${base} per visit, ${CLEAN_FREQ_LABEL[clean.freq].toLowerCase()}. No contracts.`;

  return (
    <div className="tab-body">
      <fieldset className="plain-fieldset">
        <legend className="small legend">Type of clean</legend>
        <div className="grid-3-tight">
          {SERVICE_TILES.map(({ id, label, Icon }) => (
            <button key={id} type="button" className="opt svc-tile" aria-pressed={clean.service === id} onClick={() => set({ service: id })}>
              <Icon stroke="var(--accent)" />
              <span style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.2 }}>{label}</span>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>from ${PRICING.rows[0][id]}</span>
            </button>
          ))}
        </div>
      </fieldset>

      {clean.service === 'standard' && (
        <fieldset className="plain-fieldset">
          <legend className="small legend">How often?</legend>
          <div className="grid-3-tight">
            {(['oneTime', 'weekly', 'biweekly'] as CleanFrequency[]).map((f) => (
              <button key={f} type="button" className="opt freq-tile" aria-pressed={clean.freq === f} onClick={() => set({ freq: f })}>
                {f === 'weekly' && <Badge tone="gold">Save more</Badge>}
                {f === 'biweekly' && <Badge tone="accent">Most popular</Badge>}
                <span style={{ fontSize: 15, fontWeight: 600 }}>{CLEAN_FREQ_LABEL[f]}</span>
                <span className="tile-price">{freqLabel(f)}</span>
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <div className="grid-2-tight">
        <div role="group" aria-label="Bedrooms" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="small" style={{ fontWeight: 600 }}>Bedrooms</span>
          <Counter label="Bedrooms" noun="bedrooms" value={bedLabel}
            onDown={() => set({ beds: Math.max(1, clean.beds - 1) })} onUp={() => set({ beds: Math.min(PRICING.maxBeds + 1, clean.beds + 1) })}
            downDisabled={clean.beds <= 1} upDisabled={clean.beds > PRICING.maxBeds} />
        </div>
        <div role="group" aria-label="Bathrooms" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="small" style={{ fontWeight: 600 }}>Bathrooms</span>
          <Counter label="Bathrooms" noun="bathrooms" value={bathLabel}
            onDown={() => set({ baths: Math.max(1, clean.baths - 1) })} onUp={() => set({ baths: Math.min(PRICING.maxBaths + 1, clean.baths + 1) })}
            downDisabled={clean.baths <= 1} upDisabled={clean.baths > PRICING.maxBaths} />
        </div>
      </div>

      {row ? (
        <div aria-live="polite" className="price-summary">
          <SummaryRow label={summary} value={`$${base}`} />
          <SummaryRow label={`First clean −${OFFER.firstCleanPct}%`} value={`−$${discount}`} accent />
          <SummaryTotal label="First clean total" price={base - discount} />
          <span className="small" style={{ color: 'var(--muted)' }}>{afterLine}</span>
        </div>
      ) : (
        <div aria-live="polite" className="notice" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontWeight: 600 }}>Larger home? Let’s get it right.</span>
          <span className="small" style={{ color: 'var(--ink-2)' }}>
            Homes over {PRICING.maxBeds} bedrooms or {PRICING.maxBaths} bathrooms get a custom quote, so you only pay for what your home needs.
          </span>
          <CallQuoteButton />
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Link className="btn btn-primary" href="/book" aria-disabled={!row || undefined} tabIndex={row ? undefined : -1} style={{ width: '100%' }}>
          Book my clean
          <ArrowRight size={20} />
        </Link>
        <p className="small pay-line">
          <Lock size={16} />
          You pay Fernhouse online — never pay your cleaner directly.
        </p>
      </div>
    </div>
  );
}

function CallQuoteButton() {
  return (
    <a className="btn btn-secondary btn-sm" href={BRAND.phoneHref} style={{ alignSelf: 'flex-start' }}>
      Call {BRAND.phone} for a custom quote
    </a>
  );
}

// ───────── Pet waste panel ─────────

function PetPanel({ pet, setPet, locked }: { pet: PetStep1; setPet: (p: PetStep1) => void; locked: boolean }) {
  const P = PET_WASTE_PRICING;
  const set = (patch: Partial<PetStep1>) => setPet({ ...pet, ...patch });
  const quote = needsPetQuote(pet.dogs, pet.yard === 'large');
  const visit = petVisit(pet.petFreq, pet.dogs);
  const initial = petInitial(pet.petFreq, pet.cond);
  const once = pet.petFreq === 'once';

  return (
    <div className={locked ? 'tab-body tab-body-locked' : 'tab-body'}>
      <fieldset className="plain-fieldset">
        <legend className="small legend">How often?</legend>
        <div className="pet-freqs">
          {PET_FREQS.map((f) => (
            <button key={f.id} type="button" className="opt freq-tile" style={{ minHeight: 60 }} aria-pressed={pet.petFreq === f.id} onClick={() => set({ petFreq: f.id })}>
              {f.popular && <Badge tone="accent">Most popular</Badge>}
              <span style={{ fontSize: 15, fontWeight: 600 }}>{f.label}</span>
              <span className="tile-price">{quote ? 'Quote' : `$${petVisit(f.id, pet.dogs)}${f.id === 'once' ? '' : '/visit'}`}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <div role="group" aria-label="Dogs" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <span className="small" style={{ fontWeight: 600 }}>Dogs</span>
        <div style={{ flex: '0 1 200px' }}>
          <Counter label="Dogs" noun="dogs" value={pet.dogs > P.maxDogs ? `${P.maxDogs + 1}+` : String(pet.dogs)}
            onDown={() => set({ dogs: Math.max(1, pet.dogs - 1) })} onUp={() => set({ dogs: Math.min(P.maxDogs + 1, pet.dogs + 1) })}
            downDisabled={pet.dogs <= 1} upDisabled={pet.dogs > P.maxDogs} />
        </div>
      </div>

      <fieldset className="plain-fieldset">
        <legend className="small legend legend-split">
          <span style={{ whiteSpace: 'nowrap' }}>Yard condition today</span>
          {!quote && (
            <span style={{ fontWeight: 400, color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>
              Over ½ acre? <button type="button" className="inline-link" onClick={() => set({ yard: 'large' })}>Get a quote</button>
            </span>
          )}
        </legend>
        <div className="grid-3-tight" style={{ gap: 6 }}>
          {YARD_CONDITIONS.map((c) => (
            <button key={c.id} type="button" className="opt" aria-pressed={pet.cond === c.id} onClick={() => set({ cond: c.id })}
              style={{ minHeight: 56, padding: 6, fontSize: 14, fontWeight: 600, lineHeight: 1.25 }}>
              {c.label}
            </button>
          ))}
        </div>
      </fieldset>

      {quote ? (
        <QuoteBox title={pet.dogs > P.maxDogs ? QUOTE.titleDogs : QUOTE.titleYard} showBack={pet.yard === 'large'} onBack={() => set({ yard: 'std' })}
          dogs={pet.dogs} overHalfAcre={pet.yard === 'large'} />
      ) : (
        <div aria-live="polite" className="price-summary">
          <SummaryRow label={`${PET_FREQ_LABEL[pet.petFreq]} · ${dogsText(pet.dogs)}`} value={once ? 'Flat yard reset' : `$${visit} / visit`} />
          {initial > 0 && (
            <SummaryRow
              label="Initial yard cleanup"
              value={<>
                {initial === P.initialCleanupWithWeekly && <s style={{ color: 'var(--muted)', fontWeight: 400, marginRight: 6 }}>${P.initialCleanup}</s>}
                ${initial}
              </>}
            />
          )}
          <SummaryTotal label={once ? 'One-time yard reset' : 'First visit'} price={once ? visit : initial || visit} />
          <span className="small" style={{ color: 'var(--muted)' }}>
            {once ? `Charged after the visit. Switch to weekly and pay $${petVisit('weekly', pet.dogs)} per visit.` : `Then $${visit} per visit. No contracts.`}
          </span>
          {initial > 0 && <span className="small" style={{ color: 'var(--muted)' }}>Yard worse than you picked? We’ll text you before charging more.</span>}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Link className="btn btn-primary" href="/book?service=pet-waste" aria-disabled={quote || undefined} tabIndex={quote ? -1 : undefined} style={{ width: '100%' }}>
          Book yard cleanup
          <ArrowRight size={20} />
        </Link>
        <p className="small pay-line">
          <Lock size={16} />
          Charged after each visit. You pay Fernhouse, never anyone directly.
        </p>
        {locked && (
          <div className="small card-footnote">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Calendar size={16} />Route day, not an arrival window</span>
            <a className="link" href="/#booking" onClick={() => pickClean({ service: 'standard' })}>Need a home clean instead?</a>
          </div>
        )}
      </div>
    </div>
  );
}

function QuoteBox({ title, showBack, onBack, dogs, overHalfAcre }: { title: string; showBack: boolean; onBack: () => void; dogs: number; overHalfAcre: boolean }) {
  const [phone, setPhone] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<'phone' | 'failed' | null>(null);
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!toE164(phone)) {
      setError('phone');
      return;
    }
    setBusy(true);
    // The confirmation text goes out once texting is connected (build step 7).
    const r = await requestQuote({ phone, dogs, overHalfAcre }).catch(() => ({ ok: false as const, reason: 'error' as const }));
    setBusy(false);
    if (r.ok) {
      setSent(true);
      setError(null);
    } else {
      setError(r.reason === 'invalid' ? 'phone' : 'failed');
    }
  };
  return (
    <div aria-live="polite" className="notice" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <span style={{ fontWeight: 600 }}>{title}</span>
      {showBack && <button type="button" className="inline-link" style={{ alignSelf: 'flex-start', padding: '4px 0', fontSize: 14 }} onClick={onBack}>Back to standard pricing</button>}
      <span className="small" style={{ color: 'var(--ink-2)' }}>{QUOTE.intro}</span>
      {sent ? (
        <span className="small" style={{ color: 'var(--accent)', fontWeight: 600 }}>{QUOTE.sent(phone)}</span>
      ) : (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <label htmlFor="quote-phone" className="small" style={{ width: '100%', fontWeight: 600 }}>Mobile phone</label>
            <input id="quote-phone" className="input quote-input" type="tel" inputMode="tel" autoComplete="tel" placeholder="(404) 555-0123"
              value={phone} onChange={(e) => setPhone(e.target.value)} aria-invalid={error === 'phone' || undefined} aria-describedby={error ? 'quote-phone-err' : undefined} />
            <button type="button" className="btn btn-primary btn-sm btn-busy" style={{ minHeight: 48 }} onClick={send} disabled={busy}>
              {busy && <span className="spinner" aria-hidden="true" />}Text me a quote
            </button>
          </div>
          {error === 'phone' && <p className="err" id="quote-phone-err">Enter a 10-digit mobile number.</p>}
          {error === 'failed' && <p className="err" id="quote-phone-err">We couldn’t send that just now. Please try again, or call {BRAND.phone}.</p>}
          <p className="consent-line">
            {CONSENT.quote.text} <Link className="link" href="/privacy">Privacy</Link>
          </p>
        </>
      )}
    </div>
  );
}

// ───────── Card ─────────

export function BookingCard({ tab, onTab, clean, setClean, pet, setPet, locked = false }: {
  tab: ServiceTab;
  onTab?: (t: ServiceTab) => void;
  clean: CleanStep1;
  setClean: (c: CleanStep1) => void;
  pet: PetStep1;
  setPet: (p: PetStep1) => void;
  /** Pet waste page: no tab switch, titled for the service. */
  locked?: boolean;
}) {
  return (
    <div id="booking" className="a-widget booking-card">
      {!locked && (
        <div className="seg2" role="group" aria-label="Choose a service">
          <button type="button" className="opt" aria-pressed={tab === 'clean'} onClick={() => onTab?.('clean')}>Home Cleaning</button>
          <button type="button" className="opt" aria-pressed={tab === 'pet'} onClick={() => onTab?.('pet')}>Pet Waste</button>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
          <h2 className="display" style={{ fontSize: 22, lineHeight: '28px' }}>
            {locked ? 'Pet Waste Removal' : tab === 'pet' ? 'Your yard' : 'Your clean'}
          </h2>
          <span className="small" style={{ color: 'var(--muted)', fontWeight: 600 }}>Step 1 of 4</span>
        </div>
        <Progress />
      </div>
      {tab === 'pet' ? (
        <PetPanel key="pet" pet={pet} setPet={setPet} locked={locked} />
      ) : (
        <CleanPanel key="clean" clean={clean} setClean={setClean} />
      )}
    </div>
  );
}
