'use client';

import { useState } from 'react';
import { Check } from '@/components/Icons';
import { sendManageLink } from './actions';
import { formatPhone, toE164 } from '@/lib/booking';
import { BRAND, LINKS } from '@/lib/config';

export function FindForm({ expired }: { expired: boolean }) {
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
    const r = await sendManageLink(phone).catch(() => null);
    setBusy(false);
    if (!r) setError('failed');
    else if (!r.ok) setError('phone');
    else {
      setError(null);
      setSent(true);
    }
  };

  return (
    <div className="narrow step-in" style={{ margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h1 className="display mg-h1">Manage your booking</h1>
        <p className="body" style={{ margin: 0, color: 'var(--ink-2)' }}>
          {expired ? 'That link has expired. ' : ''}Enter the mobile number you booked with. We’ll text you a secure link — no password needed.
        </p>
      </div>
      <div className="mg-card">
        {sent ? (
          <>
            <div role="status" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span aria-hidden="true" style={{ flex: 'none', width: 40, height: 40, borderRadius: '50%', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Check size={20} width={2} stroke="var(--accent)" />
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontWeight: 600 }}>Check your texts</span>
                <span className="small" style={{ color: 'var(--ink-2)' }}>If {formatPhone(phone)} has a booking with us, a link is on its way. It can take a minute.</span>
              </div>
            </div>
            <button type="button" className="linkbtn" onClick={() => { setSent(false); setPhone(''); }} style={{ alignSelf: 'flex-start' }}>Use a different number</button>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label htmlFor="find-phone" style={{ fontSize: 15, fontWeight: 600 }}>Mobile phone</label>
              <input id="find-phone" className="input" type="tel" inputMode="tel" autoComplete="tel" placeholder="(404) 555-0123" value={phone}
                onChange={(e) => { setPhone(e.target.value); setError(null); }} aria-invalid={error === 'phone' || undefined} aria-describedby="find-msg"
                onKeyDown={(e) => { if (e.key === 'Enter') send(); }} />
              <div id="find-msg">
                {error === 'phone' && <p className="err" role="alert">Please enter the 10-digit mobile number you booked with.</p>}
                {error === 'failed' && <p className="err" role="alert">We couldn’t send that just now. Please try again, or call {BRAND.phone}.</p>}
              </div>
            </div>
            <button type="button" className="btn btn-primary btn-busy" onClick={send} disabled={busy} style={{ width: '100%' }}>
              {busy && <span className="spinner" aria-hidden="true" />}Text me a link
            </button>
            <p className="small" style={{ margin: 0, color: 'var(--muted)' }}>The link works for {LINKS.manageLinkDays} days. Msg &amp; data rates may apply.</p>
          </>
        )}
      </div>
      <p className="small" style={{ margin: 0, color: 'var(--ink-2)', textAlign: 'center' }}>
        Changed your number? Call <a className="link" href={BRAND.phoneHref}>{BRAND.phone}</a>.
      </p>
    </div>
  );
}
