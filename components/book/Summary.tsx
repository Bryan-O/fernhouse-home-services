'use client';

import { useState } from 'react';
import { Check, ChevronDown, Redo, Shield } from '../Icons';
import { ARRIVAL_WINDOWS, cityForZip, CLEAN_SERVICE_LABEL, dogsText, OFFER, PET_FREQ_LABEL, POLICIES } from '@/lib/config';
import { fmtShort, routeShort, type BookingDraft, type CleanQuote, type PetQuote } from '@/lib/booking';

export interface SummaryProps {
  d: BookingDraft;
  clean: CleanQuote | null;
  pet: PetQuote | null;
  loading: boolean;
  dateOk: boolean; // a date is chosen and isn't full
}

function whenShort({ d, dateOk }: SummaryProps) {
  if (!d.date || !dateOk) return 'Pick a date';
  const w = ARRIVAL_WINDOWS.find((x) => x.id === d.window);
  return fmtShort(d.date) + (w ? ` · ${w.time}` : '');
}

function whereShort(d: BookingDraft) {
  if (d.address.trim()) return d.address.trim();
  const city = cityForZip(d.zip);
  return city ? `${city}, GA` : '—';
}

const discountLabel = `First clean −${OFFER.firstCleanPct}%`;

/** Desktop: sticky "Your booking" card beside the steps. */
export function SummarySide(props: SummaryProps) {
  const { d, clean, pet, loading } = props;
  const isPet = d.svc === 'pet';
  return (
    <aside className="summary-side" aria-label="Booking summary">
      <div className="bk-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h2 className="display" style={{ fontSize: 18, lineHeight: '24px' }}>Your booking</h2>
        {loading ? (
          <div aria-busy="true" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span className="skel" style={{ height: 18, width: '80%' }} />
            <span className="skel" style={{ height: 18, width: '60%' }} />
            <span className="skel" style={{ height: 18, width: '70%' }} />
            <span className="skel" style={{ height: 36, width: '50%' }} />
          </div>
        ) : isPet && pet ? (
          <>
            <dl className="small sum-dl">
              <dt>Service</dt><dd>Pet waste, {PET_FREQ_LABEL[d.pet.petFreq].toLowerCase()}</dd>
              <dt>Dogs</dt><dd>{dogsText(d.pet.dogs)}</dd>
              <dt>Route day</dt><dd>{routeShort(d.pet, d.routeDay)}</dd>
              <dt>Where</dt><dd>{whereShort(d)}</dd>
            </dl>
            <div style={{ borderTop: '1px solid var(--line)', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="small bk-row"><span style={{ color: 'var(--ink-2)' }}>{pet.once ? 'One-time yard reset' : 'Per visit'}</span><span style={{ fontWeight: 600 }}>${pet.visit}</span></div>
              {pet.initial > 0 && <div className="small bk-row"><span style={{ color: 'var(--ink-2)' }}>First-visit cleanup</span><span style={{ fontWeight: 600 }}>${pet.initial}</span></div>}
              <div className="bk-row" style={{ alignItems: 'baseline', paddingTop: 8 }}><span style={{ fontWeight: 600 }}>First visit</span><span className="display" style={{ fontSize: 30, lineHeight: 1 }}>${pet.firstTotal}</span></div>
              <span className="small" style={{ color: 'var(--muted)' }}>{pet.afterLine}</span>
            </div>
          </>
        ) : clean ? (
          <>
            <dl className="small sum-dl">
              <dt>Clean</dt><dd>{CLEAN_SERVICE_LABEL[d.clean.service]}, {clean.freqName.toLowerCase()}</dd>
              <dt>Home</dt><dd>{clean.sizeLabel}</dd>
              <dt>When</dt><dd>{whenShort(props)}</dd>
              <dt>Where</dt><dd>{whereShort(d)}</dd>
            </dl>
            <div style={{ borderTop: '1px solid var(--line)', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="small bk-row"><span style={{ color: 'var(--ink-2)' }}>Base price</span><span style={{ fontWeight: 600 }}>${clean.base}</span></div>
              {clean.discount > 0 && <div className="small bk-row" style={{ color: 'var(--accent)', fontWeight: 600 }}><span>{discountLabel}</span><span>−${clean.discount}</span></div>}
              <div className="bk-row" style={{ alignItems: 'baseline', paddingTop: 8 }}><span style={{ fontWeight: 600 }}>Total today</span><span className="display" style={{ fontSize: 30, lineHeight: 1 }}>${clean.total}</span></div>
              <span className="small" style={{ color: 'var(--muted)' }}>{clean.afterLine}</span>
            </div>
          </>
        ) : null}
        <div className="small" style={{ borderTop: '1px solid var(--line)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 8, color: 'var(--ink-2)' }}>
          <span style={{ display: 'flex', gap: 8 }}><Shield size={18} stroke="var(--accent)" style={{ flex: 'none' }} />Vetted, bonded &amp; insured</span>
          <span style={{ display: 'flex', gap: 8 }}><Redo size={18} stroke="var(--gold)" style={{ flex: 'none' }} />{isPet ? 'Re-scoop' : 'Re-clean'} guarantee, {POLICIES.guaranteeWindow}</span>
          <span style={{ display: 'flex', gap: 8 }}><Check size={18} width={1.5} stroke="var(--accent)" style={{ flex: 'none' }} />No contracts</span>
        </div>
      </div>
    </aside>
  );
}

/** Phone/tablet: collapsible price bar above the step. */
export function SummaryBar(props: SummaryProps) {
  const { d, clean, pet, loading } = props;
  const [open, setOpen] = useState(false);
  const isPet = d.svc === 'pet';
  const label = isPet ? `Pet waste · ${PET_FREQ_LABEL[d.pet.petFreq]}` : clean ? `${CLEAN_SERVICE_LABEL[d.clean.service]} · ${clean.freqName}` : '';
  const priceLabel = isPet ? (pet?.once ? 'Cleanup' : 'Per visit') : 'First clean';
  const price = isPet ? pet?.visit : clean?.total;
  return (
    <div className="summary-bar card" style={{ padding: 0, overflow: 'hidden' }}>
      <button type="button" aria-expanded={open} aria-controls="sum-m" onClick={() => setOpen(!open)}
        style={{ width: '100%', minHeight: 60, padding: '12px 16px', background: 'none', border: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontFamily: 'inherit', color: 'var(--ink)', cursor: 'pointer', textAlign: 'left' }}>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className="small" style={{ color: 'var(--muted)' }}>{label}</span>
          {loading ? <span className="skel" style={{ display: 'block', width: 120, height: 22 }} /> : <span style={{ fontWeight: 600 }}>{priceLabel} <strong style={{ fontSize: 20 }}>${price}</strong></span>}
        </span>
        <span className="small" style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--accent)', fontWeight: 600 }}>
          {open ? 'Hide' : 'Details'}
          <ChevronDown size={18} className={open ? 'chev open' : 'chev'} />
        </span>
      </button>
      {open && (
        <div id="sum-m" className="small" style={{ borderTop: '1px solid var(--line)', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {isPet && pet ? (
            <>
              <div className="bk-row"><span style={{ color: 'var(--ink-2)' }}>{pet.line}</span><span style={{ fontWeight: 600 }}>{pet.once ? `$${pet.visit}` : `$${pet.visit} / visit`}</span></div>
              {pet.initial > 0 && <div className="bk-row"><span style={{ color: 'var(--ink-2)' }}>First-visit cleanup ({pet.condLabel})</span><span style={{ fontWeight: 600 }}>${pet.initial}</span></div>}
              <div className="bk-row"><span style={{ color: 'var(--ink-2)' }}>Route day</span><span style={{ fontWeight: 600, textAlign: 'right' }}>{routeShort(d.pet, d.routeDay)}</span></div>
              <span style={{ color: 'var(--muted)' }}>{pet.afterLine}</span>
            </>
          ) : clean ? (
            <>
              <div className="bk-row"><span style={{ color: 'var(--ink-2)' }}>{clean.line}</span><span style={{ fontWeight: 600 }}>${clean.base}</span></div>
              {clean.discount > 0 && <div className="bk-row" style={{ color: 'var(--accent)', fontWeight: 600 }}><span>{discountLabel}</span><span>−${clean.discount}</span></div>}
              <div className="bk-row"><span style={{ color: 'var(--ink-2)' }}>When</span><span style={{ fontWeight: 600, textAlign: 'right' }}>{whenShort(props)}</span></div>
              <div className="bk-row" style={{ borderTop: '1px solid var(--line)', paddingTop: 8 }}><span style={{ fontWeight: 600 }}>Total today</span><span style={{ fontWeight: 600 }}>${clean.total}</span></div>
              <span style={{ color: 'var(--muted)' }}>{clean.afterLine}</span>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
