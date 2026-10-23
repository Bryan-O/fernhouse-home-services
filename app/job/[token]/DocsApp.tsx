'use client';

import { useState } from 'react';
import { uploadSigned } from '@/components/job/upload';
import { saveDoc, startDocUpload } from './actions';
import type { DocsView } from '@/lib/job';
import { BRAND } from '@/lib/config';
import { fmtShort } from '@/lib/booking';

const NAME = { insurance: 'Insurance certificate', bond: 'Bond certificate', background_check: 'Background check' } as const;
const STATUS = {
  verified: { label: 'Verified', cls: 'pill-ok' },
  expiring: { label: 'Expires soon', cls: 'pill-warn' },
  pending: { label: 'Waiting for a check', cls: 'pill-neutral' },
  missing: { label: 'Missing', cls: 'pill-bad' },
  expired: { label: 'Expired', cls: 'pill-bad' },
} as const;

/** Where a pro uploads their insurance, bond and background check (the owner verifies them). */
export function DocsApp({ token, view }: { token: string; view: DocsView }) {
  const [docs, setDocs] = useState(view.docs);
  return (
    <div className="step-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <h1 className="display mg-h1">Your documents</h1>
        <p className="body" style={{ margin: 0, color: 'var(--ink-2)' }}>
          Hi {view.firstName}. {BRAND.name} can only send you jobs while your insurance, bond and background check are on file, checked and in date.
        </p>
      </div>
      {docs.map((d) => (
        <DocCard key={d.kind} token={token} doc={d} onSaved={() => setDocs(docs.map((x) => (x.kind === d.kind ? { ...x, status: 'pending' } : x)))} />
      ))}
      <p className="small" style={{ margin: 0, color: 'var(--muted)' }}>PDF or a clear photo, up to 10 MB. Files are private: only {BRAND.name} can see them.</p>
    </div>
  );
}

function DocCard({ token, doc, onSaved }: { token: string; doc: DocsView['docs'][number]; onSaved: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [inputKey, setInputKey] = useState(0); // remounts the file field so it clears after an upload
  const [expires, setExpires] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const needsDate = doc.kind !== 'background_check';
  const id = `doc-${doc.kind}`;
  const s = STATUS[doc.status];

  const upload = async () => {
    if (!file) return setMsg({ ok: false, text: 'Choose a file first.' });
    if (needsDate && !expires) return setMsg({ ok: false, text: 'Enter the expiry date shown on the certificate.' });
    if (file.size > 10 * 1024 * 1024) return setMsg({ ok: false, text: 'That file is over 10 MB.' });
    setBusy(true);
    setMsg(null);
    try {
      const ext = file.name.split('.').pop() ?? 'pdf';
      const u = await startDocUpload(token, doc.kind, ext);
      if (!u.ok) throw new Error(u.error);
      if (!(await uploadSigned('pro-documents', u.path, u.uploadToken, file))) throw new Error('The file couldn’t be uploaded. Please try again.');
      const r = await saveDoc(token, doc.kind, u.path, expires);
      if (!r.ok) throw new Error(r.error);
      setMsg({ ok: true, text: `Uploaded. ${BRAND.name} will check it and text you if anything’s missing.` });
      setFile(null);
      setInputKey((k) => k + 1);
      onSaved();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mg-card" aria-labelledby={`${id}-h`}>
      <div className="sec-head" style={{ alignItems: 'center' }}>
        <h2 className="display h3" id={`${id}-h`}>{NAME[doc.kind]}</h2>
        <span className={`pill ${s.cls}`}>{s.label}{doc.expiresOn && doc.status !== 'missing' ? ` · ${doc.status === 'expired' ? 'ended' : 'until'} ${fmtShort(doc.expiresOn)}` : ''}</span>
      </div>
      <div className="field">
        <label className="label" htmlFor={`${id}-file`}>Upload a new {NAME[doc.kind].toLowerCase()}</label>
        <input key={inputKey} id={`${id}-file`} type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </div>
      {needsDate && (
        <div className="field">
          <label className="label" htmlFor={`${id}-exp`}>Expiry date</label>
          <input id={`${id}-exp`} className="input" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
        </div>
      )}
      <button type="button" className="btn btn-secondary btn-busy" onClick={upload} disabled={busy} style={{ alignSelf: 'flex-start' }}>
        {busy && <span className="spinner" aria-hidden="true" />}Upload
      </button>
      {msg && <p className={msg.ok ? 'help-ok' : 'err'} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}
    </section>
  );
}
