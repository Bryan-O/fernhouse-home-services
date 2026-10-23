'use client';

import { useEffect, useState } from 'react';

/** Phone-only booking bar that slides up once the hero has scrolled out of view. */
export function MobileBookBar({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const hero = document.getElementById('hero');
    if (!hero || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((entries) => setShow(!entries[0].isIntersecting));
    io.observe(hero);
    return () => io.disconnect();
  }, []);
  return (
    <div className={show ? 'mbar show' : 'mbar'} role="region" aria-label="Quick booking" aria-hidden={!show || undefined}>
      <span className="small" style={{ fontWeight: 600 }}>{text}</span>
      <a className="btn btn-primary btn-sm" href="#booking" tabIndex={show ? undefined : -1} style={{ minHeight: 48 }}>Book now</a>
    </div>
  );
}
