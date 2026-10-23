'use client';

import { useState } from 'react';
import { ChevronDown } from './Icons';

/** One-open-at-a-time FAQ accordion. */
export function Faq({ title, items }: { title: string; items: readonly (readonly [string, string])[] }) {
  const [open, setOpen] = useState(-1);
  return (
    <section id="faq" aria-label={title} style={{ background: '#FFFFFF' }}>
      <div className="wrap sec" style={{ maxWidth: 820, display: 'flex', flexDirection: 'column', gap: 24 }}>
        <h2 className="display h2">{title}</h2>
        <div style={{ borderTop: '1px solid var(--line)' }}>
          {items.map(([q, a], i) => {
            const isOpen = open === i;
            return (
              <div key={q} style={{ borderBottom: '1px solid var(--line)' }}>
                <h3 style={{ margin: 0 }}>
                  <button type="button" className="faq-q" id={`faq-q-${i}`} aria-expanded={isOpen} aria-controls={`faq-a-${i}`} onClick={() => setOpen(isOpen ? -1 : i)}>
                    {q}
                    <ChevronDown size={22} className={isOpen ? 'chev open' : 'chev'} />
                  </button>
                </h3>
                <div className={isOpen ? 'faq-panel open' : 'faq-panel'} id={`faq-a-${i}`} role="region" aria-labelledby={`faq-q-${i}`}>
                  <div>
                    <p className="body" style={{ margin: 0, padding: '0 40px 20px 0', color: 'var(--ink-2)', maxWidth: '65ch' }}>{a}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
