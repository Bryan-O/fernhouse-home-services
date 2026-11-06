'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check } from '@/components/Icons';
import type { LinkResult, OwnerResult } from '@/app/admin/ops-actions';

export function OwnerToast({ text }: { text: string }) {
  return (
    <div role="status" className="mg-toast" style={{ marginBottom: 20 }}>
      <Check size={20} stroke="var(--accent)" />
      <span>{text}</span>
    </div>
  );
}

/** A button that runs an owner action, then shows its result next to it and refreshes the page. */
export function ActionButton({ action, label, className = 'btn btn-secondary btn-sm' }: { action: () => Promise<OwnerResult>; label: string; className?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
      <button type="button" className={className} disabled={pending}
        onClick={() => start(async () => {
          const r = await action().catch(() => ({ ok: false as const, error: 'Something went wrong.' }));
          setMsg(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
          router.refresh();
        })}>
        {label}
      </button>
      {msg && <span role={msg.ok ? 'status' : 'alert'} className="small" style={{ color: msg.ok ? 'var(--accent)' : 'var(--error)', fontWeight: 600, textAlign: 'right' }}>{msg.text}</span>}
    </span>
  );
}

/**
 * Makes a fresh link (job or documents), copies it, and shows it so the owner can paste it into
 * a text or WhatsApp. The link stays on screen in case the browser blocks copying.
 */
// Ends a sentence with a name like "Maria G." without a doubled full stop.
const sentence = (name: string) => (name.endsWith('.') ? name : `${name}.`);

export function CopyLinkButton({ action, label, sentTo }: { action: () => Promise<LinkResult>; label: string; sentTo: string }) {
  const [pending, start] = useTransition();
  const [url, setUrl] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const copy = () => start(async () => {
    setMsg(null);
    const r = await action().catch(() => ({ ok: false as const, error: 'Something went wrong. Please try again.' }));
    if (!r.ok) return setMsg({ ok: false, text: r.error });
    setUrl(r.url);
    try {
      await navigator.clipboard.writeText(r.url);
      setMsg({ ok: true, text: `Copied. Paste it into a text to ${sentence(sentTo)}` });
    } catch {
      setMsg({ ok: true, text: `Copy the link below and send it to ${sentence(sentTo)}` });
    }
  });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      <button type="button" className="btn btn-secondary btn-sm btn-busy" onClick={copy} disabled={pending} style={{ alignSelf: 'flex-start' }}>
        {pending && <span className="spinner spinner-dark" aria-hidden="true" />}{label}
      </button>
      {url && (
        <input className="input" readOnly value={url} aria-label={`${label}: the link`} onFocus={(e) => e.currentTarget.select()}
          style={{ minHeight: 44, fontSize: 16 }} />
      )}
      {msg && <p className={msg.ok ? 'help-ok' : 'err'} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}
    </div>
  );
}
