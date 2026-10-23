'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from './Icons';
import { CLEAN_SERVICE_LABEL, firstCleanTotal, OFFER, PRICING, type CleanService } from '@/lib/config';
import { pickClean } from '@/lib/booking-store';

const SERVICES: { id: CleanService; label: string }[] = [
  { id: 'standard', label: 'Standard' },
  { id: 'deep', label: 'Deep' },
  { id: 'move', label: 'Move-In/Out' },
];

function PopularTag() {
  return <span className="tag-popular">Most popular</span>;
}

/** Home page pricing: pick a type and size to see one price, plus the full price list. */
export function PricingExplorer() {
  const [service, setService] = useState<CleanService>('standard');
  const [rowIdx, setRowIdx] = useState(Math.max(0, PRICING.rows.findIndex((r) => r.popular)));
  const [tableOpen, setTableOpen] = useState(false);
  const row = PRICING.rows[rowIdx];
  const price = row[service];
  const sizeLabel = (r: { bd: number; ba: number }) => `${r.bd} bd / ${r.ba} ba`;

  return (
    <>
      <div className="explorer card">
        <div className="explorer-pick">
          <div role="group" aria-label="Type of clean" className="seg3">
            {SERVICES.map((s) => (
              <button key={s.id} type="button" className="opt" aria-pressed={service === s.id} onClick={() => setService(s.id)}>{s.label}</button>
            ))}
          </div>
          <div role="group" aria-label="Home size" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span className="small" style={{ fontWeight: 600 }}>Home size</span>
            <div className="size-grid">
              {PRICING.rows.map((r, i) => (
                <button key={sizeLabel(r)} type="button" className="opt size-pill" aria-pressed={rowIdx === i} onClick={() => setRowIdx(i)}>{sizeLabel(r)}</button>
              ))}
            </div>
          </div>
        </div>
        <div aria-live="polite" className="explorer-result">
          {row.popular && service === 'standard' && <span className="small tag-popular-lg">Most popular</span>}
          <span className="small" style={{ color: 'var(--ink-2)', fontWeight: 600 }}>{CLEAN_SERVICE_LABEL[service]} · {sizeLabel(row)}</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span className="display" style={{ fontSize: 48, lineHeight: 1 }}>${price}</span>
            <span style={{ color: 'var(--muted)', fontWeight: 600 }}>/ visit</span>
          </div>
          <span className="small" style={{ color: 'var(--ink-2)' }}>
            {service === 'standard' ? 'biweekly recurring' : 'one-time visit'} · first clean ${firstCleanTotal(price)} with {OFFER.firstCleanPct}% off
          </span>
          <Link
            className="btn btn-primary"
            href="/book"
            style={{ marginTop: 12, width: '100%' }}
            onClick={() => pickClean({ service, beds: row.bd, baths: row.ba, ...(service === 'standard' ? { freq: 'biweekly' } : {}) })}
          >
            Book my clean
          </Link>
        </div>
      </div>

      <button type="button" className="btn btn-secondary see-all" aria-expanded={tableOpen} aria-controls="price-cards" onClick={() => setTableOpen(!tableOpen)} style={{ width: '100%' }}>
        {tableOpen ? 'Hide full price list' : 'See full price list'}
        <ChevronDown size={20} className={tableOpen ? 'chev open' : 'chev'} />
      </button>

      <div className="price-table">
        <table>
          <caption className="small">Full price list — starting price per visit</caption>
          <thead>
            <tr>
              <th scope="col">Home size</th>
              <th scope="col">Standard (biweekly)</th>
              <th scope="col">Deep</th>
              <th scope="col">Move-In/Out</th>
            </tr>
          </thead>
          <tbody>
            {PRICING.rows.map((r) => (
              <tr key={sizeLabel(r)}>
                <th scope="row">{sizeLabel(r)}</th>
                <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}><strong>${r.standard}</strong>{r.popular && <PopularTag />}</span></td>
                <td><strong>${r.deep}</strong></td>
                <td><strong>${r.move}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div id="price-cards" className={tableOpen ? 'price-cards open' : 'price-cards'}>
        {PRICING.rows.map((r) => (
          <div key={sizeLabel(r)} className="price-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontWeight: 600 }}>{sizeLabel(r)}</span>
              {r.popular && <PopularTag />}
            </div>
            <div className="small" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
              <div className="price-cell"><span>Standard</span><strong>${r.standard}</strong></div>
              <div className="price-cell"><span>Deep</span><strong>${r.deep}</strong></div>
              <div className="price-cell"><span>Move</span><strong>${r.move}</strong></div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
