'use client';

// Sends one event to Google Analytics and, where the Pixel is loaded, to Meta. Both are no-ops
// when their scripts aren't on the page (no IDs set, a private page, or Global Privacy Control).

type Gtag = (...args: unknown[]) => void;
type Fbq = ((...args: unknown[]) => void) & { disablePushState?: boolean };
declare global {
  interface Window { gtag?: Gtag; fbq?: Fbq; dataLayer?: unknown[] }
}

export function trackEvent(ga: { name: string; params?: Record<string, unknown> }, meta?: { name: string; params?: Record<string, unknown>; eventID?: string }): void {
  if (typeof window === 'undefined') return;
  window.gtag?.('event', ga.name, ga.params ?? {});
  if (meta) window.fbq?.('track', meta.name, meta.params ?? {}, meta.eventID ? { eventID: meta.eventID } : undefined);
}
