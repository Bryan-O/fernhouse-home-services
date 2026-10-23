'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check } from '@/components/Icons';
import type { OwnerResult } from '@/app/admin/ops-actions';

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
