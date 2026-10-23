'use client';

import { useState } from 'react';
import { ActionButton } from '@/components/admin/OwnerBits';
import { uploadSigned } from '@/components/job/upload';
import { deleteDoc, saveOwnerDoc, sendDocsLink, startOwnerDocUpload, verifyDoc } from '@/app/admin/ops-actions';
import type { ProDetail } from '@/lib/ops';
import { fmtShort } from '@/lib/booking';
import { PRO_REQUIRED_DOCUMENTS } from '@/lib/config';
import { useRouter } from 'next/navigation';

const NAME = { insurance: 'Insurance', bond: 'Bond certificate', background_check: 'Background check' } as const;

export function ProDocs({ pro }: { pro: ProDetail }) {
  const router = useRouter();
  const [kind, setKind] = useState<(typeof PRO_REQUIRED_DOCUMENTS)[number]>('insurance');
  const [file, setFile] = useState<File | null>(null);
  const [inputKey, setInputKey] = useState(0); // remounts the file field so it clears after an upload
  const [exp, setExp] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const upload = async () => {
    if (!file) return setMsg({ ok: false, text: 'Choose a file first.' });
    setBusy(true);
    setMsg(null);
    const u = await startOwnerDocUpload(pro.id, kind, file.name.split('.').pop() ?? 'pdf');
    const ok = u.ok && (await uploadSigned('pro-documents', u.path, u.uploadToken, file));
    const r = ok && u.ok ? await saveOwnerDoc(pro.id, kind, u.path, exp) : { ok: false as const, error: u.ok ? 'The file couldn’t be uploaded.' : u.error };
    setMsg(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
    setBusy(false);
    if (r.ok) { setFile(null); setExp(''); setInputKey((k) => k + 1); router.refresh(); }
  };

  return (
    <section className="mg-card" aria-labelledby="docs-h">
      <div className="sec-head" style={{ alignItems: 'center' }}>
        <h2 className="display h3" id="docs-h">Documents</h2>
        <ActionButton action={sendDocsLink.bind(null, pro.id)} label="Text upload link" className="linkbtn" />
      </div>
      {pro.docs.length ? (
        <ul className="block-list">
          {pro.docs.map((d) => (
            <li key={d.id} style={{ flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontWeight: 600 }}>{d.label}{d.expiresOn ? ` · until ${fmtShort(d.expiresOn)}` : ''}</span>
                <span className="small" style={{ color: 'var(--muted)' }}>Uploaded {d.uploaded} · {d.verified ? 'verified' : 'needs your check'}{d.url && <> · <a className="link" href={d.url} target="_blank" rel="noreferrer">View</a></>}</span>
              </span>
              <span style={{ display: 'flex', gap: 12 }}>
                {!d.verified && <ActionButton action={verifyDoc.bind(null, d.id)} label="Verify" />}
                <ActionButton action={deleteDoc.bind(null, d.id)} label="Remove" className="linkbtn linkbtn-danger" />
              </span>
            </li>
          ))}
        </ul>
      ) : <p className="small" style={{ margin: 0, color: 'var(--muted)' }}>Nothing uploaded yet. Text them the upload link, or upload a copy they sent you.</p>}
      <p className="small" style={{ margin: 0, color: 'var(--muted)' }}>Check each certificate against the issuer before verifying. A pro is assignable only with insurance, bond and background check all verified and in date.</p>
      <fieldset style={{ border: 0, margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <legend className="label" style={{ marginBottom: 8 }}>Upload a copy they sent you (saved as verified)</legend>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {PRO_REQUIRED_DOCUMENTS.map((k) => (
            <button key={k} type="button" className="opt" aria-pressed={kind === k} onClick={() => setKind(k)} style={{ minHeight: 44, padding: '0 14px', fontWeight: 600, fontSize: 14 }}>{NAME[k]}</button>
          ))}
        </div>
        <div className="field"><label className="label" htmlFor="o-file">File</label><input key={inputKey} id="o-file" type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
        {kind !== 'background_check' && <div className="field"><label className="label" htmlFor="o-exp">Expiry date</label><input id="o-exp" className="input" type="date" value={exp} onChange={(e) => setExp(e.target.value)} /></div>}
        {msg && <p className={msg.ok ? 'help-ok' : 'err'} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}
        <button type="button" className="btn btn-secondary btn-busy" onClick={upload} disabled={busy} style={{ alignSelf: 'flex-start' }}>{busy && <span className="spinner" aria-hidden="true" />}Upload</button>
      </fieldset>
    </section>
  );
}
