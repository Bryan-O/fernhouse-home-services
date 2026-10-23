import Link from 'next/link';
import { ArrowRight, Check, Lock } from '../Icons';

/** Circled "!" used before every field error in the design. */
export function ErrIcon({ size = 18 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none', marginTop: 1 }}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5" />
      <path d="M12 16.5h.01" />
    </svg>
  );
}

export function FieldError({ id, children, alert }: { id?: string; children: React.ReactNode; alert?: boolean }) {
  return (
    <p className="err" id={id} role={alert ? 'alert' : undefined}>
      <ErrIcon />
      {children}
    </p>
  );
}

export function HelpOk({ children }: { children: React.ReactNode }) {
  return (
    <p className="help-ok">
      <Check size={16} width={2.4} />
      <span>{children}</span>
    </p>
  );
}

/** "Standard · Biweekly · 3 bd / 2 ba  [Change]" strip at the top of Step 2. */
export function ChosenStrip({ line, href }: { line: string; href: string }) {
  return (
    <div className="small bk-chosen">
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
        <Check size={18} width={2} stroke="var(--accent)" />
        {line}
      </span>
      <Link href={href} className="link tap-link" style={{ padding: '0 10px' }}>Change</Link>
    </div>
  );
}

export function ContinueButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className="btn btn-primary" onClick={onClick}>
      {children}
      <ArrowRight size={20} />
    </button>
  );
}

export function PayButton({ busy, label, onClick }: { busy: boolean; label: string; onClick: () => void }) {
  return busy ? (
    <button type="button" className="btn btn-primary btn-busy" disabled aria-busy="true" style={{ minWidth: 240 }}>
      <span className="spinner" aria-hidden="true" />
      Booking…
    </button>
  ) : (
    <button type="button" className="btn btn-primary" onClick={onClick} style={{ minWidth: 240 }}>
      <Lock size={18} />
      {label}
    </button>
  );
}

/** Review card row: label, content lines and an Edit action. */
export function ReviewRow({ label, children, edit }: { label: string; children: React.ReactNode; edit: React.ReactNode }) {
  return (
    <div>
      <div className="bk-review-body">
        <span className="small" style={{ color: 'var(--muted)', fontWeight: 600 }}>{label}</span>
        {children}
      </div>
      {edit}
    </div>
  );
}

export const reviewLine = { color: 'var(--ink-2)', overflowWrap: 'anywhere' } as const;
