'use client';

import { useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { Check } from '@/components/Icons';
import { shrinkPhoto, uploadSigned } from '@/components/job/upload';
import { finishGatePhoto, markDone, sayOnMyWay, startGatePhoto } from './actions';
import type { JobView } from '@/lib/job';
import { BRAND } from '@/lib/config';

const PILL: Record<JobView['status'], { label: string; cls: string }> = {
  assigned: { label: 'Assigned', cls: 'pill-neutral' },
  today: { label: 'Today', cls: 'pill-warn' },
  on_way: { label: 'On the way', cls: 'pill-warn' },
  done: { label: 'Done', cls: 'pill-ok' },
};

export function JobApp({ token, job }: { token: string; job: JobView }) {
  const v = job.routeBack ? job.visitId : undefined;
  const [status, setStatus] = useState(job.status);
  const [eta, setEta] = useState('');
  const [photo, setPhoto] = useState<string | null>(job.photoUrl);
  const [uploading, setUploading] = useState(false);
  const [worse, setWorse] = useState(false);
  const [note, setNote] = useState('');
  const [done, setDone] = useState<{ at: string; upgrade: boolean } | null>(job.doneAt ? { at: job.doneAt, upgrade: job.upgradePending } : null);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const upcoming = status === 'assigned';
  const isDone = status === 'done';
  const cantFinish = job.isPet && !photo;

  const onWay = () => start(async () => {
    setError('');
    const r = await sayOnMyWay(token, v).catch(() => ({ ok: false as const, error: 'Something went wrong. Please try again.' }));
    if (r.ok) { setStatus('on_way'); setEta(r.eta); } else setError(r.error);
  });

  const addPhoto = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const u = await startGatePhoto(token, v);
      if (!u.ok) throw new Error(u.error);
      const blob = await shrinkPhoto(file);
      if (!(await uploadSigned('gate-photos', u.path, u.uploadToken, blob))) throw new Error('The photo couldn’t be uploaded. Please try again.');
      if (!(await finishGatePhoto(token, u.path, v)).ok) throw new Error('The photo couldn’t be saved. Please try again.');
      setPhoto(URL.createObjectURL(blob));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const finish = () => start(async () => {
    setError('');
    const r = await markDone(token, note, worse, v).catch(() => ({ ok: false as const, error: 'Something went wrong. Please try again.' }));
    if (r.ok) { setStatus('done'); setDone({ at: r.doneAt, upgrade: r.upgrade }); window.scrollTo(0, 0); } else setError(r.error);
  });

  const pill = PILL[status];
  return (
    <div className="step-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {job.routeBack && <Link className="linkbtn" href={`/job/${job.routeBack}`} style={{ alignSelf: 'flex-start' }}>Back to today’s route</Link>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="small" style={{ color: 'var(--muted)', fontWeight: 600 }}>{job.refLine}</span>
          <h1 className="display mg-h1">{job.title}</h1>
          <span className="body" style={{ color: 'var(--ink-2)' }}>{job.when}</span>
        </div>
        <span className={`pill ${pill.cls}`}>{pill.label}</span>
      </div>

      {done && (
        <div role="status" style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: 'var(--accent-soft)', borderRadius: 'var(--radius-sm)', padding: 16 }}>
          <Check size={22} stroke="var(--accent)" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontWeight: 600 }}>Marked done at {done.at}</span>
            <span className="small" style={{ color: 'var(--ink-2)' }}>
              {done.upgrade
                ? 'The customer has been asked to approve the cleanup price. '
                : `The customer has been texted${job.isPet ? ' with your gate photo' : ''}. `}
              Thanks — your payout for this job shows in your weekly statement.
            </span>
          </div>
        </div>
      )}
      {eta && !done && <div role="status" className="mg-toast">We’ve texted the customer you’ll arrive by {eta}.</div>}
      {error && <div role="alert" className="mg-error">{error}</div>}

      <section className="mg-card" aria-labelledby="where-h">
        <h2 className="display h3" id="where-h">Where</h2>
        {job.unlocked && !isDone ? (
          <>
            <span style={{ fontWeight: 600, fontSize: 17 }}>{job.address}</span>
            <a className="btn btn-secondary btn-sm" href={job.mapsUrl} target="_blank" rel="noreferrer" style={{ alignSelf: 'flex-start' }}>Open in Maps</a>
          </>
        ) : (
          <span className="body" style={{ color: 'var(--ink-2)' }}>{isDone ? 'Visit complete' : job.area} — the full address and access details unlock at 6 AM on the day.</span>
        )}
      </section>

      {job.unlocked && !isDone && (
        <section className="mg-card" aria-labelledby="access-h" style={{ borderColor: '#F5D3A6' }}>
          <h2 className="display h3" id="access-h">Access</h2>
          <p className="body" style={{ margin: 0 }}>{job.access}</p>
          <p className="small" style={{ margin: 0, color: 'var(--muted)' }}>Don’t write down or share access codes. They disappear from this page after the visit.</p>
        </section>
      )}

      <section className="mg-card" aria-labelledby="job-h">
        <h2 className="display h3" id="job-h">The job</h2>
        <dl className="dl">{job.details.map((d) => <div key={d.k} style={{ display: 'contents' }}><dt>{d.k}</dt><dd>{d.v}</dd></div>)}</dl>
        {!job.isPet && <p className="small" style={{ margin: 0, color: 'var(--muted)' }}>Skip anything unsafe — heights beyond a step stool, heavy furniture, bodily fluids, mold or pest waste — and note it below.</p>}
      </section>

      {!isDone && (
        <section className="mg-card" aria-labelledby="do-h">
          <h2 className="display h3" id="do-h">{upcoming ? 'Before the day' : 'Finish the job'}</h2>
          {upcoming ? (
            <>
              <p className="small" style={{ margin: 0, color: 'var(--ink-2)' }}>Can’t make it? Tell {BRAND.name} at least 24 hours ahead so a backup can cover the visit.</p>
              <a className="btn btn-secondary" href={BRAND.phoneHref.replace('tel:', 'sms:')} style={{ width: '100%' }}>Text {BRAND.name}</a>
            </>
          ) : (
            <>
              {status === 'today' && (
                <>
                  <button type="button" className="btn btn-secondary" onClick={onWay} disabled={pending} style={{ width: '100%' }}>I’m on my way</button>
                  <span className="small" style={{ color: 'var(--muted)', textAlign: 'center' }}>Texts the customer your arrival time. Optional.</span>
                </>
              )}
              {job.isPet && (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 600 }} id="photo-l">Gate photo <span style={{ color: 'var(--error)' }}>(required)</span></span>
                    <input ref={fileRef} type="file" accept="image/*" capture="environment" className="sr-only" id="gate-photo" aria-labelledby="photo-l" onChange={(e) => addPhoto(e.target.files?.[0])} />
                    {photo ? (
                      <div style={{ position: 'relative' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img className="photo-img" src={photo} alt="Gate photo added" />
                        <button type="button" className="pill" onClick={() => fileRef.current?.click()} disabled={uploading}
                          style={{ position: 'absolute', left: 10, bottom: 10, background: '#FFFFFF', color: 'var(--accent)', border: 0, cursor: 'pointer', minHeight: 32 }}>
                          {uploading ? 'Uploading…' : 'Photo added · retake'}
                        </button>
                      </div>
                    ) : (
                      <button type="button" className="photo-drop" onClick={() => fileRef.current?.click()} disabled={uploading}>
                        <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="18" height="14" rx="2" /><circle cx="12" cy="13" r="3.5" /><path d="M8 6l1.5-2h5L16 6" /></svg>
                        <span style={{ fontWeight: 600 }}>{uploading ? 'Uploading…' : 'Take a photo of the latched gate'}</span>
                      </button>
                    )}
                  </div>
                  <fieldset style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
                    <legend style={{ fontSize: 15, fontWeight: 600, padding: 0, marginBottom: 8 }}>Yard condition today</legend>
                    <div className="mg-reasons">
                      {['As booked', 'Worse than booked'].map((l, i) => (
                        <button key={l} type="button" className="opt" aria-pressed={worse === (i === 1)} onClick={() => setWorse(i === 1)}
                          style={{ minHeight: 52, padding: '8px 12px', fontSize: 15, fontWeight: 600, textAlign: 'left' }}>{l}</button>
                      ))}
                    </div>
                    <p className="small" style={{ margin: '8px 0 0', color: 'var(--muted)' }}>“Worse than booked” texts the customer to approve the higher cleanup price before they’re charged.</p>
                  </fieldset>
                </>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label htmlFor="job-note" style={{ fontSize: 15, fontWeight: 600 }}>Note for {BRAND.name} <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(optional)</span></label>
                <textarea id="job-note" className="input" rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)}
                  style={{ minHeight: 88, padding: '12px 14px', lineHeight: '22px' }} placeholder="Anything skipped, damaged or unusual" />
              </div>
              <button type="button" className="btn btn-primary btn-busy" onClick={finish} disabled={cantFinish || pending || uploading} style={{ width: '100%' }}>
                {pending && <span className="spinner" aria-hidden="true" />}Mark job done
              </button>
              {cantFinish && <span className="small" style={{ color: 'var(--muted)', textAlign: 'center' }}>Add the gate photo to finish.</span>}
              <span className="small" style={{ color: 'var(--muted)', textAlign: 'center' }}>Marking done charges the customer. Never take payment directly.</span>
            </>
          )}
        </section>
      )}
    </div>
  );
}
