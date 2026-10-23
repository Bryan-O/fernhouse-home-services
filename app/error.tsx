'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { BRAND } from '@/lib/config';

// Shown if a page fails unexpectedly. Same look as the 404 page; nothing technical is shown.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('page error', error.digest ?? error.message);
  }, [error]);
  return (
    <div className="page" style={{ background: 'var(--paper-2)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <SiteHeader variant="minimal" />
      <main className="wrap nf-main" style={{ flex: 1, width: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 640 }}>
          <span className="nf-tag">Something went wrong</span>
          <h1 className="display nf-title">Sorry — this page didn’t load.</h1>
          <p style={{ margin: 0, fontSize: 17, lineHeight: '27px', color: 'var(--ink-2)' }}>
            Please try again. If it keeps happening, call or text us at <a className="link" href={BRAND.phoneHref}>{BRAND.phone}</a> and we’ll sort it out.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <button type="button" className="btn btn-primary btn-block-m" onClick={reset}>Try again</button>
            <Link className="btn btn-secondary btn-block-m" href="/">Go to the home page</Link>
          </div>
        </div>
      </main>
      <SiteFooter variant="home" />
    </div>
  );
}
